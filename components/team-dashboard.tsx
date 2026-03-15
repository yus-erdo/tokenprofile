"use client";

import Link from "next/link";
import { Heatmap } from "@/components/heatmap";
import { BentoGrid } from "@/components/ui/bento-grid";
import { BentoCard } from "@/components/ui/bento-card";

interface MemberData {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  visibility: string;
  stats: { tokens: number; cost: number; completions: number };
}

interface TeamDashboardProps {
  team: {
    id: string;
    name: string;
    slug: string;
    description: string;
  };
  myRole: string;
  members: MemberData[];
  heatmapData: Record<string, { tokens: number; completions: number }>;
  totalTokens: number;
  totalCost: number;
  totalCompletions: number;
  year: number;
  years: number[];
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

const roleBadgeClass: Record<string, string> = {
  owner: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50",
  admin: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50",
  member: "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

export function TeamDashboard({
  team,
  myRole,
  members,
  heatmapData,
  totalTokens,
  totalCost,
  totalCompletions,
  year,
  years,
}: TeamDashboardProps) {
  const isAdmin = myRole === "owner" || myRole === "admin";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono-accent">{team.name}</h1>
          {team.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono-accent mt-1">{team.description}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-600 font-mono-accent mt-2">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link
              href={`/teams/${team.slug}/settings`}
              className="px-3 py-1.5 text-xs font-mono-accent border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 press-effect"
            >
              settings
            </Link>
          )}
        </div>
      </div>

      {/* Team Stats */}
      <BentoGrid cols={3} className="mb-6">
        <BentoCard>
          <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">~ completions</div>
          <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100">
            {totalCompletions.toLocaleString()}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent mt-1">{year}</div>
        </BentoCard>
        <BentoCard>
          <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">~ tokens</div>
          <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100">
            {formatTokens(totalTokens)}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent mt-1">{year}</div>
        </BentoCard>
        <BentoCard>
          <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">~ est. cost</div>
          <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100">
            ${totalCost.toFixed(0)}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent mt-1">{year}</div>
        </BentoCard>
      </BentoGrid>

      {/* Team Heatmap */}
      <BentoCard className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">
            ~ <span>{totalTokens.toLocaleString()}</span> tokens in {year}
          </h2>
          <div className="flex gap-1">
            {years.map((y) => (
              <a
                key={y}
                href={`/teams/${team.slug}?year=${y}`}
                className={`px-2 py-1 text-xs rounded font-mono-accent press-effect ${y === year ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              >
                {y}
              </a>
            ))}
          </div>
        </div>
        <Heatmap data={heatmapData} year={year} />
      </BentoCard>

      {/* Members breakdown */}
      <h2 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-500 font-mono-accent mb-3">~ members</h2>
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        {members
          .sort((a, b) => {
            const order = { owner: 0, admin: 1, member: 2 };
            return (order[a.role as keyof typeof order] ?? 2) - (order[b.role as keyof typeof order] ?? 2);
          })
          .map((m, i) => (
            <div
              key={m.userId}
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 text-sm gap-2 sm:gap-3 ${i !== 0 ? "border-t border-gray-100 dark:border-gray-800/50" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {m.avatarUrl && (
                  <img
                    src={m.avatarUrl}
                    alt={m.displayName || m.username}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <Link href={`/${m.username}`} className="font-medium font-mono-accent text-gray-900 dark:text-gray-100 truncate text-xs hover:underline">
                  {m.displayName || m.username}
                </Link>
                <span className="text-gray-400 dark:text-gray-600 text-xs font-mono-accent">@{m.username}</span>
                <span className={`text-[10px] font-mono-accent px-1.5 py-0.5 rounded border ${roleBadgeClass[m.role] || roleBadgeClass.member}`}>
                  {m.role}
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {m.visibility !== "hidden" ? (
                  <>
                    <span className="font-mono-accent text-xs text-gray-700 dark:text-gray-300">
                      {formatTokens(m.stats.tokens)} <span className="text-gray-400 dark:text-gray-600">tok</span>
                    </span>
                    <span className="font-mono-accent text-xs text-gray-700 dark:text-gray-300">
                      ${m.stats.cost.toFixed(2)}
                    </span>
                    <span className="font-mono-accent text-xs text-gray-500 dark:text-gray-500">
                      {m.stats.completions} <span className="text-gray-400 dark:text-gray-600">comp</span>
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-600 font-mono-accent">stats hidden</span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
