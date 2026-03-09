import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const newKey = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  await adminDb.collection("users").doc(session.user.firestoreId).update({ apiKey: newKey });

  return NextResponse.json({ apiKey: newKey });
}
