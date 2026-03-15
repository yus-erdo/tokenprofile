import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { requireTeamAccess } from "@/lib/teams/helpers";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ slug: string }>;
}

// POST /api/teams/[slug]/invites - Create an email invite
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const access = await requireTeamAccess(slug, session.user.firestoreId, "admin");
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json();
  const { email, role } = body as { email?: string; role?: string };

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const validRoles = ["admin", "member"];
  const inviteRole = validRoles.includes(role || "") ? role! : "member";

  // Check if user with this email is already a member
  const userSnap = await adminDb
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!userSnap.empty) {
    const existingMember = await adminDb
      .collection("teams")
      .doc(access.team.id)
      .collection("members")
      .doc(userSnap.docs[0].id)
      .get();

    if (existingMember.exists) {
      return NextResponse.json(
        { error: "User is already a team member" },
        { status: 409 }
      );
    }
  }

  // Check for existing pending invite
  const existingInvite = await adminDb
    .collection("teamInvites")
    .where("teamId", "==", access.team.id)
    .where("email", "==", email)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (!existingInvite.empty) {
    return NextResponse.json(
      { error: "A pending invite already exists for this email" },
      { status: 409 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const inviteRef = await adminDb.collection("teamInvites").add({
    teamId: access.team.id,
    teamSlug: slug,
    email,
    role: inviteRole,
    invitedBy: session.user.firestoreId,
    status: "pending",
    createdAt: now,
    expiresAt,
  });

  return NextResponse.json({ id: inviteRef.id }, { status: 201 });
}

// GET /api/teams/[slug]/invites - List pending invites
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const access = await requireTeamAccess(slug, session.user.firestoreId, "admin");
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const invitesSnap = await adminDb
    .collection("teamInvites")
    .where("teamId", "==", access.team.id)
    .where("status", "==", "pending")
    .get();

  const invites = invitesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email,
      role: data.role,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      expiresAt: data.expiresAt?.toDate?.() || data.expiresAt,
    };
  });

  return NextResponse.json(invites);
}
