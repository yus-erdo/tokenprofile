"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Budget {
  type: "tokens" | "cost";
  period: "daily" | "weekly" | "monthly";
  amount: number;
  warningPercent: number;
}

interface BudgetProgressProps {
  todayTokens: number;
  todayCost: number;
}

function formatValue(value: number, type: "tokens" | "cost"): string {
  if (type === "cost") return `$${value.toFixed(2)}`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function getBarColor(percent: number, warningPercent: number): string {
  if (percent >= 100) return "bg-red-500";
  if (percent >= warningPercent) return "bg-yellow-500";
  return "bg-emerald-500";
}

function getTextColor(percent: number, warningPercent: number): string {
  if (percent >= 100) return "text-red-500";
  if (percent >= warningPercent) return "text-yellow-500";
  return "text-emerald-500";
}

export function BudgetProgress({ todayTokens, todayCost }: BudgetProgressProps) {
  const { data: session } = useSession();
  const [budget, setBudget] = useState<Budget | null>(null);

  useEffect(() => {
    if (!session?.user?.firestoreId) return;

    async function fetchBudget() {
      try {
        const res = await fetch("/api/users/me");
        if (!res.ok) return;
        const data = await res.json();
        if (data.budget) {
          setBudget(data.budget);
        }
      } catch {
        // silently fail
      }
    }

    fetchBudget();
  }, [session?.user?.firestoreId]);

  if (!budget) return null;

  // Only daily budgets use today's values directly;
  // weekly/monthly would need aggregation — for now show daily
  const currentUsage = budget.type === "tokens" ? todayTokens : todayCost;
  const percent = budget.amount > 0 ? Math.min((currentUsage / budget.amount) * 100, 150) : 0;
  const displayPercent = Math.round(percent);

  const barColor = getBarColor(percent, budget.warningPercent);
  const textColor = getTextColor(percent, budget.warningPercent);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">
          ~ {budget.period} budget
        </span>
        <span className={`text-xs font-mono-accent font-medium ${textColor}`}>
          {displayPercent}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 font-mono-accent">
        {formatValue(currentUsage, budget.type)} / {formatValue(budget.amount, budget.type)} {budget.type === "tokens" ? "tokens" : ""} used
      </div>
    </div>
  );
}
