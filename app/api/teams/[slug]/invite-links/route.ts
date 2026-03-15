import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { requireTeamAccess } from "@/lib/teams/helpers";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ slug: string }>;
}

// POST /api/teams/[slug]/invite-links - Generate an invite link
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

  const body = await request.json().catch(() => ({}));
  const { maxUses = 25, expiryDays = 7, role = "member" } = body as {
    maxUses?: number;
    expiryDays?: number;
    role?: string;
  };

  const validRoles = ["admin", "member"];
  const linkRole = validRoles.includes(role) ? role : "member";

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  const linkRef = await adminDb.collection("teamInviteLinks").add({
    teamId: access.team.id,
    teamSlug: slug,
    code,
    role: linkRole,
    createdBy: session.user.firestoreId,
    maxUses,
    usedCount: 0,
    expiresAt,
    createdAt: now,
  });

  return NextResponse.json(
    { id: linkRef.id, code },
    { status: 201 }
  );
}
