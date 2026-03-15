# Milestone 9 — Teams

**Priority:** 🟡 Medium
**Effort:** Large
**Dependencies:** M1 (analytics), M8 (data privacy groundwork)

## Goal

Allow users to create teams and view aggregate usage across multiple members.

## Features

### 9.1 Team Creation & Management
Create and manage teams with members.

- [ ] Team data model in Firestore: `teams/{teamId}`
  ```
  {
    name: string
    slug: string (URL-friendly, unique)
    description: string
    ownerId: string (creator)
    createdAt: Timestamp
    avatarUrl: string (optional)
  }
  ```
- [ ] Team members subcollection: `teams/{teamId}/members/{userId}`
  ```
  {
    role: "owner" | "admin" | "member"
    joinedAt: Timestamp
    invitedBy: string
  }
  ```
- [ ] Create team UI: name, description, slug
- [ ] Team settings page: edit name, description, delete team
- [ ] Member management: view members, change roles, remove members
- [ ] Team owner can transfer ownership

### 9.2 Invite by Email
Invite users to a team via email address.

- [ ] Invite data model: `teamInvites/{inviteId}`
  ```
  {
    teamId: string
    email: string
    role: "admin" | "member"
    invitedBy: string
    status: "pending" | "accepted" | "declined" | "expired"
    createdAt: Timestamp
    expiresAt: Timestamp (7 days)
  }
  ```
- [ ] Invite form: enter email + role
- [ ] In-app notification for invited users (match by email)
- [ ] Email notification (when email service available)
- [ ] Accept/decline invite UI
- [ ] Pending invites list for team admins

### 9.3 Invite by Link
Shareable invite link for easy team joining.

- [ ] Generate unique invite link: `toqqen.dev/teams/{slug}/join?code={inviteCode}`
- [ ] Invite link settings: expiry (24h, 7d, 30d, never), max uses, role assigned
- [ ] Landing page for invite link: show team name, member count, join button
- [ ] Revoke/regenerate invite links
- [ ] Store in Firestore: `teamInviteLinks/{linkId}`

### 9.4 Team Dashboard
Aggregate usage view across team members.

- [ ] Team page: `toqqen.dev/teams/{slug}`
- [ ] Aggregate stats: total tokens, total cost, total completions across members
- [ ] Per-member breakdown table: username, tokens, cost, completions, last active
- [ ] Team heatmap: combined activity across all members
- [ ] Team trends: usage over time for the whole team
- [ ] Date range filtering
- [ ] Only visible to team members

### 9.5 Team Roles & Permissions
Role-based access control for team features.

- [ ] **Owner:** full control, can delete team, transfer ownership
- [ ] **Admin:** manage members, view all stats, manage invite links
- [ ] **Member:** view team dashboard, see own stats in context
- [ ] Members can control visibility of their detailed stats to the team
  - Options: full stats, summary only, hidden
- [ ] Privacy setting stored in member document: `visibility: "full" | "summary" | "hidden"`

## Technical Notes

- Teams are a new top-level collection — needs Firestore security rules
- Team dashboard aggregation: query all member events — expensive, consider caching
- Could use Firestore aggregate queries (count, sum) where available
- Team slugs must be unique and URL-safe (validate on creation)
- A user can be in multiple teams
- Team member limit: start with 50 members per team
- Security rules: members can read team data, admins can write, owner can delete

## Definition of Done

- Teams can be created, edited, and deleted
- Members can be invited by email and link
- Team dashboard shows accurate aggregate stats
- Role-based permissions enforced server-side
- Privacy controls work for member visibility
- All team pages are responsive and theme-aware
