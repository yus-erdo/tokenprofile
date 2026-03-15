import { adminDb } from "@/lib/firebase/admin";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { getTeamBySlug, getTeamMember } from "@/lib/teams/helpers";
import { TeamDashboard } from "@/components/team-dashboard";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}

export default async function TeamPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    redirect("/sign-in");
  }

  const { slug } = await params;
  const { year: yearParam } = await searchParams;
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const member = await getTeamMember(team.id, session.user.firestoreId);
  if (!member) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 font-mono-accent">you are not a member of this team</p>
      </div>
    );
  }

  // Get all members
  const membersSnap = await adminDb
    .collection("teams")
    .doc(team.id)
    .collection("members")
    .get();

  const memberIds = membersSnap.docs.map((doc) => doc.id);
  const memberRoles: Record<string, string> = {};
  const memberVisibility: Record<string, string> = {};
  for (const doc of membersSnap.docs) {
    memberRoles[doc.id] = doc.data().role;
    memberVisibility[doc.id] = doc.data().visibility || "full";
  }

  // Fetch user info for all members
  const userDocs = await Promise.all(
    memberIds.map((id) => adminDb.collection("users").doc(id).get())
  );
  const memberUsers: Record<string, { username: string; displayName: string; avatarUrl: string }> = {};
  for (const doc of userDocs) {
    if (doc.exists) {
      const d = doc.data()!;
      memberUsers[doc.id] = {
        username: d.username || "",
        displayName: d.displayName || "",
        avatarUrl: d.avatarUrl || "",
      };
    }
  }

  // Aggregate stats per member from events
  const startOfYear = new Date(`${year}-01-01T00:00:00Z`);
  const endOfYear = new Date(`${year}-12-31T23:59:59Z`);

  const memberStats: Record<string, { tokens: number; cost: number; completions: number }> = {};
  const teamHeatmap: Record<string, { tokens: number; completions: number }> = {};
  let teamTotalTokens = 0;
  let teamTotalCost = 0;
  let teamTotalCompletions = 0;

  // Query events for each member
  for (const userId of memberIds) {
    const visibility = memberVisibility[userId];
    const isCurrentUser = userId === session.user.firestoreId;
    const canViewFull = member.role === "owner" || member.role === "admin" || isCurrentUser;

    if (visibility === "hidden" && !canViewFull) {
      memberStats[userId] = { tokens: 0, cost: 0, completions: 0 };
      continue;
    }

    try {
      const eventsSnap = await adminDb
        .collection("events")
        .where("userId", "==", userId)
        .where("timestamp", ">=", startOfYear)
        .where("timestamp", "<=", endOfYear)
        .get();

      let tokens = 0;
      let cost = 0;
      let completions = 0;

      for (const doc of eventsSnap.docs) {
        const e = doc.data();
        const t = e.totalTokens || 0;
        const c = Number(e.costUsd || 0);
        tokens += t;
        cost += c;
        completions += 1;

        // Add to team heatmap
        const date = e.timestamp?.toDate?.().toISOString().split("T")[0] || "";
        if (date) {
          const existing = teamHeatmap[date];
          teamHeatmap[date] = {
            tokens: (existing?.tokens ?? 0) + t,
            completions: (existing?.completions ?? 0) + 1,
          };
        }
      }

      memberStats[userId] = { tokens, cost, completions };
      teamTotalTokens += tokens;
      teamTotalCost += cost;
      teamTotalCompletions += completions;
    } catch {
      memberStats[userId] = { tokens: 0, cost: 0, completions: 0 };
    }
  }

  const teamData = team.data;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

  const membersData = memberIds.map((id) => ({
    userId: id,
    username: memberUsers[id]?.username || "",
    displayName: memberUsers[id]?.displayName || "",
    avatarUrl: memberUsers[id]?.avatarUrl || "",
    role: memberRoles[id] || "member",
    visibility: memberVisibility[id] || "full",
    stats: memberStats[id] || { tokens: 0, cost: 0, completions: 0 },
  }));

  return (
    <TeamDashboard
        team={{
          id: team.id,
          name: teamData.name,
          slug: teamData.slug,
          description: teamData.description,
        }}
        myRole={member.role as string}
        members={membersData}
        heatmapData={teamHeatmap}
        totalTokens={teamTotalTokens}
        totalCost={teamTotalCost}
        totalCompletions={teamTotalCompletions}
        year={year}
        years={years}
    />
  );
}
