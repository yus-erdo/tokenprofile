import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const limit = 20;

  const usersSnapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = usersSnapshot.docs[0].id;

  let query = adminDb
    .collection("events")
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc")
    .limit(limit);

  // Cursor-based pagination
  const after = searchParams.get("after");
  if (after) {
    const afterDoc = await adminDb.collection("events").doc(after).get();
    if (afterDoc.exists) {
      query = query.startAfter(afterDoc);
    }
  }

  const sessionsSnapshot = await query.get();

  const completions = sessionsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp,
    createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
  }));

  return NextResponse.json({ completions });
}
