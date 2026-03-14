import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

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

  // Aggregate stats from sessions
  const sessionsSnapshot = await adminDb
    .collection("events")
    .where("userId", "==", userDoc.id)
    .get();

  let totalTokens = 0;
  let totalCost = 0;
  const modelCounts: Record<string, number> = {};

  sessionsSnapshot.docs.forEach((doc) => {
    const s = doc.data();
    totalTokens += s.totalTokens || 0;
    totalCost += Number(s.costUsd || 0);
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
  });

  const favoriteModel =
    Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Calculate streak data
  const activeDatesSet = new Set<string>();
  sessionsSnapshot.docs.forEach((doc) => {
    const ts = doc.data().timestamp?.toDate();
    if (ts) activeDatesSet.add(ts.toISOString().slice(0, 10));
  });
  const activeDates = Array.from(activeDatesSet).sort().reverse();

  let currentStreak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const startDate =
    activeDates[0] === today || activeDates[0] === yesterday
      ? activeDates[0]
      : null;
  if (startDate) {
    for (let i = 0; i < activeDates.length; i++) {
      const expected = new Date(startDate);
      expected.setDate(expected.getDate() - i);
      if (activeDates[i] === expected.toISOString().slice(0, 10)) currentStreak++;
      else break;
    }
  }

  return NextResponse.json({
    username: userData.username,
    displayName: userData.displayName,
    bio: userData.bio,
    avatarUrl: userData.avatarUrl,
    createdAt: userData.createdAt?.toDate?.() || userData.createdAt,
    stats: {
      totalTokens,
      totalCost,
      completionCount: sessionsSnapshot.size,
      favoriteModel,
      currentStreak,
    },
  });
}
