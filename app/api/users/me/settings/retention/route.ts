import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

const VALID_PERIODS = ["30d", "90d", "1y", "2y", "forever"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userDoc = await adminDb.collection("users").doc(session.user.firestoreId).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data = userDoc.data()!;
  const retention = data.dataRetention || { period: "forever", updatedAt: null };

  // Get data range
  const eventsRef = adminDb.collection("events").where("userId", "==", session.user.firestoreId);

  const [earliestSnap, latestSnap] = await Promise.all([
    eventsRef.orderBy("timestamp", "asc").limit(1).get(),
    eventsRef.orderBy("timestamp", "desc").limit(1).get(),
  ]);

  let earliest: string | null = null;
  let latest: string | null = null;

  if (!earliestSnap.empty) {
    const d = earliestSnap.docs[0].data();
    earliest = d.timestamp?.toDate?.()?.toISOString() || null;
  }
  if (!latestSnap.empty) {
    const d = latestSnap.docs[0].data();
    latest = d.timestamp?.toDate?.()?.toISOString() || null;
  }

  return NextResponse.json({
    period: retention.period || "forever",
    updatedAt: retention.updatedAt?.toDate?.()?.toISOString() || null,
    dataRange: { earliest, latest },
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { period: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!VALID_PERIODS.includes(body.period as (typeof VALID_PERIODS)[number])) {
    return NextResponse.json(
      { error: "Invalid period. Must be one of: " + VALID_PERIODS.join(", ") },
      { status: 400 },
    );
  }

  await adminDb
    .collection("users")
    .doc(session.user.firestoreId)
    .update({
      dataRetention: {
        period: body.period,
        updatedAt: FieldValue.serverTimestamp(),
      },
    });

  return NextResponse.json({ period: body.period });
}
