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

  // Build stats + analytics from daily aggregates (single pass)
  const heatmapData: Record<string, { tokens: number; completions: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;
  let todayTokens = 0;
  let todayCost = 0;
  let todayCompletions = 0;
  const modelCounts: Record<string, number> = {};
  const todayDate = new Date().toISOString().split("T")[0];
  let completionCount = 0;

  // Analytics accumulators
  const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, completions: 0, tokens: 0, cost: 0 }));
  const dailyByDow = Array.from({ length: 7 }, (_, i) => ({ day: i, completions: 0, tokens: 0, cost: 0 }));
  const weekBuckets = new Map<string, { tokens: number; cost: number; completions: number }>();
  const modelMap = new Map<string, { tokens: number; cost: number; completions: number }>();
  const activeDates: string[] = [];

  for (const doc of dailyStatsSnapshot.docs) {
    const d = doc.data();
    const date = d.date as string;
    const tokens = d.tokens || 0;
    const cost = d.cost || 0;
    const completions = d.completions || 0;
    const dayOfWeek = d.dayOfWeek ?? new Date(date).getUTCDay();

    heatmapData[date] = { tokens, completions };
    totalTokens += tokens;
    totalCost += cost;
    completionCount += completions;

    if (date === todayDate) {
      todayTokens = tokens;
      todayCost = cost;
      todayCompletions = completions;
    }

    // Peak hours
    const hours = d.hours as Record<string, number> | undefined;
    if (hours) {
      for (const [h, count] of Object.entries(hours)) {
        hourly[parseInt(h)].completions += count;
      }
    }
    dailyByDow[dayOfWeek].completions += completions;
    dailyByDow[dayOfWeek].tokens += tokens;
    dailyByDow[dayOfWeek].cost += cost;

    // Trends (weekly)
    const wd = new Date(date);
    wd.setUTCDate(wd.getUTCDate() - wd.getUTCDay());
    const weekKey = wd.toISOString().slice(0, 10);
    const wb = weekBuckets.get(weekKey) || { tokens: 0, cost: 0, completions: 0 };
    wb.tokens += tokens; wb.cost += cost; wb.completions += completions;
    weekBuckets.set(weekKey, wb);

    // Models
    const models = d.models as Record<string, number> | undefined;
    const modelTokens = d.modelTokens as Record<string, number> | undefined;
    const modelCost = d.modelCost as Record<string, number> | undefined;
    if (models) {
      for (const [model, count] of Object.entries(models)) {
        modelCounts[model] = (modelCounts[model] || 0) + count;
        const m = modelMap.get(model) || { tokens: 0, cost: 0, completions: 0 };
        m.completions += count;
        m.tokens += modelTokens?.[model] || 0;
        m.cost += modelCost?.[model] || 0;
        modelMap.set(model, m);
      }
    }

    if (completions > 0) activeDates.push(date);
  }

  const favoriteModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Compute streaks
  const sortedDates = activeDates.sort().reverse();
  let currentStreak = 0;
  let longestStreak = sortedDates.length > 0 ? 1 : 0;
  let streak = 1;
  if (sortedDates.length > 0) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const startDate = sortedDates[0] === todayDate || sortedDates[0] === yesterday ? sortedDates[0] : null;
    if (startDate) {
      for (let i = 0; i < sortedDates.length; i++) {
        const expected = new Date(startDate);
        expected.setDate(expected.getDate() - i);
        if (sortedDates[i] === expected.toISOString().slice(0, 10)) currentStreak++;
        else break;
      }
    }
    const sortedAsc = [...sortedDates].reverse();
    for (let i = 1; i < sortedAsc.length; i++) {
      const prev = new Date(sortedAsc[i - 1]);
      const curr = new Date(sortedAsc[i]);
      if ((curr.getTime() - prev.getTime()) / 86400000 === 1) {
        streak++;
        longestStreak = Math.max(longestStreak, streak);
      } else streak = 1;
    }
  }

  // Build trend periods
  const weeklyPeriods = Array.from(weekBuckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, stats], i, arr) => {
      const prev = i > 0 ? arr[i - 1][1] : null;
      return {
        period, ...stats,
        change: prev ? {
          tokens: prev.tokens ? ((stats.tokens - prev.tokens) / prev.tokens) * 100 : 0,
          cost: prev.cost ? ((stats.cost - prev.cost) / prev.cost) * 100 : 0,
          completions: prev.completions ? ((stats.completions - prev.completions) / prev.completions) * 100 : 0,
        } : null,
      };
    });

  // Build models list
  const modelsResult = Array.from(modelMap.entries())
    .map(([model, stats]) => ({
      model, ...stats,
      percentage: totalTokens > 0 ? (stats.tokens / totalTokens) * 100 : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  const initialAnalytics = {
    peakHours: { hourly, daily: dailyByDow },
    trends: { periods: weeklyPeriods, granularity: 'week' as const },
    models: { models: modelsResult, totalTokens },
    streaks: { currentStreak, longestStreak, totalActiveDays: activeDates.length },
  };

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
            initialAnalytics={initialAnalytics}
          />
        )}
      </div>
    </div>
  );
}
