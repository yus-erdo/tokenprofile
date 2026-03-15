import { type CSSProperties } from "react";
import { adminDb } from "@/lib/firebase/admin";
import { notFound } from "next/navigation";
import { ProfileContent, type Completion } from "@/components/profile-content";
import { ProfileSidebar } from "@/components/profile-sidebar";
import { ProfileTabs } from "@/components/profile-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { OnboardingWrapper } from "@/components/onboarding-wrapper";
import type { Goal } from "@/components/usage-goals";
import {
  evaluateBadges,
  computeBadgeStats,
  getNewlyEarnedBadges,
  type EarnedBadge,
  type BadgeWithStatus,
} from "@/lib/badges";
import { BudgetProgress } from "@/components/budget-progress";
import { SpikeAlert } from "@/components/spike-alert";
import { detectSpike } from "@/lib/spike-detection";

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

  // Read single yearly stats doc (1 read for everything)
  let yearlyData: Record<string, unknown> = {};
  try {
    const yearlyDoc = await adminDb
      .collection("userStats")
      .doc(userDoc.id)
      .collection("yearly")
      .doc(String(year))
      .get();
    if (yearlyDoc.exists) yearlyData = yearlyDoc.data()!;
  } catch {
    // Fall back to empty
  }

  const todayDate = new Date().toISOString().split("T")[0];

  // Extract stats from yearly doc
  const totalTokens = (yearlyData.totalTokens as number) || 0;
  const totalCost = (yearlyData.totalCost as number) || 0;
  const completionCount = (yearlyData.completionCount as number) || 0;

  // Heatmap from embedded map
  const heatmapRaw = (yearlyData.heatmap as Record<string, { tokens: number; completions: number }>) || {};
  const heatmapData: Record<string, { tokens: number; completions: number }> = {};
  for (const [date, entry] of Object.entries(heatmapRaw)) {
    heatmapData[date] = { tokens: entry.tokens || 0, completions: entry.completions || 0 };
  }

  const todayEntry = heatmapRaw[todayDate];
  const todayTokens = todayEntry?.tokens || 0;
  const todayCost = (() => {
    // Today's cost not in heatmap — compute from model costs for today
    // For simplicity, we get it from the daily breakdown
    // Actually, we don't store per-day cost in heatmap. Let's compute from total if today is only day,
    // or accept this limitation. We can add it to the heatmap later.
    // For now, approximate: if today has completions, use proportion
    if (!todayEntry?.completions || !completionCount) return 0;
    return (todayEntry.completions / completionCount) * totalCost;
  })();
  const todayCompletions = todayEntry?.completions || 0;

  // Models
  const modelCounts = (yearlyData.models as Record<string, number>) || {};
  const modelTokensMap = (yearlyData.modelTokens as Record<string, number>) || {};
  const modelCostMap = (yearlyData.modelCost as Record<string, number>) || {};
  const favoriteModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Peak hours
  const hoursRaw = (yearlyData.hours as Record<string, number>) || {};
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    hour: i, completions: hoursRaw[String(i)] || 0, tokens: 0, cost: 0,
  }));

  const dailyRaw = (yearlyData.daily as Record<string, number>) || {};
  const dailyTokensRaw = (yearlyData.dailyTokens as Record<string, number>) || {};
  const dailyCostRaw = (yearlyData.dailyCost as Record<string, number>) || {};
  const dailyByDow = Array.from({ length: 7 }, (_, i) => ({
    day: i,
    completions: dailyRaw[String(i)] || 0,
    tokens: dailyTokensRaw[String(i)] || 0,
    cost: dailyCostRaw[String(i)] || 0,
  }));

  // Trends — build weekly buckets from heatmap entries
  const weekBuckets = new Map<string, { tokens: number; cost: number; completions: number }>();
  const activeDates: string[] = [];
  for (const [date, entry] of Object.entries(heatmapRaw)) {
    if (entry.completions > 0) activeDates.push(date);
    const wd = new Date(date);
    wd.setUTCDate(wd.getUTCDate() - wd.getUTCDay());
    const weekKey = wd.toISOString().slice(0, 10);
    const wb = weekBuckets.get(weekKey) || { tokens: 0, cost: 0, completions: 0 };
    wb.tokens += entry.tokens || 0;
    wb.completions += entry.completions || 0;
    // Cost per day not available in heatmap — proportional estimate
    wb.cost += completionCount > 0 ? (entry.completions / completionCount) * totalCost : 0;
    weekBuckets.set(weekKey, wb);
  }

  // Models list
  const modelsResult = Object.entries(modelCounts)
    .map(([model, count]) => ({
      model,
      completions: count,
      tokens: modelTokensMap[model] || 0,
      cost: modelCostMap[model] || 0,
      percentage: totalTokens > 0 ? ((modelTokensMap[model] || 0) / totalTokens) * 100 : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // Streaks
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

  // Weekly trend periods
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
      .limit(5)
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

  // Badge evaluation
  const existingBadges: EarnedBadge[] = user.badges || [];
  const badgeStats = computeBadgeStats({
    totalTokens,
    completionCount,
    heatmap: heatmapData,
    models: modelCounts,
    timestamps: [], // yearly doc doesn't store individual timestamps; time-based badges evaluated via API
  });
  const allBadges: BadgeWithStatus[] = evaluateBadges(badgeStats, existingBadges);
  const newlyEarnedIds = getNewlyEarnedBadges(allBadges, existingBadges);

  // Persist newly earned badges
  if (newlyEarnedIds.length > 0) {
    const now = new Date().toISOString();
    const updatedBadges: EarnedBadge[] = [
      ...existingBadges,
      ...newlyEarnedIds.map((id) => ({ id, unlockedAt: now })),
    ];
    await adminDb.collection("users").doc(userDoc.id).update({ badges: updatedBadges });
    for (const b of allBadges) {
      if (newlyEarnedIds.includes(b.id)) {
        b.unlockedAt = now;
      }
    }
  }

  // Goals
  const goals: Goal[] = user.goals || [];

  // Spike detection
  const spike = detectSpike(heatmapData, todayDate);

  const initialUser = {
    displayName: user.displayName || "",
    bio: user.bio || "",
    location: user.location || "",
    website: user.website || "",
    avatarUrl: user.avatarUrl || "",
  };

  const hasOnboarded = user.hasOnboarded !== false;
  const apiKey = user.apiKey || "";
  const activeTab = (tab === "charts" || tab === "insights") ? tab : "overview";

  // Avatar ring tier
  const tierGradient: string =
    totalTokens >= 10_000_000 ? "conic-gradient(from 0deg, #b9f2ff, #e0f7ff, #7dd3fc, #38bdf8, #b9f2ff)" :
    totalTokens >= 1_000_000 ? "conic-gradient(from 0deg, #fbbf24, #fde68a, #f59e0b, #fbbf24)" :
    totalTokens >= 100_000 ? "conic-gradient(from 0deg, #d1d5db, #f3f4f6, #9ca3af, #d1d5db)" :
    "conic-gradient(from 0deg, #d97706, #fbbf24, #b45309, #d97706)";

  const tierName: string =
    totalTokens >= 10_000_000 ? "diamond" :
    totalTokens >= 1_000_000 ? "gold" :
    totalTokens >= 100_000 ? "silver" :
    "bronze";

  const avatarRingStyle: CSSProperties = { background: tierGradient };

  return (
    <div className="max-w-6xl mx-auto px-4">
      <OnboardingWrapper hasOnboarded={hasOnboarded} apiKey={apiKey} userId={userDoc.id} />
      <div className="relative hidden md:block h-[56px] mt-8">
        {user.avatarUrl && (
          <div className="absolute left-0 top-0 z-10 flex flex-col items-center">
            <div className="rounded-full p-[4px]" style={avatarRingStyle}>
              <img
                src={user.avatarUrl}
                alt={user.displayName || user.username}
                className="w-[200px] h-[200px] rounded-full border-4 border-white dark:border-gray-950 bg-white dark:bg-gray-950"
              />
            </div>
            <span className="text-[10px] font-mono-accent text-gray-400 dark:text-gray-600 mt-1 uppercase tracking-wider">{tierName}</span>
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
        {/* Sidebar */}
        <ProfileSidebar username={username} initialUser={initialUser} totalTokens={totalTokens} />

        <div className="flex-1 min-w-0">
          {spike.isSpike && <SpikeAlert multiplier={spike.multiplier} />}
          <BudgetProgress todayTokens={todayTokens} todayCost={todayCost} />
          <ProfileContent
            userId={userDoc.id}
            username={username}
            year={year}
            years={years}
            activeTab={activeTab}
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
            initialBadges={allBadges}
            initialNewlyEarned={newlyEarnedIds}
            initialGoals={goals}
          />
        </div>
      </div>
    </div>
  );
}
