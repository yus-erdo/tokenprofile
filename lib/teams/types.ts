export interface Team {
  name: string;
  slug: string;
  description: string;
  ownerId: string;
  createdAt: Date;
  avatarUrl: string;
}

export type MemberRole = "owner" | "admin" | "member";
export type MemberVisibility = "full" | "summary" | "hidden";

export interface TeamMember {
  role: MemberRole;
  joinedAt: Date;
  invitedBy: string;
  visibility: MemberVisibility;
}

export type InviteStatus = "pending" | "accepted" | "declined" | "expired";

export interface TeamInvite {
  teamId: string;
  teamSlug: string;
  email: string;
  role: MemberRole;
  invitedBy: string;
  status: InviteStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface TeamInviteLink {
  teamId: string;
  teamSlug: string;
  code: string;
  role: MemberRole;
  createdBy: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  createdAt: Date;
}
