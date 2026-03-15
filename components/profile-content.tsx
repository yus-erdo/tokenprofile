"use client";

import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { useSession } from "next-auth/react";
import { db } from "@/lib/firebase/client";
import { Heatmap } from "@/components/heatmap";
import { BentoGrid } from "@/components/ui/bento-grid";
import { BentoCard } from "@/components/ui/bento-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { StatCardSkeleton, CompletionItemSkeleton } from "@/components/ui/skeleton";

export interface Completion {
  id: string;
  model: string | null;
  provider: string | null;
  totalTokens: number;
  costUsd: number;
  project: string | null;
  timestamp: string;
}

interface ProfileContentProps {
  userId: string;
  username: string;
  year: number;
  years: number[];
  initialCompletions: Completion[];
  initialHeatmapData: Record<string, { tokens: number; completions: number }>;
  initialTotalTokens: number;
  initialTotalCost: number;
  initialFavoriteModel: string;
  initialCompletionCount: number;
  initialTodayTokens: number;
  initialTodayCost: number;
  initialTodayCompletions: number;
}

function computeStats(completions: Completion[]) {
  const heatmapData: Record<string, { tokens: number; completions: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;
  let todayTokens = 0;
  let todayCost = 0;
  let todayCompletions = 0;
  const modelCounts: Record<string, number> = {};
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
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
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

export function ProfileContent({
  userId,
  username,
  year,
  years,
  initialCompletions,
  initialHeatmapData,
  initialTotalTokens,
  initialTotalCost,
  initialFavoriteModel,
  initialCompletionCount,
  initialTodayTokens,
  initialTodayCost,
  initialTodayCompletions,
}: ProfileContentProps) {
  const [completions, setCompletions] = useState(initialCompletions);
  const [heatmapData, setHeatmapData] = useState(initialHeatmapData);
  const [totalTokens, setTotalTokens] = useState(initialTotalTokens);
  const [totalCost, setTotalCost] = useState(initialTotalCost);
  const [favoriteModel, setFavoriteModel] = useState(initialFavoriteModel);
  const [completionCount, setCompletionCount] = useState(initialCompletionCount);
  const [todayTokens, setTodayTokens] = useState(initialTodayTokens);
  const [todayCost, setTodayCost] = useState(initialTodayCost);
  const [todayCompletions, setTodayCompletions] = useState(initialTodayCompletions);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [statsFlash, setStatsFlash] = useState(false);
  const { data: session } = useSession();
  const isOwner = session?.user?.username === username;
  const isFirstSnapshot = useRef(true);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const statsTimer = useRef<ReturnType<typeof setTimeout>>(null);

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
    const startOfYear = new Date(`${year}-01-01T00:00:00Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59Z`);

    const q = query(
      collection(db, "events"),
      where("userId", "==", userId),
      where("timestamp", ">=", Timestamp.fromDate(startOfYear)),
      where("timestamp", "<=", Timestamp.fromDate(endOfYear)),
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

      if (isFirstSnapshot.current) {
        isFirstSnapshot.current = false;
        return;
      }

      const changedIds = snapshot
        .docChanges()
        .filter((c) => c.type === "added" || c.type === "modified")
        .map((c) => c.doc.id);

      flashHighlights(changedIds);
    });

    return () => unsubscribe();
  }, [userId, year, flashHighlights]);

  return (
    <div className="flex-1 min-w-0 dot-grid-bg">
      {/* Stats */}
      <BentoGrid cols={2} className="mb-6">
        <BentoCard>
          <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">~ completions</div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100 truncate" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
                <AnimatedCounter value={todayCompletions} />
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent mt-1">today</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-mono-accent text-gray-500 dark:text-gray-400" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
                <AnimatedCounter value={completionCount} />
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent">{year}</div>
            </div>
          </div>
        </BentoCard>
        <BentoCard>
          <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">~ tokens</div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100 truncate" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
                <AnimatedCounter value={todayTokens} format={formatTokens} />
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent mt-1">today</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-mono-accent text-gray-500 dark:text-gray-400" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
                <AnimatedCounter value={totalTokens} format={formatTokens} />
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent">{year}</div>
            </div>
          </div>
        </BentoCard>
        <BentoCard>
          <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">~ est. cost</div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100 truncate" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
                <AnimatedCounter value={todayCost} format={(v) => `$${v.toFixed(0)}`} />
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent mt-1">today</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-mono-accent text-gray-500 dark:text-gray-400" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>
                <AnimatedCounter value={totalCost} format={(v) => `$${v.toFixed(0)}`} />
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent">{year}</div>
            </div>
          </div>
        </BentoCard>
        <BentoCard>
          <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">~ top model</div>
          <div className="text-sm font-bold truncate font-mono-accent text-gray-900 dark:text-gray-100" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>{favoriteModel}</div>
        </BentoCard>
      </BentoGrid>

      {/* Heatmap */}
      <BentoCard className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">
            ~ <AnimatedCounter value={completionCount} /> completions in {year}
          </h2>
          <div className="flex gap-1">
            {years.map((y) => (
              <a
                key={y}
                href={`/${username}?year=${y}`}
                className={`px-2 py-1 text-xs rounded font-mono-accent press-effect ${y === year ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              >
                {y}
              </a>
            ))}
          </div>
        </div>
        <Heatmap data={heatmapData} year={year} />
      </BentoCard>

      {/* Activity feed — only visible to profile owner */}
      {isOwner && (
        <>
          <h2 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 font-mono-accent mb-3">~ activity feed</h2>
          {completions.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-center py-8 font-mono-accent text-sm">No completions recorded yet</p>
          ) : (
            <div className="space-y-0">
              {groupByDay(completions.slice(0, 30)).map((group) => (
                <div key={group.date}>
                  {/* Day header */}
                  <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                    <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">{group.label}</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                  </div>
                  {/* Timeline entries */}
                  <div className="ml-[3px] border-l-[2px] border-gray-200 dark:border-gray-800 pl-5 space-y-0">
                    {group.items.map((s) => (
                      <div
                        key={s.id}
                        className="relative py-2.5"
                        style={highlightedIds.has(s.id) ? ROW_HIGHLIGHTED_STYLE : ROW_BASE_STYLE}
                      >
                        {/* Timeline dot */}
                        <div className="absolute -left-[25px] top-[14px] w-[8px] h-[8px] rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950" />
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-medium font-mono-accent text-gray-900 dark:text-gray-100 truncate text-xs">{s.model || "unknown"}</span>
                            {s.project && (
                              <span className="text-xs font-mono-accent text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded shrink-0 border border-emerald-200 dark:border-emerald-800/50">
                                {s.project}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono-accent text-xs text-gray-700 dark:text-gray-300">{(s.totalTokens || 0).toLocaleString()} <span className="text-gray-400 dark:text-gray-600">tok</span></span>
                            <span className="font-mono-accent text-xs text-gray-700 dark:text-gray-300">${Number(s.costUsd || 0).toFixed(4)}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-500 font-mono-accent">{formatRelativeTime(s.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
