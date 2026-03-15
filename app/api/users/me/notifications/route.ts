import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await adminDb
    .collection("notifications")
    .where("userId", "==", session.user.firestoreId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  const notifications = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
    };
  });

  return NextResponse.json(notifications);
}
