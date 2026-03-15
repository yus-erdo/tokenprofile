import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

function getCutoffDate(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "2y":
      return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    case "forever":
      return null;
    default:
      return null;
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userDoc = await adminDb.collection("users").doc(session.user.firestoreId).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data = userDoc.data()!;
  const period = data.dataRetention?.period || "forever";
  const cutoff = getCutoffDate(period);

  if (!cutoff) {
    return NextResponse.json({ deleted: 0, message: "Retention set to forever, nothing to clean up" });
  }

  let totalDeleted = 0;
  const BATCH_SIZE = 500;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snapshot = await adminDb
      .collection("events")
      .where("userId", "==", session.user.firestoreId)
      .where("timestamp", "<", cutoff)
      .limit(BATCH_SIZE)
      .get();

    if (snapshot.empty) break;

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.size;

    if (snapshot.size < BATCH_SIZE) break;
  }

  return NextResponse.json({ deleted: totalDeleted });
}
