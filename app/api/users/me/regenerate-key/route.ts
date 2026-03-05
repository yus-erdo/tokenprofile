import { adminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/firebase/verify-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const uid = await verifyAuth(request);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const newKey = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  await adminDb.collection("users").doc(uid).update({ apiKey: newKey });

  return NextResponse.json({ apiKey: newKey });
}
