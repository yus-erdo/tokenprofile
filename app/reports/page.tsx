"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ReportSummary {
  id: string;
  period: string;
  type: string;
  generatedAt: string;
  summary: {
    totalTokens: number;
    totalCost: number;
    completionCount: number;
    activeDays: number;
  };
}

const monthNames = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

export default function ReportsListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/sign-in");
      return;
    }

    async function fetchReports() {
      try {
        const res = await fetch("/api/reports");
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, [session, status, router]);

  // Generate current month link
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-bold font-mono-accent text-gray-900 dark:text-gray-100">
            ~ reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono-accent mt-1">
            monthly usage reports
          </p>
        </div>

        {/* Quick action: view current month */}
        <Link
          href={`/reports/${currentPeriod}`}
          className="block mb-6 p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors press-effect"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-mono-accent text-gray-900 dark:text-gray-100">
                view {monthNames[now.getMonth()]} {now.getFullYear()} report
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono-accent mt-0.5">
                auto-generates if not available
              </div>
            </div>
            <span className="text-gray-400 dark:text-gray-600">&rarr;</span>
          </div>
        </Link>

        {/* Past reports */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-gray-50 dark:bg-gray-900 rounded-lg h-20 border border-gray-200 dark:border-gray-800"
              />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 dark:text-gray-500 font-mono-accent text-sm">
              no reports generated yet
            </p>
            <p className="text-gray-400 dark:text-gray-600 font-mono-accent text-xs mt-1">
              click above to generate your first report
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const [y, m] = report.period.split("-");
              const monthName = monthNames[parseInt(m) - 1];
              return (
                <Link
                  key={report.id}
                  href={`/reports/${report.period}`}
                  className="block p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-colors press-effect"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold font-mono-accent text-gray-900 dark:text-gray-100">
                        {monthName} {y}
                      </div>
                      <div className="flex gap-4 mt-1">
                        <span className="text-xs font-mono-accent text-gray-500 dark:text-gray-400">
                          {formatTokens(report.summary.totalTokens)} tokens
                        </span>
                        <span className="text-xs font-mono-accent text-gray-500 dark:text-gray-400">
                          ${report.summary.totalCost.toFixed(2)}
                        </span>
                        <span className="text-xs font-mono-accent text-gray-500 dark:text-gray-400">
                          {report.summary.completionCount} completions
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-400 dark:text-gray-600">&rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
  );
}
