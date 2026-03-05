import { adminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { Heatmap } from "@/components/heatmap";

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

  const sessionsSnapshot = await adminDb
    .collection("sessions")
    .where("userId", "==", userDoc.id)
    .where("sessionAt", ">=", startOfYear)
    .where("sessionAt", "<=", endOfYear)
    .orderBy("sessionAt", "desc")
    .get();

  // Build heatmap data and stats
  const heatmapData: Record<string, number> = {};
  let totalTokens = 0;
  let totalCost = 0;
  const modelCounts: Record<string, number> = {};

  const sessions = sessionsSnapshot.docs.map((doc) => {
    const s = doc.data();
    const date = s.sessionAt?.toDate?.().toISOString().split("T")[0] || "";
    heatmapData[date] = (heatmapData[date] || 0) + (s.totalTokens || 0);
    totalTokens += s.totalTokens || 0;
    totalCost += Number(s.costUsd || 0);
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
    return {
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
        {/* Sidebar */}
        <div className="w-full md:w-72 flex-shrink-0">
          {user.avatarUrl && (
            <img src={user.avatarUrl} alt={user.displayName || user.username} className="w-full rounded-full border border-gray-200" />
          )}
          <h1 className="text-2xl font-bold mt-4">{user.displayName || user.username}</h1>
          <p className="text-gray-500 text-lg">{user.username}</p>
          {user.bio && <p className="mt-3 text-gray-700">{user.bio}</p>}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold">{sessionCount}</div>
              <div className="text-sm text-gray-500">Sessions</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold">{(totalTokens / 1_000_000).toFixed(1)}M</div>
              <div className="text-sm text-gray-500">Tokens</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
              <div className="text-sm text-gray-500">Estimated Cost</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold truncate text-sm">{favoriteModel}</div>
              <div className="text-sm text-gray-500">Top Model</div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-gray-700">
                {totalTokens.toLocaleString()} tokens in {year}
              </h2>
              <div className="flex gap-1">
                {years.map((y) => (
                  <a key={y} href={`/${username}?year=${y}`} className={`px-2 py-1 text-xs rounded ${y === year ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                    {y}
                  </a>
                ))}
              </div>
            </div>
            <Heatmap data={heatmapData} year={year} />
          </div>

          {/* Recent sessions */}
          <h2 className="text-lg font-semibold mb-3">Recent Sessions</h2>
          <div className="space-y-2">
            {sessions.slice(0, 20).map((s, i) => (
              <div key={i} className="flex items-center justify-between border rounded-lg px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{s.model || "unknown"}</span>
                  <span className="text-gray-400">{s.provider}</span>
                  {s.project && <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{s.project}</span>}
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                  <span>{(s.totalTokens || 0).toLocaleString()} tokens</span>
                  <span>${Number(s.costUsd || 0).toFixed(4)}</span>
                  <span>{new Date(s.sessionAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-gray-400 text-center py-8">No sessions recorded yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
