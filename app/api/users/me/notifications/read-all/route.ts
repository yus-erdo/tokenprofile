import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function PUT() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await adminDb
    .collection("notifications")
    .where("userId", "==", session.user.firestoreId)
    .where("read", "==", false)
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  const batch = adminDb.batch();
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, { read: true });
  }
  await batch.commit();

  return NextResponse.json({ success: true, updated: snapshot.size });
}
