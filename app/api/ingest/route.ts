import { adminDb } from "@/lib/firebase/admin";
import { getModelCosts, calculateCost } from "@/lib/firebase/model-costs";
import { rateLimiter } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";
import { detectSpike } from "@/lib/spike-detection";
import { NextResponse } from "next/server";

async function checkBudgetAndSpike(userId: string, totalTokens: number, costUsd: number) {
  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    if (!userData) return;

    const budget = userData.budget as {
      type: "tokens" | "cost";
      period: string;
      amount: number;
      warningPercent: number;
    } | undefined;

    // Calculate today's totals from events
    const todayStr = new Date().toISOString().split("T")[0];
    const todayStart = new Date(todayStr + "T00:00:00Z");
    const todayEnd = new Date(todayStr + "T23:59:59Z");

    const todayEvents = await adminDb
      .collection("events")
      .where("userId", "==", userId)
      .where("timestamp", ">=", todayStart)
      .where("timestamp", "<=", todayEnd)
      .get();

    let todayTokens = 0;
    let todayCost = 0;

    for (const doc of todayEvents.docs) {
      const d = doc.data();
      todayTokens += d.totalTokens || 0;
      todayCost += Number(d.costUsd || 0);
    }

    // Include current event (already written)
    // The event was just added, so it's included in the query above

    // Budget check (daily only for now)
    if (budget && budget.period === "daily") {
      const currentUsage = budget.type === "tokens" ? todayTokens : todayCost;
      const percent = (currentUsage / budget.amount) * 100;

      const prevUsage = budget.type === "tokens"
        ? todayTokens - totalTokens
        : todayCost - costUsd;
      const prevPercent = (prevUsage / budget.amount) * 100;

      // Crossed the warning threshold with this event
      if (percent >= budget.warningPercent && prevPercent < budget.warningPercent && percent < 100) {
        await notify(userId, {
          type: "budget_warning",
          title: "budget warning",
          message: `you've used ${Math.round(percent)}% of your ${budget.period} ${budget.type} budget`,
          metadata: { percent: Math.round(percent), budgetType: budget.type, period: budget.period },
        });
      }

      // Crossed 100% with this event
      if (percent >= 100 && prevPercent < 100) {
        await notify(userId, {
          type: "budget_exceeded",
          title: "budget exceeded",
          message: `you've exceeded your ${budget.period} ${budget.type} budget of ${budget.type === "cost" ? "$" + budget.amount : budget.amount.toLocaleString() + " tokens"}`,
          metadata: { percent: Math.round(percent), budgetType: budget.type, period: budget.period },
        });
      }
    }

    // Spike detection — get heatmap data for past 8 days
    const alerts = userData.alerts as { spikesEnabled?: boolean; spikeMultiplier?: number } | undefined;
    const spikesEnabled = alerts?.spikesEnabled !== false; // default true

    if (spikesEnabled) {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const recentEvents = await adminDb
        .collection("events")
        .where("userId", "==", userId)
        .where("timestamp", ">=", eightDaysAgo)
        .get();

      const heatmapData: Record<string, { tokens: number; completions: number }> = {};
      for (const doc of recentEvents.docs) {
        const d = doc.data();
        const date = d.timestamp?.toDate?.().toISOString().split("T")[0] || "";
        if (!date) continue;
        const existing = heatmapData[date];
        heatmapData[date] = {
          tokens: (existing?.tokens ?? 0) + (d.totalTokens || 0),
          completions: (existing?.completions ?? 0) + 1,
        };
      }

      const spikeMultiplierThreshold = alerts?.spikeMultiplier ?? 2;
      const spike = detectSpike(heatmapData, todayStr);

      if (spike.isSpike && spike.multiplier >= spikeMultiplierThreshold) {
        // Only send one spike alert per day — check if we already sent one
        const existingAlert = await adminDb
          .collection("notifications")
          .where("userId", "==", userId)
          .where("type", "==", "spike_alert")
          .where("createdAt", ">=", todayStart)
          .limit(1)
          .get();

        if (existingAlert.empty) {
          await notify(userId, {
            type: "spike_alert",
            title: "usage spike detected",
            message: `your usage today is ${spike.multiplier}x your 7-day average`,
            metadata: { multiplier: spike.multiplier, average: spike.average },
          });
        }
      }
    }
  } catch (err) {
    // Budget/spike checks should not break ingest
    console.error("Budget/spike check failed:", err);
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);

  // Look up user by API key
  const usersSnapshot = await adminDb
    .collection("users")
    .where("apiKey", "==", apiKey)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const userDoc = usersSnapshot.docs[0];

  const { success } = await rateLimiter.limit(userDoc.id);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = (body.model as string) || null;
  const inputTokens = Number(body.input_tokens) || 0;
  const outputTokens = Number(body.output_tokens) || 0;
  const cacheCreationTokens = Number(body.cache_creation_tokens) || 0;
  const cacheReadTokens = Number(body.cache_read_tokens) || 0;
  const totalTokens = Number(body.total_tokens) || 0;

  // Calculate cost server-side
  let costUsd = 0;
  if (model) {
    const config = await getModelCosts();
    const calculated = calculateCost({
      model,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      config,
    });
    costUsd = calculated ?? (Number(body.cost_usd) || 0);
  } else {
    costUsd = Number(body.cost_usd) || 0;
  }

  await adminDb.collection("events").add({
    userId: userDoc.id,
    event: body.event || "Stop",
    source: (body.source as string) || "claude-code",
    provider: body.provider || null,
    model,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens,
    costUsd,
    project: body.project || null,
    durationSeconds: body.duration_seconds || null,
    numTurns: body.num_turns || null,
    toolsUsed: body.tools_used || {},
    metadata: body.metadata || {},
    timestamp: body.timestamp ? new Date(body.timestamp as string) : new Date(),
    createdAt: new Date(),
  });

  // Run budget and spike checks asynchronously (don't block response)
  checkBudgetAndSpike(userDoc.id, totalTokens, costUsd).catch(() => {});

  return NextResponse.json({ success: true });
}
