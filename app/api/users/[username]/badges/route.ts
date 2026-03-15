import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import {
  evaluateBadges,
  computeBadgeStats,
  type EarnedBadge,
} from "@/lib/badges";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const usersSnapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  const existingBadges: EarnedBadge[] = userData.badges || [];

  // Fetch all events for the user
  const eventsSnapshot = await adminDb
    .collection("events")
    .where("userId", "==", userDoc.id)
    .orderBy("timestamp", "desc")
    .get();

  const heatmap: Record<string, { tokens: number; completions: number }> = {};
  const models: Record<string, number> = {};
  const timestamps: string[] = [];
  let totalTokens = 0;

  for (const doc of eventsSnapshot.docs) {
    const s = doc.data();
    const ts = s.timestamp?.toDate?.()?.toISOString() || "";
    const date = ts.split("T")[0];
    if (date) {
      const existing = heatmap[date];
      heatmap[date] = {
        tokens: (existing?.tokens ?? 0) + (s.totalTokens || 0),
        completions: (existing?.completions ?? 0) + 1,
      };
    }
    totalTokens += s.totalTokens || 0;
    if (s.model) models[s.model] = (models[s.model] || 0) + 1;
    if (ts) timestamps.push(ts);
  }

  const stats = computeBadgeStats({
    totalTokens,
    completionCount: eventsSnapshot.docs.length,
    heatmap,
    models,
    timestamps,
  });

  const badges = evaluateBadges(stats, existingBadges);

  return NextResponse.json({ badges });
}
