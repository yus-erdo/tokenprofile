import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const docRef = adminDb.collection("notifications").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  if (doc.data()?.userId !== session.user.firestoreId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await docRef.update({ read: true });

  return NextResponse.json({ success: true });
}
