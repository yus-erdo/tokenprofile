"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { BentoGrid } from "@/components/ui/bento-grid";
import { BentoCard } from "@/components/ui/bento-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { ChartWrapper } from "@/lib/charts/apex-wrapper";
import { chartPalette } from "@/lib/charts/chart-colors";

interface ReportData {
  totalTokens: number;
  totalCost: number;
  completionCount: number;
  activeDays: number;
  topModel: string;
  peakDay: string;
  peakDayTokens: number;
  modelBreakdown: Record<
    string,
    { completions: number; tokens: number; cost: number }
  >;
  dailyActivity: Record<
    string,
    { tokens: number; completions: number; cost: number }
  >;
  comparison: {
    tokens: number | null;
    cost: number | null;
    completions: number | null;
    activeDays: number | null;
  };
  monthName: string;
  year: number;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

function ComparisonBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const isPositive = value > 0;
  const isNegative = value < 0;
  return (
    <span
      className={`text-xs font-mono-accent ml-2 ${
        isPositive
          ? "text-emerald-600 dark:text-emerald-400"
          : isNegative
            ? "text-red-500 dark:text-red-400"
            : "text-gray-500 dark:text-gray-400"
      }`}
    >
      {isPositive ? "\u2191" : isNegative ? "\u2193" : "\u2192"}
      {Math.abs(value)}% vs prev
    </span>
  );
}

function MiniHeatmap({
  dailyActivity,
  period,
}: {
  dailyActivity: Record<string, { tokens: number; completions: number; cost: number }>;
  period: string;
}) {
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const daysInMonth = new Date(year, month, 0).getDate();

  const days: { date: string; tokens: number }[] = [];
  let max = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const tokens = dailyActivity[dateStr]?.tokens || 0;
    if (tokens > max) max = tokens;
    days.push({ date: dateStr, tokens });
  }

  function getColor(value: number): string {
    if (value === 0) return "bg-gray-100 dark:bg-gray-800";
    const ratio = value / (max || 1);
    if (ratio < 0.25) return "bg-emerald-200 dark:bg-emerald-900";
    if (ratio < 0.5) return "bg-emerald-300 dark:bg-emerald-700";
    if (ratio < 0.75) return "bg-emerald-400 dark:bg-emerald-600";
    return "bg-emerald-500 dark:bg-emerald-500";
  }

  // Render as a 7-col grid (week view)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const paddedDays = [...Array(firstDayOfWeek).fill(null), ...days];

  return (
    <div className="grid grid-cols-7 gap-1">
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
        <div
          key={`h-${i}`}
          className="text-[9px] text-center text-gray-400 dark:text-gray-600 font-mono-accent"
        >
          {d}
        </div>
      ))}
      {paddedDays.map((day, i) => (
        <div
          key={i}
          className={`aspect-square rounded-sm ${day ? getColor(day.tokens) : ""}`}
          title={day ? `${day.date}: ${formatTokens(day.tokens)} tokens` : ""}
        />
      ))}
    </div>
  );
}

