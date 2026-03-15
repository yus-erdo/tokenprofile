import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.firestoreId;

  const reportsSnapshot = await adminDb
    .collection("reports")
    .where("userId", "==", userId)
    .where("type", "==", "monthly")
    .orderBy("period", "desc")
    .get();

  const reports = reportsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      period: data.period,
      type: data.type,
      generatedAt: data.generatedAt?.toDate?.().toISOString() || "",
      summary: {
        totalTokens: data.data?.totalTokens || 0,
        totalCost: data.data?.totalCost || 0,
        completionCount: data.data?.completionCount || 0,
        activeDays: data.data?.activeDays || 0,
      },
    };
  });

  return NextResponse.json({ reports });
}
