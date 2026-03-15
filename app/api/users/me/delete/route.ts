import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(session.user.firestoreId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data = userDoc.data()!;
  if (data.deletedAt) {
    return NextResponse.json({
      error: "Account is already scheduled for deletion",
      deletionScheduledFor: data.deletionScheduledFor?.toDate?.()?.toISOString() || null,
    }, { status: 409 });
  }

  const now = new Date();
  const scheduledFor = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await userRef.update({
    deletedAt: now,
    deletionScheduledFor: scheduledFor,
  });

  return NextResponse.json({
    message: "Account scheduled for deletion",
    deletedAt: now.toISOString(),
    deletionScheduledFor: scheduledFor.toISOString(),
  });
}
