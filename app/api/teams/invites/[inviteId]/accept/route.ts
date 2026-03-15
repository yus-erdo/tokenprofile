import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ inviteId: string }>;
}

// POST /api/teams/invites/[inviteId]/accept
export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { inviteId } = await params;
  const inviteDoc = await adminDb.collection("teamInvites").doc(inviteId).get();

  if (!inviteDoc.exists) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const invite = inviteDoc.data()!;

  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: `Invite is already ${invite.status}` },
      { status: 400 }
    );
  }

  // Check expiry
  const expiresAt = invite.expiresAt?.toDate?.() || new Date(invite.expiresAt);
  if (expiresAt < new Date()) {
    await adminDb.collection("teamInvites").doc(inviteId).update({ status: "expired" });
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // Verify the email matches the current user
  const userDoc = await adminDb.collection("users").doc(session.user.firestoreId).get();
  const userEmail = userDoc.data()?.email;
  if (userEmail !== invite.email) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  // Check if already a member
  const existingMember = await adminDb
    .collection("teams")
    .doc(invite.teamId)
    .collection("members")
    .doc(session.user.firestoreId)
    .get();

  if (existingMember.exists) {
    await adminDb.collection("teamInvites").doc(inviteId).update({ status: "accepted" });
    return NextResponse.json({ error: "Already a member", slug: invite.teamSlug }, { status: 409 });
  }

  const now = new Date();

  // Add as member and update invite status
  const batch = adminDb.batch();
  batch.set(
    adminDb
      .collection("teams")
      .doc(invite.teamId)
      .collection("members")
      .doc(session.user.firestoreId),
    {
      role: invite.role,
      joinedAt: now,
      invitedBy: invite.invitedBy,
      visibility: "full",
    }
  );
  batch.update(adminDb.collection("teamInvites").doc(inviteId), {
    status: "accepted",
  });
  await batch.commit();

  return NextResponse.json({ ok: true, slug: invite.teamSlug });
}
