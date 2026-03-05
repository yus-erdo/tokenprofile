import { adminDb } from "@/lib/firebase/admin";
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await adminDb.collection("sessions").add({
    userId: userDoc.id,
    provider: body.provider || null,
    model: body.model || null,
    inputTokens: body.input_tokens || 0,
    outputTokens: body.output_tokens || 0,
    totalTokens: body.total_tokens || 0,
    costUsd: body.cost_usd || 0,
    project: body.project || null,
    durationSeconds: body.duration_seconds || null,
    numTurns: body.num_turns || null,
    toolsUsed: body.tools_used || {},
    metadata: body.metadata || {},
    sessionId: body.session_id || null,
    sessionAt: body.session_at ? new Date(body.session_at as string) : new Date(),
    createdAt: new Date(),
  });

  return NextResponse.json({ success: true });
}
