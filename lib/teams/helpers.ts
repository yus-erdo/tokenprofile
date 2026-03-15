import { adminDb } from "@/lib/firebase/admin";
import type { MemberRole } from "./types";

/**
 * Get a team document by slug. Returns null if not found.
 */
export async function getTeamBySlug(slug: string) {
  const snap = await adminDb
    .collection("teams")
    .where("slug", "==", slug)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, data: snap.docs[0].data() };
}

/**
 * Get the member doc for a user in a team. Returns null if not a member.
 */
export async function getTeamMember(teamId: string, userId: string) {
  const doc = await adminDb
    .collection("teams")
    .doc(teamId)
    .collection("members")
    .doc(userId)
    .get();
  if (!doc.exists) return null;
  return doc.data()!;
}

/**
 * Check if a user has at least the required role in a team.
 * Role hierarchy: owner > admin > member
 */
export function hasRole(
  memberRole: MemberRole,
  requiredRole: MemberRole
): boolean {
  const hierarchy: Record<MemberRole, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  };
  return hierarchy[memberRole] >= hierarchy[requiredRole];
}

/**
 * Require authentication + team membership. Returns error response or context.
 */
export async function requireTeamAccess(
  slug: string,
  userId: string,
  requiredRole: MemberRole = "member"
) {
  const team = await getTeamBySlug(slug);
  if (!team) return { error: "Team not found", status: 404 } as const;

  const member = await getTeamMember(team.id, userId);
  if (!member) return { error: "Not a team member", status: 403 } as const;

  if (!hasRole(member.role as MemberRole, requiredRole)) {
    return { error: "Insufficient permissions", status: 403 } as const;
  }

  return { team, member } as const;
}
