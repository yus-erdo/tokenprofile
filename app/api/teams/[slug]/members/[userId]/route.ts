import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { requireTeamAccess } from "@/lib/teams/helpers";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ slug: string; userId: string }>;
}

// DELETE /api/teams/[slug]/members/[userId] - Remove member (admin/owner, or self-leave)
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, userId: targetUserId } = await params;
  const currentUserId = session.user.firestoreId;
  const isSelf = currentUserId === targetUserId;

  // For self-leave, just need to be a member. For removing others, need admin+.
  const requiredRole = isSelf ? "member" as const : "admin" as const;
  const access = await requireTeamAccess(slug, currentUserId, requiredRole);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Can't remove the owner unless it's the owner leaving (and transferring ownership)
  const targetMember = await adminDb
    .collection("teams")
    .doc(access.team.id)
    .collection("members")
    .doc(targetUserId)
    .get();

  if (!targetMember.exists) {
    return NextResponse.json({ error: "User is not a member" }, { status: 404 });
  }

  if (targetMember.data()!.role === "owner" && !isSelf) {
    return NextResponse.json(
      { error: "Cannot remove the team owner" },
      { status: 403 }
    );
  }

  if (targetMember.data()!.role === "owner" && isSelf) {
    return NextResponse.json(
      { error: "Owner must transfer ownership before leaving" },
      { status: 400 }
    );
  }

  await adminDb
    .collection("teams")
    .doc(access.team.id)
    .collection("members")
    .doc(targetUserId)
    .delete();

  return NextResponse.json({ ok: true });
}
