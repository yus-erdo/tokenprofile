import { adminDb } from "@/lib/firebase/admin";
import { getModelCosts, calculateCost } from "@/lib/firebase/model-costs";
import { rateLimiter } from "@/lib/rate-limit";
import { updateDailyStats } from "@/lib/firebase/update-daily-stats";
import { NextResponse } from "next/server";

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

  const timestamp = body.timestamp ? new Date(body.timestamp as string) : new Date();

  // Write event and update daily stats in parallel
  await Promise.all([
    adminDb.collection("events").add({
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
      timestamp,
      createdAt: new Date(),
    }),
    updateDailyStats({
      userId: userDoc.id,
      model,
      totalTokens,
      costUsd,
      timestamp,
    }),
  ]);

  return NextResponse.json({ success: true });
}
