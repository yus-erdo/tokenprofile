import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { requireTeamAccess } from "@/lib/teams/helpers";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ slug: string }>;
}

// GET /api/teams/[slug] - Get team info (members only)
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const access = await requireTeamAccess(slug, session.user.firestoreId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const data = access.team.data;
  return NextResponse.json({
    id: access.team.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    ownerId: data.ownerId,
    avatarUrl: data.avatarUrl,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    myRole: access.member.role,
  });
}

// PUT /api/teams/[slug] - Update team (admin/owner only)
export async function PUT(request: Request, { params }: Params) {
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
  const allowed = ["name", "description", "avatarUrl"];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await adminDb.collection("teams").doc(access.team.id).update(updates);
  return NextResponse.json({ ok: true });
}

// DELETE /api/teams/[slug] - Delete team (owner only)
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const access = await requireTeamAccess(slug, session.user.firestoreId, "owner");
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const teamId = access.team.id;

  // Delete members subcollection
  const members = await adminDb.collection("teams").doc(teamId).collection("members").get();
  const batch = adminDb.batch();
  for (const doc of members.docs) {
    batch.delete(doc.ref);
  }
  batch.delete(adminDb.collection("teams").doc(teamId));
  await batch.commit();

  return NextResponse.json({ ok: true });
}
