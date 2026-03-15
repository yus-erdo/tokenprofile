import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

// Simple in-memory rate limit: 1 export per minute per user
const exportCooldowns = new Map<string, number>();

function checkExportRateLimit(userId: string): boolean {
  const now = Date.now();
  const last = exportCooldowns.get(userId);
  if (last && now - last < 60_000) return false;
  exportCooldowns.set(userId, now);
  // Clean old entries periodically
  if (exportCooldowns.size > 1000) {
    for (const [key, time] of exportCooldowns) {
      if (now - time > 120_000) exportCooldowns.delete(key);
    }
  }
  return true;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.firestoreId;

  if (!checkExportRateLimit(userId)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait 1 minute between exports." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "json";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  let query: FirebaseFirestore.Query = adminDb
    .collection("events")
    .where("userId", "==", userId);

  if (fromParam) {
    const fromDate = new Date(fromParam + "T00:00:00Z");
    if (!isNaN(fromDate.getTime())) {
      query = query.where("timestamp", ">=", fromDate);
    }
  }

  if (toParam) {
    const toDate = new Date(toParam + "T23:59:59Z");
    if (!isNaN(toDate.getTime())) {
      query = query.where("timestamp", "<=", toDate);
    }
  }

  query = query.orderBy("timestamp", "desc");

  const snapshot = await query.get();

  const events = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      date: d.timestamp?.toDate?.()?.toISOString?.() || "",
      model: d.model || "",
      input_tokens: d.inputTokens || 0,
      output_tokens: d.outputTokens || 0,
      total_tokens: d.totalTokens || 0,
      cost_usd: d.costUsd || 0,
      project: d.project || "",
    };
  });

  if (format === "csv") {
    const header = "date,model,input_tokens,output_tokens,total_tokens,cost_usd,project";
    const rows = events.map((e) =>
      [
        e.date,
        `"${(e.model || "").replace(/"/g, '""')}"`,
        e.input_tokens,
        e.output_tokens,
        e.total_tokens,
        e.cost_usd,
        `"${(e.project || "").replace(/"/g, '""')}"`,
      ].join(",")
    );

    const csv = [header, ...rows].join("\n");

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(csv));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="toqqen-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  // JSON format - stream it
  const jsonStr = JSON.stringify(events, null, 2);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(jsonStr));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="toqqen-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
