import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

// POST /api/teams - Create a new team
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, slug } = body as {
    name?: string;
    description?: string;
    slug?: string;
  };

  if (!name || !slug) {
    return NextResponse.json(
      { error: "Name and slug are required" },
      { status: 400 }
    );
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 2 || slug.length > 50) {
    return NextResponse.json(
      { error: "Slug must be 2-50 lowercase alphanumeric characters or hyphens" },
      { status: 400 }
    );
  }

  // Check slug uniqueness
  const existing = await adminDb
    .collection("teams")
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json(
      { error: "A team with this slug already exists" },
      { status: 409 }
    );
  }

  const userId = session.user.firestoreId;
  const now = new Date();

  // Create team
  const teamRef = await adminDb.collection("teams").add({
    name,
    slug,
    description: description || "",
    ownerId: userId,
    createdAt: now,
    avatarUrl: "",
  });

  // Add creator as owner member
  await teamRef.collection("members").doc(userId).set({
    role: "owner",
    joinedAt: now,
    invitedBy: userId,
    visibility: "full",
  });

  return NextResponse.json(
    { id: teamRef.id, slug },
    { status: 201 }
  );
}

// GET /api/teams - List teams for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.firestoreId;

  // Query all teams where the user is a member using collection group query
  const memberSnaps = await adminDb
    .collectionGroup("members")
    .where("__name__", ">=", `teams/`)
    .where("__name__", "<", `teams/\uf8ff`)
    .get();

  // Filter to only docs where userId matches
  const teamIds: string[] = [];
  for (const doc of memberSnaps.docs) {
    if (doc.id === userId) {
      // Path: teams/{teamId}/members/{userId}
      const teamId = doc.ref.parent.parent?.id;
      if (teamId) teamIds.push(teamId);
    }
  }

  if (teamIds.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch team details
  const teams = await Promise.all(
    teamIds.map(async (id) => {
      const doc = await adminDb.collection("teams").doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data()!;
      return {
        id: doc.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        avatarUrl: data.avatarUrl,
      };
    })
  );

  return NextResponse.json(teams.filter(Boolean));
}
