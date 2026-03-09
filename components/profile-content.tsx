"use client";

import { useState, type CSSProperties } from "react";
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

const STAT_BASE_STYLE: CSSProperties = {
  display: "inline-block",
};

export function ProfileContent({
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
  const [completions] = useState(initialCompletions);
  const [heatmapData] = useState(initialHeatmapData);
  const [totalTokens] = useState(initialTotalTokens);
  const [totalCost] = useState(initialTotalCost);
  const [favoriteModel] = useState(initialFavoriteModel);
  const [completionCount] = useState(initialCompletionCount);

  return (
    <div className="flex-1 min-w-0">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold" style={STAT_BASE_STYLE}>{completionCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Completions</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold" style={STAT_BASE_STYLE}>{totalTokens >= 1_000_000 ? `${(totalTokens / 1_000_000).toFixed(1)}M` : totalTokens >= 1_000 ? `${(totalTokens / 1_000).toFixed(1)}K` : totalTokens}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Tokens</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold" style={STAT_BASE_STYLE}>${totalCost.toFixed(2)}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Estimated Cost</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-2xl font-bold truncate text-sm" style={STAT_BASE_STYLE}>{favoriteModel}</div>
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
