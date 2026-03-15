"use client";

import { useEffect, useRef, useState, useCallback, useMemo, type CSSProperties } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/client";
import { Heatmap } from "@/components/heatmap";
import { StackedBarChart } from "@/components/analytics/stacked-bar-chart";
import { RollingAverageChart } from "@/components/analytics/rolling-average-chart";
import { BentoGrid } from "@/components/ui/bento-grid";
import { BentoCard } from "@/components/ui/bento-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { StatCardSkeleton, CompletionItemSkeleton } from "@/components/ui/skeleton";
import { PeakHoursChart } from "@/components/analytics/peak-hours-chart";
import { StreakDisplay } from "@/components/analytics/streak-display";
import { TrendsChart } from "@/components/analytics/trends-chart";
import { ModelBreakdown } from "@/components/analytics/model-breakdown";
import {
  DateRangePicker,
  type DateRange,
  getStoredRange,
  getDefaultRange,
  storeRange,
} from "@/components/ui/date-range-picker";
import { BadgeShowcase } from "@/components/badge-showcase";
import { UsageGoals, type Goal } from "@/components/usage-goals";
import type { BadgeWithStatus } from "@/lib/badges";
import { Sparkline } from "@/components/ui/sparkline";
import { RadialClockChart } from "@/components/analytics/radial-clock-chart";
import { UsageFlow } from "@/components/analytics/usage-flow";
import { TerminalBox } from "@/components/ui/terminal-box";

export interface Completion {
  id: string;
  model: string | null;
  provider: string | null;
  totalTokens: number;
  costUsd: number;
  project: string | null;
  timestamp: string;
}

export interface AnalyticsData {
  peakHours: {
    hourly: { hour: number; completions: number; tokens: number; cost: number }[];
    daily: { day: number; completions: number; tokens: number; cost: number }[];
  };
  trends: {
    periods: { period: string; tokens: number; cost: number; completions: number; change: { tokens: number; cost: number; completions: number } | null }[];
    granularity: string;
  };
  models: {
    models: { model: string; tokens: number; cost: number; completions: number; percentage: number }[];
    totalTokens: number;
  };
  streaks: {
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
  };
}

export type ProfileTab = "overview" | "charts" | "insights";

interface ProfileContentProps {
  userId: string;
  username: string;
  year: number;
  years: number[];
  activeTab: ProfileTab;
  initialCompletions: Completion[];
  initialHeatmapData: Record<string, { tokens: number; completions: number }>;
  initialTotalTokens: number;
  initialTotalCost: number;
  initialFavoriteModel: string;
  initialCompletionCount: number;
  initialTodayTokens: number;
  initialTodayCost: number;
  initialTodayCompletions: number;
  initialAnalytics?: AnalyticsData;
  initialBadges: BadgeWithStatus[];
  initialNewlyEarned: string[];
  initialGoals: Goal[];
}