export default function ReportViewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const period = params.period as string;
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/sign-in");
      return;
    }

    async function loadReport() {
      try {
        // Try to fetch existing report via list endpoint
        const listRes = await fetch("/api/reports");
        if (listRes.ok) {
          const listData = await listRes.json();
          const existing = listData.reports.find(
            (r: { period: string }) => r.period === period
          );
          if (existing) {
            // Report exists, but we need full data - regenerate to get it
            // (the list endpoint only has summary)
          }
        }

        // Generate (or regenerate) the report
        const res = await fetch(`/api/reports/generate?month=${period}`, {
          method: "POST",
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to generate report");
          return;
        }

        const data = await res.json();
        setReport(data);
      } catch {
        setError("Failed to load report");
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [session, status, router, period]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-64" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg"
                />
              ))}
            </div>
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 font-mono-accent">
          {error || "report not found"}
        </p>
        <Link
          href="/reports"
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-mono-accent mt-4 inline-block"
        >
          &larr; back to reports
        </Link>
      </div>
    );
  }

  // Prepare chart data
  const modelLabels = Object.keys(report.modelBreakdown);
  const modelCompletions = modelLabels.map(
    (m) => report.modelBreakdown[m].completions
  );

  const dailyDates = Object.keys(report.dailyActivity).sort();
  const dailyTokens = dailyDates.map(
    (d) => report.dailyActivity[d].tokens
  );
  const dailyCompletions = dailyDates.map(
    (d) => report.dailyActivity[d].completions
  );

  const peakDate = report.peakDay
    ? new Date(report.peakDay).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "n/a";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
        <div className="mb-8">
          <Link
            href="/reports"
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-mono-accent mb-2 inline-block press-effect"
          >
            &larr; all reports
          </Link>
          <h1 className="text-xl font-bold font-mono-accent text-gray-900 dark:text-gray-100">
            ~ your {report.monthName} {report.year} report
          </h1>
        </div>

        {/* Key metrics */}
        <BentoGrid cols={4} className="mb-6">
          <BentoCard>
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2 font-mono-accent">
              ~ tokens
            </div>
            <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100">
              <AnimatedCounter
                value={report.totalTokens}
                format={formatTokens}
              />
            </div>
            <ComparisonBadge value={report.comparison.tokens} />
          </BentoCard>
          <BentoCard>
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2 font-mono-accent">
              ~ est. cost
            </div>
            <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100">
              <AnimatedCounter
                value={report.totalCost}
                format={(v) => `$${v.toFixed(2)}`}
              />
            </div>
            <ComparisonBadge value={report.comparison.cost} />
          </BentoCard>
          <BentoCard>
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2 font-mono-accent">
              ~ completions
            </div>
            <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100">
              <AnimatedCounter value={report.completionCount} />
            </div>
            <ComparisonBadge value={report.comparison.completions} />
          </BentoCard>
          <BentoCard>
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-2 font-mono-accent">
              ~ active days
            </div>
            <div className="text-2xl font-bold font-mono-accent text-gray-900 dark:text-gray-100">
              <AnimatedCounter value={report.activeDays} />
            </div>
            <ComparisonBadge value={report.comparison.activeDays} />
          </BentoCard>
        </BentoGrid>

        {/* Mini heatmap + Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <BentoCard>
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">
              ~ monthly activity
            </div>
            <MiniHeatmap
              dailyActivity={report.dailyActivity}
              period={period}
            />
          </BentoCard>
          <BentoCard>
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">
              ~ highlights
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono-accent">
                  peak day
                </div>
                <div className="text-sm font-bold font-mono-accent text-gray-900 dark:text-gray-100">
                  {peakDate}{" "}
                  <span className="font-normal text-gray-500 dark:text-gray-400">
                    ({formatTokens(report.peakDayTokens)} tokens)
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono-accent">
                  most used model
                </div>
                <div className="text-sm font-bold font-mono-accent text-gray-900 dark:text-gray-100 truncate">
                  {report.topModel}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono-accent">
                  avg tokens/day
                </div>
                <div className="text-sm font-bold font-mono-accent text-gray-900 dark:text-gray-100">
                  {report.activeDays > 0
                    ? formatTokens(
                        Math.round(report.totalTokens / report.activeDays)
                      )
                    : "0"}
                </div>
              </div>
            </div>
          </BentoCard>
        </div>

        {/* Model breakdown chart */}
        {modelLabels.length > 0 && (
          <BentoCard className="mb-6">
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">
              ~ model breakdown
            </div>
            <ChartWrapper
              type="donut"
              height={280}
              series={modelCompletions}
              options={{
                chart: {
                  background: "transparent",
                },
                labels: modelLabels,
                colors: chartPalette.slice(0, modelLabels.length),
                legend: {
                  position: "bottom",
                  fontFamily: "inherit",
                  labels: {
                    colors: "#9ca3af",
                  },
                },
                dataLabels: {
                  enabled: true,
                  style: {
                    fontFamily: "inherit",
                    fontSize: "11px",
                  },
                },
                stroke: {
                  show: false,
                },
                tooltip: {
                  theme: "dark",
                  y: {
                    formatter: (val: number) => `${val} completions`,
                  },
                },
                plotOptions: {
                  pie: {
                    donut: {
                      size: "55%",
                      labels: {
                        show: true,
                        total: {
                          show: true,
                          label: "total",
                          fontFamily: "inherit",
                          color: "#9ca3af",
                        },
                      },
                    },
                  },
                },
              }}
            />
          </BentoCard>
        )}

        {/* Daily activity chart */}
        {dailyDates.length > 0 && (
          <BentoCard className="mb-6">
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">
              ~ daily activity
            </div>
            <ChartWrapper
              type="area"
              height={250}
              series={[
                {
                  name: "tokens",
                  data: dailyTokens,
                },
              ]}
              options={{
                chart: {
                  background: "transparent",
                  toolbar: { show: false },
                  zoom: { enabled: false },
                },
                colors: ["#22c55e"],
                fill: {
                  type: "gradient",
                  gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.4,
                    opacityTo: 0.05,
                  },
                },
                stroke: {
                  curve: "smooth",
                  width: 2,
                },
                xaxis: {
                  categories: dailyDates.map((d) => {
                    const day = parseInt(d.split("-")[2]);
                    return String(day);
                  }),
                  labels: {
                    style: {
                      colors: "#9ca3af",
                      fontFamily: "inherit",
                      fontSize: "10px",
                    },
                  },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: {
                  labels: {
                    style: {
                      colors: "#9ca3af",
                      fontFamily: "inherit",
                      fontSize: "10px",
                    },
                    formatter: (val: number) => formatTokens(val),
                  },
                },
                grid: {
                  borderColor: "#374151",
                  strokeDashArray: 4,
                  xaxis: { lines: { show: false } },
                },
                tooltip: {
                  theme: "dark",
                  x: {
                    formatter: (_: number | string, opts?: { dataPointIndex?: number }) =>
                      dailyDates[opts?.dataPointIndex ?? 0] || "",
                  },
                  y: {
                    formatter: (val: number) =>
                      `${val.toLocaleString()} tokens`,
                  },
                },
                dataLabels: { enabled: false },
              }}
            />
          </BentoCard>
        )}

        {/* Daily completions bar chart */}
        {dailyDates.length > 0 && (
          <BentoCard>
            <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-3 font-mono-accent">
              ~ daily completions
            </div>
            <ChartWrapper
              type="bar"
              height={200}
              series={[
                {
                  name: "completions",
                  data: dailyCompletions,
                },
              ]}
              options={{
                chart: {
                  background: "transparent",
                  toolbar: { show: false },
                  zoom: { enabled: false },
                },
                colors: ["#10b981"],
                plotOptions: {
                  bar: {
                    borderRadius: 2,
                    columnWidth: "60%",
                  },
                },
                xaxis: {
                  categories: dailyDates.map((d) => {
                    const day = parseInt(d.split("-")[2]);
                    return String(day);
                  }),
                  labels: {
                    style: {
                      colors: "#9ca3af",
                      fontFamily: "inherit",
                      fontSize: "10px",
                    },
                  },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: {
                  labels: {
                    style: {
                      colors: "#9ca3af",
                      fontFamily: "inherit",
                      fontSize: "10px",
                    },
                  },
                },
                grid: {
                  borderColor: "#374151",
                  strokeDashArray: 4,
                  xaxis: { lines: { show: false } },
                },
                tooltip: {
                  theme: "dark",
                },
                dataLabels: { enabled: false },
              }}
            />
          </BentoCard>
      )}
    </div>
  );
}
