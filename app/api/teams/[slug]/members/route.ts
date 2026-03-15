import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { requireTeamAccess } from "@/lib/teams/helpers";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ slug: string }>;
}

// GET /api/teams/[slug]/members - List members
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

  const membersSnap = await adminDb
    .collection("teams")
    .doc(access.team.id)
    .collection("members")
    .get();

  // Fetch user details for each member
  const members = await Promise.all(
    membersSnap.docs.map(async (doc) => {
      const memberData = doc.data();
      const userDoc = await adminDb.collection("users").doc(doc.id).get();
      const userData = userDoc.exists ? userDoc.data()! : {};
      return {
        userId: doc.id,
        role: memberData.role,
        joinedAt: memberData.joinedAt?.toDate?.() || memberData.joinedAt,
        visibility: memberData.visibility || "full",
        username: userData.username || "",
        displayName: userData.displayName || "",
        avatarUrl: userData.avatarUrl || "",
      };
    })
  );

  return NextResponse.json(members);
}
