import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.firestoreId;

  // Last 7 days
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let eventsSnapshot;
  try {
    eventsSnapshot = await adminDb
      .collection("events")
      .where("userId", "==", userId)
      .where("timestamp", ">=", weekAgo)
      .where("timestamp", "<=", now)
      .get();
  } catch {
    eventsSnapshot = { docs: [] };
  }

  let totalTokens = 0;
  let totalCost = 0;
  let completionCount = 0;
  const modelCounts: Record<string, number> = {};

  for (const doc of eventsSnapshot.docs) {
    const event = doc.data();
    totalTokens += event.totalTokens || 0;
    totalCost += Number(event.costUsd || 0);
    completionCount += 1;
    const model = event.model || "unknown";
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  }

  const topModel =
    Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

  return NextResponse.json({
    period: "last 7 days",
    totalTokens,
    totalCost,
    completionCount,
    topModel,
  });
}
