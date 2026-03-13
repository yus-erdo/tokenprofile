import { adminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { ProfileContent, type Completion } from "@/components/profile-content";
import { ProfileSidebar } from "@/components/profile-sidebar";
import { ProfileTabs } from "@/components/profile-tabs";
import { DeveloperTab } from "@/components/developer-tab";
import { ThemeToggle } from "@/components/theme-toggle";
import { OnboardingWrapper } from "@/components/onboarding-wrapper";

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ year?: string; tab?: string }>;
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { year: yearParam, tab } = await searchParams;
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

  // Fetch completions for the year
  const startOfYear = new Date(`${year}-01-01T00:00:00Z`);
  const endOfYear = new Date(`${year}-12-31T23:59:59Z`);

  let sessionsSnapshot;
  try {
    sessionsSnapshot = await adminDb
      .collection("events")
      .where("userId", "==", userDoc.id)
      .where("timestamp", ">=", startOfYear)
      .where("timestamp", "<=", endOfYear)
      .orderBy("timestamp", "desc")
      .get();
  } catch {
    // Composite index may not exist yet — fall back to no sessions
    sessionsSnapshot = { docs: [] };
  }

  // Build heatmap data and stats
  const heatmapData: Record<string, { tokens: number; completions: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;
  let todayTokens = 0;
  let todayCost = 0;
  let todayCompletions = 0;
  const modelCounts: Record<string, number> = {};
  const todayDate = new Date().toISOString().split("T")[0];

  const completions: Completion[] = sessionsSnapshot.docs.map((doc) => {
    const s = doc.data();
    const date = s.timestamp?.toDate?.().toISOString().split("T")[0] || "";
    const existing = heatmapData[date];
    heatmapData[date] = {
      tokens: (existing?.tokens ?? 0) + (s.totalTokens || 0),
      completions: (existing?.completions ?? 0) + 1,
    };
    totalTokens += s.totalTokens || 0;
    totalCost += Number(s.costUsd || 0);
    if (date === todayDate) {
      todayTokens += s.totalTokens || 0;
      todayCost += Number(s.costUsd || 0);
      todayCompletions += 1;
    }
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
    return {
      id: doc.id,
      model: s.model,
      provider: s.provider,
      totalTokens: s.totalTokens,
      costUsd: s.costUsd,
      project: s.project,
      timestamp: s.timestamp?.toDate?.().toISOString() || "",
    };
  });

  const favoriteModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const completionCount = completions.length;

  const currentYear = new Date().getFullYear();
  const memberSince = user.createdAt?.toDate?.()?.getFullYear() || currentYear;
  const years = Array.from({ length: currentYear - memberSince + 1 }, (_, i) => currentYear - i);

  const initialUser = {
    displayName: user.displayName || "",
    bio: user.bio || "",
    location: user.location || "",
    website: user.website || "",
    avatarUrl: user.avatarUrl || "",
  };

  const hasOnboarded = user.hasOnboarded !== false; // treat missing as onboarded (existing users)
  const apiKey = user.apiKey || "";

  const isDeveloperTab = tab === "developer";

  return (
    <div className="max-w-6xl mx-auto px-4">
      <OnboardingWrapper hasOnboarded={hasOnboarded} apiKey={apiKey} userId={userDoc.id} />
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
        <ProfileSidebar username={username} initialUser={initialUser} />

        {/* Main content */}
        {isDeveloperTab ? (
          <DeveloperTab />
        ) : (
          <ProfileContent
            userId={userDoc.id}
            username={username}
            year={year}
            years={years}
            initialCompletions={completions}
            initialHeatmapData={heatmapData}
            initialTotalTokens={totalTokens}
            initialTotalCost={totalCost}
            initialFavoriteModel={favoriteModel}
            initialCompletionCount={completionCount}
            initialTodayTokens={todayTokens}
            initialTodayCost={todayCost}
            initialTodayCompletions={todayCompletions}
          />
        )}
      </div>
    </div>
  );
}
