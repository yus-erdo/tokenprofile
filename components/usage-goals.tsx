"use client";

import { useState, useCallback } from "react";

export interface Goal {
  type: "daily_tokens" | "daily_completions";
  target: number;
}

interface UsageGoalsProps {
  goals: Goal[];
  todayTokens: number;
  todayCompletions: number;
  isOwner: boolean;
}

const GOAL_LABELS: Record<string, string> = {
  daily_tokens: "daily tokens",
  daily_completions: "daily completions",
};

function formatTarget(type: string, value: number): string {
  if (type === "daily_tokens") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  }
  return String(value);
}

function GoalBar({
  goal,
  current,
}: {
  goal: Goal;
  current: number;
}) {
  const progress = Math.min(current / goal.target, 1);
  const met = progress >= 1;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-[10px] font-mono-accent mb-0.5">
          <span className={met ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}>
            {GOAL_LABELS[goal.type] || goal.type}
          </span>
          <span className={met ? "text-green-600 dark:text-green-400 font-bold" : "text-gray-400 dark:text-gray-600"}>
            {formatTarget(goal.type, current)} / {formatTarget(goal.type, goal.target)}
            {met && " \u2713"}
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              met
                ? "bg-green-500 dark:bg-green-400"
                : "bg-gray-400 dark:bg-gray-500"
            }`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const PRESET_GOALS: { type: Goal["type"]; target: number; label: string }[] = [
  { type: "daily_tokens", target: 10_000, label: "10K tok/day" },
  { type: "daily_tokens", target: 50_000, label: "50K tok/day" },
  { type: "daily_tokens", target: 100_000, label: "100K tok/day" },
  { type: "daily_completions", target: 5, label: "5 comp/day" },
  { type: "daily_completions", target: 10, label: "10 comp/day" },
  { type: "daily_completions", target: 25, label: "25 comp/day" },
];

export function UsageGoals({ goals, todayTokens, todayCompletions, isOwner }: UsageGoalsProps) {
  const [currentGoals, setCurrentGoals] = useState<Goal[]>(goals);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const getCurrent = (type: string) => {
    if (type === "daily_tokens") return todayTokens;
    if (type === "daily_completions") return todayCompletions;
    return 0;
  };

  const toggleGoal = useCallback((type: Goal["type"], target: number) => {
    setCurrentGoals((prev) => {
      const exists = prev.find((g) => g.type === type && g.target === target);
      if (exists) return prev.filter((g) => !(g.type === type && g.target === target));
      return [...prev.filter((g) => g.type !== type), { type, target }];
    });
  }, []);

  const saveGoals = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/users/me/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: currentGoals }),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [currentGoals]);

  if (currentGoals.length === 0 && !isOwner) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">
          ~ daily goals
        </h2>
        {isOwner && (
          <button
            onClick={() => {
              if (editing) saveGoals();
              else setEditing(true);
            }}
            disabled={saving}
            className="text-[10px] font-mono-accent text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            {saving ? "saving..." : editing ? "save" : "edit"}
          </button>
        )}
      </div>

      {/* Goal progress bars */}
      {!editing && currentGoals.length > 0 && (
        <div className="space-y-2 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
          {currentGoals.map((goal) => (
            <GoalBar
              key={`${goal.type}-${goal.target}`}
              goal={goal}
              current={getCurrent(goal.type)}
            />
          ))}
        </div>
      )}

      {!editing && currentGoals.length === 0 && isOwner && (
        <button
          onClick={() => setEditing(true)}
          className="w-full border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 text-[10px] font-mono-accent text-gray-400 dark:text-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        >
          + set daily goals
        </button>
      )}

      {/* Editing mode */}
      {editing && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {PRESET_GOALS.map((preset) => {
              const active = currentGoals.some(
                (g) => g.type === preset.type && g.target === preset.target
              );
              return (
                <button
                  key={`${preset.type}-${preset.target}`}
                  onClick={() => toggleGoal(preset.type, preset.target)}
                  className={`text-[10px] font-mono-accent px-2 py-1.5 rounded border transition-colors ${
                    active
                      ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end mt-2 gap-2">
            <button
              onClick={() => {
                setCurrentGoals(goals);
                setEditing(false);
              }}
              className="text-[10px] font-mono-accent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              cancel
            </button>
            <button
              onClick={saveGoals}
              disabled={saving}
              className="text-[10px] font-mono-accent text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-bold"
            >
              {saving ? "saving..." : "save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
