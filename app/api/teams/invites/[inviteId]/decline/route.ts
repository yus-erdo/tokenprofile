import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ inviteId: string }>;
}

// POST /api/teams/invites/[inviteId]/decline
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

  // Verify the email matches the current user
  const userDoc = await adminDb.collection("users").doc(session.user.firestoreId).get();
  const userEmail = userDoc.data()?.email;
  if (userEmail !== invite.email) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  await adminDb.collection("teamInvites").doc(inviteId).update({ status: "declined" });

  return NextResponse.json({ ok: true });
}