function computeStats(completions: Completion[]) {
  const heatmapData: Record<string, { tokens: number; completions: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;
  let todayTokens = 0;
  let todayCost = 0;
  let todayCompletions = 0;
  const modelCounts: Record<string, number> = {};
  const modelTokens: Record<string, { input: number; output: number; total: number }> = {};
  const hourlyCompletions = new Array<number>(24).fill(0);
  const hourlyTokens = new Array<number>(24).fill(0);
  const todayDate = new Date().toISOString().split("T")[0];

  for (const s of completions) {
    const date = s.timestamp.split("T")[0] || "";
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
    if (s.model) {
      modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
      const mt = modelTokens[s.model] ?? { input: 0, output: 0, total: 0 };
      const tokens = s.totalTokens || 0;
      // Approximate split: 60% input, 40% output (when we don't have exact breakdown)
      mt.input += Math.round(tokens * 0.6);
      mt.output += Math.round(tokens * 0.4);
      mt.total += tokens;
      modelTokens[s.model] = mt;
    }
    // Extract hour from timestamp
    if (s.timestamp) {
      const hour = new Date(s.timestamp).getHours();
      if (hour >= 0 && hour < 24) {
        hourlyCompletions[hour] += 1;
        hourlyTokens[hour] += s.totalTokens || 0;
      }
    }
  }

  const favoriteModel =
    Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return {
    heatmapData,
    totalTokens,
    totalCost,
    favoriteModel,
    completionCount: completions.length,
    todayTokens,
    todayCost,
    todayCompletions,
    hourlyCompletions,
    hourlyTokens,
    modelTokens,
  };
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDay(completions: Completion[]): { date: string; label: string; items: Completion[] }[] {
  const groups: Map<string, Completion[]> = new Map();
  for (const c of completions) {
    const date = c.timestamp.split("T")[0] || "unknown";
    const existing = groups.get(date);
    if (existing) {
      existing.push(c);
    } else {
      groups.set(date, [c]);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  return Array.from(groups.entries()).map(([date, items]) => {
    let label: string;
    if (date === today) label = "today";
    else if (date === yesterday) label = "yesterday";
    else label = new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return { date, label, items };
  });
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

const ROW_BASE_STYLE: CSSProperties = {
  transition: "background-color 1.5s ease-out, box-shadow 1.5s ease-out, border-color 1.5s ease-out",
};

const ROW_HIGHLIGHTED_STYLE: CSSProperties = {
  backgroundColor: "rgba(250, 204, 21, 0.45)",
  boxShadow: "inset 4px 0 0 rgb(234, 179, 8), 0 0 16px rgba(234, 179, 8, 0.3)",
  borderColor: "rgb(234, 179, 8)",
  transition: "none",
};

const STAT_BASE_STYLE: CSSProperties = {
  transition: "color 1.5s ease-out, transform 1.5s ease-out",
  display: "inline-block",
};

const STAT_FLASH_STYLE: CSSProperties = {
  color: "rgb(250, 204, 21)",
  transform: "scale(1.08)",
  transition: "none",
  display: "inline-block",
};

function initDateRange(searchParams: URLSearchParams): DateRange {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from && to) {
    return { from, to, label: "Custom" };
  }
  // Don't read localStorage during SSR — defer to useEffect to avoid hydration mismatch
  return getDefaultRange();
}

export function ProfileContent({
  userId,
  username,
  year,
  years,
  activeTab,
  initialCompletions,
  initialHeatmapData,
  initialTotalTokens,
  initialTotalCost,
  initialFavoriteModel,
  initialCompletionCount,
  initialTodayTokens,
  initialTodayCost,
  initialTodayCompletions,
  initialAnalytics,
  initialBadges,
  initialNewlyEarned,
  initialGoals,
}: ProfileContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>(() => initDateRange(searchParams));

  // Hydrate date range from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to) return; // URL params take precedence
    const stored = getStoredRange();
    if (stored) setDateRange(stored);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [completions, setCompletions] = useState(initialCompletions);
  const [heatmapData, setHeatmapData] = useState(initialHeatmapData);
  const [totalTokens, setTotalTokens] = useState(initialTotalTokens);
  const [totalCost, setTotalCost] = useState(initialTotalCost);
  const [favoriteModel, setFavoriteModel] = useState(initialFavoriteModel);
  const [completionCount, setCompletionCount] = useState(initialCompletionCount);
  const [todayTokens, setTodayTokens] = useState(initialTodayTokens);
  const [todayCost, setTodayCost] = useState(initialTodayCost);
  const [todayCompletions, setTodayCompletions] = useState(initialTodayCompletions);
  const [hourlyCompletions, setHourlyCompletions] = useState<number[]>(() => {
    const initial = computeStats(initialCompletions);
    return initial.hourlyCompletions;
  });
  const [hourlyTokens, setHourlyTokens] = useState<number[]>(() => {
    const initial = computeStats(initialCompletions);
    return initial.hourlyTokens;
  });
  const [modelTokens, setModelTokens] = useState<Record<string, { input: number; output: number; total: number }>>(() => {
    const initial = computeStats(initialCompletions);
    return initial.modelTokens;
  });
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [statsFlash, setStatsFlash] = useState(false);
  const { data: session } = useSession();
  const isOwner = session?.user?.username === username;
  const isFirstSnapshot = useRef(true);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const statsTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
    storeRange(range);
    // Update URL query params for shareability
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", range.from);
    params.set("to", range.to);
    // Keep year param if present
    router.replace(`/${username}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, username]);

  const flashHighlights = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    setHighlightedIds((prev) => new Set([...prev, ...ids]));
    setStatsFlash(true);

    for (const id of ids) {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        id,
        setTimeout(() => {
          setHighlightedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          timers.current.delete(id);
        }, 1500)
      );
    }

    if (statsTimer.current) clearTimeout(statsTimer.current);
    statsTimer.current = setTimeout(() => setStatsFlash(false), 500);
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      if (statsTimer.current) clearTimeout(statsTimer.current);
    };
  }, []);

  useEffect(() => {
    isFirstSnapshot.current = true;
    const rangeStart = new Date(`${dateRange.from}T00:00:00Z`);
    const rangeEnd = new Date(`${dateRange.to}T23:59:59Z`);

    const q = query(
      collection(db, "events"),
      where("userId", "==", userId),
      where("timestamp", ">=", Timestamp.fromDate(rangeStart)),
      where("timestamp", "<=", Timestamp.fromDate(rangeEnd)),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newCompletions: Completion[] = snapshot.docs.map((doc) => {
        const s = doc.data();
        return {
          id: doc.id,
          model: s.model ?? null,
          provider: s.provider ?? null,
          totalTokens: s.totalTokens ?? 0,
          costUsd: s.costUsd ?? 0,
          project: s.project ?? null,
          timestamp: s.timestamp?.toDate?.().toISOString() || "",
        };
      });

      const stats = computeStats(newCompletions);
      setCompletions(newCompletions);
      setHeatmapData(stats.heatmapData);
      setTotalTokens(stats.totalTokens);
      setTotalCost(stats.totalCost);
      setFavoriteModel(stats.favoriteModel);
      setCompletionCount(stats.completionCount);
      setTodayTokens(stats.todayTokens);
      setTodayCost(stats.todayCost);
      setTodayCompletions(stats.todayCompletions);
      setHourlyCompletions(stats.hourlyCompletions);
      setHourlyTokens(stats.hourlyTokens);
      setModelTokens(stats.modelTokens);

      if (isFirstSnapshot.current) {
        isFirstSnapshot.current = false;
        return;
      }

      const changedIds = snapshot
        .docChanges()
        .filter((c) => c.type === "added" || c.type === "modified")
        .map((c) => c.doc.id);

      flashHighlights(changedIds);
    }, (err) => {
      // Silently handle permission errors — server-rendered data is still shown
      console.warn("Real-time listener failed:", err.code);
    });

    return () => unsubscribe();
  }, [userId, dateRange.from, dateRange.to, flashHighlights]);

  // Compute 14-day sparkline data from heatmap
  const sparklineData = useMemo(() => {
    const today = new Date();
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }
    return {
      completions: days.map((d) => heatmapData[d]?.completions ?? 0),
      tokens: days.map((d) => heatmapData[d]?.tokens ?? 0),
    };
  }, [heatmapData]);

  // Match heatmap color scale exactly (see heatmap.tsx getColor)
  const HEATMAP_SHADES_DARK = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const HEATMAP_SHADES_LIGHT = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

  const barSparkline = (data: number[]) => {
    const max = Math.max(...data) || 1;
    return (
      <div className="flex items-end gap-[2px] h-[18px]">
        {data.map((val, i) => {
          const ratio = max > 0 ? val / max : 0;
          // 5 levels matching heatmap: 0, <25%, <50%, <75%, >=75%
          const level = val === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
          return (
            <div
              key={i}
              className="flex-1 min-w-[3px]"
              style={{
                height: val === 0 ? '6%' : `${Math.max((val / max) * 100, 6)}%`,
                // Use CSS custom properties to pick dark/light shades
                backgroundColor: `var(--sparkline-${level})`,
              }}
            />
          );
        })}
      </div>
    );
  };

  const LABEL_CLASSES = "absolute -top-2 left-2 px-1.5 text-sm font-mono-accent text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-950 leading-none";

  const statCards = () => (
    <div className="border border-gray-300 dark:border-[#30363d] grid grid-cols-2 sm:grid-cols-4 mb-3">
      {/* Completions */}
      <div className="relative px-3 pt-3.5 pb-2">
        <span className={LABEL_CLASSES}>completions</span>
        <div className="flex items-baseline justify-between">
          <div className="text-3xl font-bold font-mono-accent text-gray-900 dark:text-gray-100" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
            <AnimatedCounter value={todayCompletions} />
          </div>
          <span className="text-xs text-gray-500 font-mono-accent">today</span>
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <div className="text-base font-mono-accent text-gray-500 dark:text-gray-400" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
            <AnimatedCounter value={completionCount} />
          </div>
          <span className="text-xs text-gray-500 font-mono-accent">{year}</span>
        </div>
        <div className="mt-1.5">{barSparkline(sparklineData.completions)}</div>
      </div>
      {/* Tokens */}
      <div className="relative px-3 pt-3.5 pb-2 border-l border-gray-300 dark:border-[#30363d]">
        <span className={LABEL_CLASSES}>tokens</span>
        <div className="flex items-baseline justify-between">
          <div className="text-3xl font-bold font-mono-accent text-gray-900 dark:text-gray-100" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
            <AnimatedCounter value={todayTokens} format={formatTokens} />
          </div>
          <span className="text-xs text-gray-500 font-mono-accent">today</span>
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <div className="text-base font-mono-accent text-gray-500 dark:text-gray-400" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
            <AnimatedCounter value={totalTokens} format={formatTokens} />
          </div>
          <span className="text-xs text-gray-500 font-mono-accent">{year}</span>
        </div>
        <div className="mt-1.5">{barSparkline(sparklineData.tokens)}</div>
      </div>
      {/* Cost */}
      <div className="relative px-3 pt-3.5 pb-2 border-t sm:border-t-0 sm:border-l border-gray-300 dark:border-[#30363d]">
        <span className={LABEL_CLASSES}>est. cost</span>
        <div className="flex items-baseline justify-between">
          <div className="text-3xl font-bold font-mono-accent text-gray-900 dark:text-gray-100" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
            <AnimatedCounter value={todayCost} format={(v) => `$${v.toFixed(0)}`} />
          </div>
          <span className="text-xs text-gray-500 font-mono-accent">today</span>
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <div className="text-base font-mono-accent text-gray-500 dark:text-gray-400" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
            <AnimatedCounter value={totalCost} format={(v) => `$${v.toFixed(0)}`} />
          </div>
          <span className="text-xs text-gray-500 font-mono-accent">{year}</span>
        </div>
      </div>
      {/* Top Model */}
      <div className="relative px-3 pt-3.5 pb-2 border-t border-l sm:border-t-0 border-gray-300 dark:border-[#30363d]">
        <span className={LABEL_CLASSES}>top model</span>
        <div className="text-lg font-bold truncate font-mono-accent text-gray-900 dark:text-gray-100 mt-0.5" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>{favoriteModel}</div>
        {initialAnalytics && initialAnalytics.models.models.length > 0 && (() => {
          const topModel = initialAnalytics.models.models[0];
          const pct = Math.round(topModel.percentage);
          return (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-[3px] bg-gray-200 dark:bg-[#21262d]">
                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-mono-accent text-gray-500">{pct}%</span>
            </div>
          );
        })()}
      </div>
    </div>
  );

  const heatmapSection = (mb: string = "mb-6") => (
    <TerminalBox label={`${completionCount} completions in ${year}`} className={mb}>
      <div className="flex items-center justify-end mb-2 gap-2 flex-wrap">
        <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
        <div className="flex gap-0.5">
          {years.map((y) => (
            <a
              key={y}
              href={`/${username}?year=${y}`}
              className={`px-2 py-0.5 text-[10px] font-mono-accent press-effect ${y === year ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            >
              {y}
            </a>
          ))}
        </div>
      </div>
      <Heatmap data={heatmapData} year={year} />
    </TerminalBox>
  );

  const activityFeed = () => isOwner ? (
    <TerminalBox label="activity feed">
      {completions.length === 0 ? (
        <p className="text-gray-500 text-center py-4 font-mono-accent text-xs">no completions recorded yet</p>
      ) : (
        <div className="space-y-0 font-mono-accent">
          {completions.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 py-1.5 border-b border-gray-100 dark:border-[#21262d] last:border-b-0"
              style={highlightedIds.has(s.id) ? ROW_HIGHLIGHTED_STYLE : ROW_BASE_STYLE}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate text-xs">{s.model || "unknown"}</span>
                {s.project && (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1 py-px shrink-0 border border-emerald-200 dark:border-emerald-800/50">
                    {s.project}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <span className="text-gray-700 dark:text-gray-300">{(s.totalTokens || 0).toLocaleString()} <span className="text-gray-400 dark:text-gray-600">tok</span></span>
                <span className="text-gray-700 dark:text-gray-300">${Number(s.costUsd || 0).toFixed(4)}</span>
                <span className="text-gray-500">{formatRelativeTime(s.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </TerminalBox>
  ) : null;

  // ─── OVERVIEW TAB ──────────────────────────────────────────────────
  if (activeTab === "overview") {
    return (
      <div className="flex-1 min-w-0">
        {statCards()}
        {heatmapSection("mb-3")}

        {/* Streaks — terminal box */}
        {isOwner && initialAnalytics && (
          <TerminalBox label="streaks" className="mb-3">
            <div className="space-y-0.5 font-mono-accent">
              {[
                { label: 'current streak', value: `${initialAnalytics.streaks.currentStreak}d` },
                { label: 'longest streak', value: `${initialAnalytics.streaks.longestStreak}d` },
                { label: 'active days', value: String(initialAnalytics.streaks.totalActiveDays) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.value}</span>
                </div>
              ))}
            </div>
          </TerminalBox>
        )}

        {activityFeed()}
      </div>
    );
  }

  // ─── CHARTS TAB ───────────────────────────────────────────────────
  if (activeTab === "charts") {
    return (
      <div className="flex-1 min-w-0 dot-grid-bg">
        {/* Rolling Average + Stacked Bar side by side */}
        <BentoGrid cols={2} className="mb-3">
          <BentoCard>
            <RollingAverageChart data={heatmapData} year={year} height={160} />
          </BentoCard>
          <BentoCard>
            <StackedBarChart completions={completions} year={year} height={160} />
          </BentoCard>
        </BentoGrid>

        {/* Activity Clock + Token Flow */}
        <BentoGrid cols={2} className="mb-3">
          <BentoCard>
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2 font-mono-accent">~ activity clock</div>
            <RadialClockChart hourly={hourlyCompletions} hourlyAlt={hourlyTokens} label="completions" labelAlt="tokens" height={200} />
          </BentoCard>
          <BentoCard>
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2 font-mono-accent">~ token flow</div>
            <UsageFlow modelTokens={modelTokens} />
          </BentoCard>
        </BentoGrid>

        {/* Trends + Peak Hours */}
        {isOwner && initialAnalytics && (
          <BentoGrid cols={2} className="mb-3">
            <BentoCard>
              <TrendsSection data={initialAnalytics.trends} />
            </BentoCard>
            <BentoCard>
              <PeakHoursChart data={initialAnalytics.peakHours} height={150} />
            </BentoCard>
          </BentoGrid>
        )}

        {/* Model Breakdown */}
        {isOwner && initialAnalytics && (
          <BentoCard className="mb-3">
            <ModelBreakdown data={initialAnalytics.models} />
          </BentoCard>
        )}
      </div>
    );
  }

  // ─── INSIGHTS TAB ─────────────────────────────────────────────────
  return (
    <div className="flex-1 min-w-0 dot-grid-bg">
      {/* Badges */}
      <BadgeShowcase
        initialBadges={initialBadges}
        initialNewlyEarned={initialNewlyEarned}
        isOwner={isOwner}
      />

      {/* Usage Goals */}
      <UsageGoals
        goals={initialGoals}
        todayTokens={todayTokens}
        todayCompletions={todayCompletions}
        isOwner={isOwner}
      />

      {/* Streaks — full display */}
      {isOwner && initialAnalytics && (
        <div className="mb-3">
          <StreakDisplay data={initialAnalytics.streaks} />
        </div>
      )}

      {/* Model Breakdown */}
      {isOwner && initialAnalytics && (
        <div className="mb-3">
          <ModelBreakdown data={initialAnalytics.models} />
        </div>
      )}

      {/* Peak Hours */}
      {isOwner && initialAnalytics && (
        <BentoCard>
          <PeakHoursChart data={initialAnalytics.peakHours} height={180} />
        </BentoCard>
      )}
    </div>
  );
}

// ─── TRENDS SECTION (with week/month toggle) ────────────────────────

function TrendsSection({ data }: { data: AnalyticsData["trends"] }) {
  const [granularity, setGranularity] = useState<'week' | 'month'>('week')

  const trends = granularity === 'month'
    ? {
        ...data,
        granularity: 'month',
        periods: (() => {
          const monthBuckets = new Map<string, { tokens: number; cost: number; completions: number }>();
          for (const p of data.periods) {
            const monthKey = p.period.slice(0, 7);
            const existing = monthBuckets.get(monthKey) || { tokens: 0, cost: 0, completions: 0 };
            existing.tokens += p.tokens; existing.cost += p.cost; existing.completions += p.completions;
            monthBuckets.set(monthKey, existing);
          }
          return Array.from(monthBuckets.entries())
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
        })(),
      }
    : data;

  return <TrendsChart data={trends} granularity={granularity} onGranularityChange={setGranularity} height={180} />;
}
