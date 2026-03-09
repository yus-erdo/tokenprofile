import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await adminDb
    .collection("events")
    .where("userId", "==", session.user.firestoreId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ event: null });
  }

  const data = snapshot.docs[0].data();
  return NextResponse.json({
    event: {
      model: data.model || "unknown",
      totalTokens: data.totalTokens || 0,
    },
  });
}
