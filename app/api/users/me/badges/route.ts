import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import {
  evaluateBadges,
  computeBadgeStats,
  getNewlyEarnedBadges,
  type EarnedBadge,
} from "@/lib/badges";

export async function GET() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.firestoreId;
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userData = userDoc.data()!;
  const existingBadges: EarnedBadge[] = userData.badges || [];

  // Fetch all events for the user (across all years) for badge evaluation
  const eventsSnapshot = await adminDb
    .collection("events")
    .where("userId", "==", userId)
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
  const newlyEarned = getNewlyEarnedBadges(badges, existingBadges);

  // Persist newly earned badges
  if (newlyEarned.length > 0) {
    const now = new Date().toISOString();
    const updatedBadges: EarnedBadge[] = [
      ...existingBadges,
      ...newlyEarned.map((id) => ({ id, unlockedAt: now })),
    ];
    await adminDb.collection("users").doc(userId).update({ badges: updatedBadges });

    // Update the response with unlock dates
    for (const b of badges) {
      if (newlyEarned.includes(b.id)) {
        b.unlockedAt = now;
      }
    }
  }

  return NextResponse.json({ badges, newlyEarned });
}
