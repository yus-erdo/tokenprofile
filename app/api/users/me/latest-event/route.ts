import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  let query: FirebaseFirestore.Query = adminDb
    .collection("events")
    .where("userId", "==", session.user.firestoreId);

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      query = query.where("createdAt", ">", sinceDate);
    }
  }

  query = query.orderBy("createdAt", "desc").limit(1);

  const snapshot = await query.get();

  if (snapshot.empty) {
    return NextResponse.json({ event: null });
  }

  const data = snapshot.docs[0].data();
  const createdAt = data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null;
  return NextResponse.json({
    event: {
      model: data.model || "unknown",
      totalTokens: data.totalTokens || 0,
      createdAt,
    },
  });
}
