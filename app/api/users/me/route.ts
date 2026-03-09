import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

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
  return NextResponse.json({
    ...data,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const allowed = ["displayName", "bio", "location", "website", "hasOnboarded", "interests"];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  await adminDb.collection("users").doc(session.user.firestoreId).update(updates);

  const updated = await adminDb.collection("users").doc(session.user.firestoreId).get();
  return NextResponse.json(updated.data());
}
