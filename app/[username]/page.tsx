import { adminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { ProfileContent, type Session } from "@/components/profile-content";

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
