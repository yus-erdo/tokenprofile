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
    .collection("sessions")
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
    },
  });
}
