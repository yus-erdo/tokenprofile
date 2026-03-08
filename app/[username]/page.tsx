import { adminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { ProfileContent, type Session } from "@/components/profile-content";
import { EditProfileButton } from "@/components/edit-profile-button";

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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar — compact row on mobile, vertical column on md+ */}
        <div className="w-full md:w-72 flex-shrink-0 flex flex-row items-center gap-4 md:block">
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.displayName || user.username}
              className="w-20 h-20 md:w-full md:h-auto rounded-full border border-gray-200 dark:border-gray-700 flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold md:mt-4">{user.displayName || user.username}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg">{user.username}</p>
            {user.bio && <p className="mt-1 md:mt-3 text-gray-700 dark:text-gray-300 text-sm md:text-base">{user.bio}</p>}
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
          </div>
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
