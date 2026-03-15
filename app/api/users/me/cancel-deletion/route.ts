import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
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
  if (!data.deletedAt) {
    return NextResponse.json({ error: "Account is not scheduled for deletion" }, { status: 400 });
  }

  // Check if still in grace period
  const scheduledFor = data.deletionScheduledFor?.toDate?.();
  if (scheduledFor && scheduledFor < new Date()) {
    return NextResponse.json({ error: "Grace period has expired" }, { status: 400 });
  }

  await userRef.update({
    deletedAt: FieldValue.delete(),
    deletionScheduledFor: FieldValue.delete(),
  });

  return NextResponse.json({ message: "Account deletion cancelled" });
}
