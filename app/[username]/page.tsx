import { adminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { ProfileContent, type Session } from "@/components/profile-content";
import { EditProfileButton } from "@/components/edit-profile-button";
import { ProfileTabs } from "@/components/profile-tabs";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ year?: string }>;
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { year: yearParam } = await searchParams;
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  // Fetch user by username
  const usersSnapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (usersSnapshot.empty) notFound();

  const userDoc = usersSnapshot.docs[0];
  const user = userDoc.data();

  // Fetch sessions for the year
  const startOfYear = new Date(`${year}-01-01T00:00:00Z`);
  const endOfYear = new Date(`${year}-12-31T23:59:59Z`);

  let sessionsSnapshot;
  try {
    sessionsSnapshot = await adminDb
      .collection("sessions")
      .where("userId", "==", userDoc.id)
      .where("sessionAt", ">=", startOfYear)
      .where("sessionAt", "<=", endOfYear)
      .orderBy("sessionAt", "desc")
      .get();
  } catch {
    // Composite index may not exist yet — fall back to no sessions
    sessionsSnapshot = { docs: [] };
  }

  // Build heatmap data and stats
  const heatmapData: Record<string, number> = {};
  let totalTokens = 0;
  let totalCost = 0;
  const modelCounts: Record<string, number> = {};

  const sessions: Session[] = sessionsSnapshot.docs.map((doc) => {
    const s = doc.data();
    const date = s.sessionAt?.toDate?.().toISOString().split("T")[0] || "";
    heatmapData[date] = (heatmapData[date] || 0) + (s.totalTokens || 0);
    totalTokens += s.totalTokens || 0;
    totalCost += Number(s.costUsd || 0);
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
    return {
      id: doc.id,
      model: s.model,
      provider: s.provider,
      totalTokens: s.totalTokens,
      costUsd: s.costUsd,
      project: s.project,
      sessionAt: s.sessionAt?.toDate?.().toISOString() || "",
    };
  });

  const favoriteModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const sessionCount = sessions.length;

  const currentYear = new Date().getFullYear();
  const memberSince = user.createdAt?.toDate?.()?.getFullYear() || currentYear;
  const years = Array.from({ length: currentYear - memberSince + 1 }, (_, i) => currentYear - i);

  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* GitHub-style header — border line that avatar overlaps */}
      <div className="relative hidden md:block h-[56px] mt-8">
        {/* Avatar — positioned so it starts at the top and extends past the border */}
        {user.avatarUrl && (
          <div className="absolute left-0 top-0 z-10">
            <img
              src={user.avatarUrl}
              alt={user.displayName || user.username}
              className="w-[200px] h-[200px] rounded-full border-4 border-white dark:border-gray-950 bg-white dark:bg-gray-950"
            />
          </div>
        )}
        {/* Tab bar — sits at the bottom of this header area, border goes full width */}
        <div className="absolute bottom-0 left-0 right-0 border-b border-gray-200 dark:border-gray-700 flex items-end justify-between pl-64">
          <ProfileTabs username={username} />
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile: simple stacked layout with tabs */}
      <div className="md:hidden border-b border-gray-200 dark:border-gray-700 pt-4 flex items-end justify-between">
        <ProfileTabs username={username} />
        <ThemeToggle />
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-8 pt-4">
        {/* Sidebar */}
        <div className="w-full md:w-56 flex-shrink-0">
          {/* Mobile avatar + name row */}
          <div className="flex flex-row items-center gap-4 md:hidden">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.displayName || user.username}
                className="w-20 h-20 rounded-full border border-gray-200 dark:border-gray-700 flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold">{user.displayName || user.username}</h1>
              <p className="text-gray-500 dark:text-gray-400 text-base">{user.username}</p>
            </div>
          </div>
          {/* Desktop name — below avatar overlap area */}
          <div className="hidden md:block md:mt-[152px]">
            <h1 className="text-2xl font-bold">{user.displayName || user.username}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-xl font-light">{user.username}</p>
          </div>

          {user.bio && <p className="mt-3 text-gray-700 dark:text-gray-300 text-sm md:text-base">{user.bio}</p>}

          <EditProfileButton username={username} />

          <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {user.location && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>{user.location}</span>
              </div>
            )}
            {user.website && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
                <a href={user.website.startsWith("http") ? user.website : `https://${user.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 hover:underline truncate">{user.website.replace(/^https?:\/\//, "")}</a>
              </div>
            )}
          </div>

          <SignOutButton username={username} />
        </div>

        {/* Main content — real-time updates via client component */}
        <ProfileContent
          userId={userDoc.id}
          username={username}
          year={year}
          years={years}
          initialSessions={sessions}
          initialHeatmapData={heatmapData}
          initialTotalTokens={totalTokens}
          initialTotalCost={totalCost}
          initialFavoriteModel={favoriteModel}
          initialSessionCount={sessionCount}
        />
      </div>
    </div>
  );
}
