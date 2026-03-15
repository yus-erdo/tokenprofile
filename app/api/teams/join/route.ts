import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

// POST /api/teams/join?code={code} - Join team via invite link
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
  }

  // Find the invite link
  const linksSnap = await adminDb
    .collection("teamInviteLinks")
    .where("code", "==", code)
    .limit(1)
    .get();

  if (linksSnap.empty) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  const linkDoc = linksSnap.docs[0];
  const link = linkDoc.data();

  // Check expiry
  const expiresAt = link.expiresAt?.toDate?.() || new Date(link.expiresAt);
  if (expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite link has expired" }, { status: 410 });
  }

  // Check usage limit
  if (link.usedCount >= link.maxUses) {
    return NextResponse.json({ error: "Invite link has reached its usage limit" }, { status: 410 });
  }

  const userId = session.user.firestoreId;

  // Check if already a member
  const existingMember = await adminDb
    .collection("teams")
    .doc(link.teamId)
    .collection("members")
    .doc(userId)
    .get();

  if (existingMember.exists) {
    return NextResponse.json(
      { error: "Already a member", slug: link.teamSlug },
      { status: 409 }
    );
  }

  const now = new Date();

  // Add member and increment usage
  const batch = adminDb.batch();
  batch.set(
    adminDb.collection("teams").doc(link.teamId).collection("members").doc(userId),
    {
      role: link.role,
      joinedAt: now,
      invitedBy: link.createdBy,
      visibility: "full",
    }
  );
  batch.update(linkDoc.ref, {
    usedCount: FieldValue.increment(1),
  });
  await batch.commit();

  return NextResponse.json({ ok: true, slug: link.teamSlug });
}
