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
import { db } from "@/lib/firebase/client";
import { Heatmap } from "@/components/heatmap";

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
}

function computeStats(completions: Completion[]) {
  const heatmapData: Record<string, { tokens: number; completions: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;
  const modelCounts: Record<string, number> = {};

  for (const s of completions) {
    const date = s.timestamp.split("T")[0] || "";
    const existing = heatmapData[date];
    heatmapData[date] = {
      tokens: (existing?.tokens ?? 0) + (s.totalTokens || 0),
      completions: (existing?.completions ?? 0) + 1,
    };
    totalTokens += s.totalTokens || 0;
    totalCost += Number(s.costUsd || 0);
    if (s.model) modelCounts[s.model] = (modelCounts[s.model] || 0) + 1;
  }

  const favoriteModel =
    Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return { heatmapData, totalTokens, totalCost, favoriteModel, completionCount: completions.length };
}

// Highlight styles as inline CSS — bypasses Tailwind processing entirely
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
}: ProfileContentProps) {
  const [completions, setCompletions] = useState(initialCompletions);
  const [heatmapData, setHeatmapData] = useState(initialHeatmapData);
  const [totalTokens, setTotalTokens] = useState(initialTotalTokens);
  const [totalCost, setTotalCost] = useState(initialTotalCost);
  const [favoriteModel, setFavoriteModel] = useState(initialFavoriteModel);
  const [completionCount, setCompletionCount] = useState(initialCompletionCount);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [statsFlash, setStatsFlash] = useState(false);
  const isFirstSnapshot = useRef(true);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const statsTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const flashHighlights = useCallback((ids: string[]) => {
    if (ids.length === 0) return;

    // Instant on (transition: none via inline style)
    setHighlightedIds((prev) => new Set([...prev, ...ids]));
    setStatsFlash(true);

    // Remove after brief hold → CSS transition fades out
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
    <div className="flex-1 min-w-0">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>{completionCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Completions</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>{(totalTokens / 1_000_000).toFixed(1)}M</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Tokens</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>${totalCost.toFixed(2)}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Estimated Cost</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold truncate text-sm" style={statsFlash ? STAT_FLASH_STYLE : STAT_BASE_STYLE}>{favoriteModel}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Top Model</div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {totalTokens.toLocaleString()} tokens in {year}
          </h2>
          <div className="flex gap-1">
            {years.map((y) => (
              <a
                key={y}
                href={`/${username}?year=${y}`}
                className={`px-2 py-1 text-xs rounded ${y === year ? "bg-blue-500 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              >
                {y}
              </a>
            ))}
          </div>
        </div>
        <Heatmap data={heatmapData} year={year} />
      </div>

      {/* Recent completions */}
      <h2 className="text-lg font-semibold mb-3">Recent Completions</h2>
      <div className="space-y-2">
        {completions.slice(0, 20).map((s) => (
          <div
            key={s.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 text-sm gap-2 sm:gap-3"
            style={highlightedIds.has(s.id) ? ROW_HIGHLIGHTED_STYLE : ROW_BASE_STYLE}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-medium truncate">{s.model || "unknown"}</span>
              <span className="text-gray-400 dark:text-gray-500 shrink-0">{s.provider}</span>
              {s.project && (
                <span className="text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded shrink-0">
                  {s.project}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400 shrink-0">
              <span>{(s.totalTokens || 0).toLocaleString()} tokens</span>
              <span>${Number(s.costUsd || 0).toFixed(4)}</span>
              <span>{new Date(s.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </div>
          </div>
        ))}
        {completions.length === 0 && (
          <p className="text-gray-400 dark:text-gray-500 text-center py-8">No completions recorded yet</p>
        )}
      </div>
    </div>
  );
}
