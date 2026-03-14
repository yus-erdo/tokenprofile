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
  let usersSnapshot;
  try {
    usersSnapshot = await adminDb
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();
    if (usersSnapshot.empty) notFound();
  } catch (err) {
    console.error("Failed to fetch user:", err);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-mono-accent font-bold mb-2">temporarily unavailable</h1>
          <p className="text-gray-500 font-mono-accent text-sm">firestore quota exceeded — try again shortly</p>
        </div>
      </div>
    );
  }

  const userDoc = usersSnapshot.docs[0];
  const user = userDoc.data();

  // Read pre-aggregated daily stats (max 366 docs/year vs thousands of events)
  let dailyStatsSnapshot;
  try {
    dailyStatsSnapshot = await adminDb
      .collection("userStats")
      .doc(userDoc.id)
      .collection("daily")
      .where("date", ">=", `${year}-01-01`)
      .where("date", "<=", `${year}-12-31`)
      .orderBy("date", "asc")
      .get();
  } catch {
    dailyStatsSnapshot = { docs: [], empty: true };
  }

  // Build stats from daily aggregates
  const heatmapData: Record<string, { tokens: number; completions: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;
  let todayTokens = 0;
  let todayCost = 0;
  let todayCompletions = 0;
  const modelCounts: Record<string, number> = {};
  const todayDate = new Date().toISOString().split("T")[0];
  let completionCount = 0;

  for (const doc of dailyStatsSnapshot.docs) {
    const d = doc.data();
    const date = d.date as string;
    heatmapData[date] = {
      tokens: d.tokens || 0,
      completions: d.completions || 0,
    };
    totalTokens += d.tokens || 0;
    totalCost += d.cost || 0;
    completionCount += d.completions || 0;

    if (date === todayDate) {
      todayTokens = d.tokens || 0;
      todayCost = d.cost || 0;
      todayCompletions = d.completions || 0;
    }

    // Merge model counts
    const models = d.models as Record<string, number> | undefined;
    if (models) {
      for (const [model, count] of Object.entries(models)) {
        modelCounts[model] = (modelCounts[model] || 0) + count;
      }
    }
  }

  const favoriteModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Fetch only recent completions (20 most recent) — not all events
  let recentCompletions: Completion[] = [];
  try {
    const recentSnapshot = await adminDb
      .collection("events")
      .where("userId", "==", userDoc.id)
      .orderBy("timestamp", "desc")
      .limit(20)
      .get();

    recentCompletions = recentSnapshot.docs.map((doc) => {
      const s = doc.data();
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
  } catch {
    // Fall back to empty if quota exhausted
  }

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

  const hasOnboarded = user.hasOnboarded !== false;
  const apiKey = user.apiKey || "";
  const isDeveloperTab = tab === "developer";

  return (
    <div className="max-w-6xl mx-auto px-4">
      <OnboardingWrapper hasOnboarded={hasOnboarded} apiKey={apiKey} userId={userDoc.id} />
      <div className="relative hidden md:block h-[56px] mt-8">
        {user.avatarUrl && (
          <div className="absolute left-0 top-0 z-10">
            <img
              src={user.avatarUrl}
              alt={user.displayName || user.username}
              className="w-[200px] h-[200px] rounded-full border-4 border-white dark:border-gray-950 bg-white dark:bg-gray-950"
            />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 border-b border-gray-200 dark:border-gray-700 flex items-end justify-between pl-64">
          <ProfileTabs username={username} />
          <ThemeToggle />
        </div>
      </div>

      <div className="md:hidden border-b border-gray-200 dark:border-gray-700 pt-4 flex items-end justify-between">
        <ProfileTabs username={username} />
        <ThemeToggle />
      </div>

      <div className="flex flex-col md:flex-row gap-8 pt-4">
        <ProfileSidebar username={username} initialUser={initialUser} />

        {isDeveloperTab ? (
          <DeveloperTab />
        ) : (
          <ProfileContent
            userId={userDoc.id}
            username={username}
            year={year}
            years={years}
            initialCompletions={recentCompletions}
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
