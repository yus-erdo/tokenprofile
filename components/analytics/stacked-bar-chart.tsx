"use client";

import { useEffect, useMemo, useState } from "react";
import ReactApexChart from "@/lib/charts/apex-wrapper";
import { MODEL_COLORS, CHART_COLORS } from "@/lib/charts/chart-colors";
import type { Completion } from "@/components/profile-content";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StackedBarChartProps {
  completions: Completion[];
  year: number;
  height?: number;
}

type Granularity = "daily" | "weekly";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function padDatePart(n: number): string {
  return String(n).padStart(2, "0");
}

function getWeekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // ISO week start (Monday)
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return `${monday.getFullYear()}-${padDatePart(monday.getMonth() + 1)}-${padDatePart(monday.getDate())}`;
}

function formatCompact(n: number): string {
  if (n < 1_000) return n.toString();
  if (n < 1_000_000) return (n / 1_000).toFixed(n < 10_000 ? 1 : 0) + "K";
  return (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0) + "M";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StackedBarChart({ completions, year, height = 280 }: StackedBarChartProps) {
  const [dark, setDark] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>("weekly");

  useEffect(() => {
    const root = document.documentElement;
    setDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const { series, categories, models } = useMemo(() => {
    // Group completions by model and time bucket
    const modelMap: Record<string, Record<string, number>> = {};
    const bucketSet = new Set<string>();

    for (const c of completions) {
      const dateStr = c.timestamp.split("T")[0] || "";
      if (!dateStr) continue;

      const bucket = granularity === "daily" ? dateStr : getWeekKey(dateStr);
      bucketSet.add(bucket);

      const model = c.model || "unknown";
      if (!modelMap[model]) modelMap[model] = {};
      modelMap[model][bucket] = (modelMap[model][bucket] || 0) + (c.totalTokens || 0);
    }

    const sortedBuckets = [...bucketSet].sort();
    const modelNames = Object.keys(modelMap).sort(
      (a, b) => {
        const totalA = Object.values(modelMap[a]).reduce((s, v) => s + v, 0);
        const totalB = Object.values(modelMap[b]).reduce((s, v) => s + v, 0);
        return totalB - totalA;
      }
    );

    // Limit to top 8 models, group rest as "other"
    const topModels = modelNames.slice(0, 8);
    const otherModels = modelNames.slice(8);

    const seriesData: { name: string; data: number[]; color: string }[] = topModels.map((model, idx) => ({
      name: model,
      data: sortedBuckets.map((b) => modelMap[model][b] || 0),
      color: MODEL_COLORS[idx % MODEL_COLORS.length],
    }));

    if (otherModels.length > 0) {
      seriesData.push({
        name: "other",
        data: sortedBuckets.map((b) =>
          otherModels.reduce((sum, m) => sum + (modelMap[m][b] || 0), 0)
        ),
        color: CHART_COLORS.gray[500],
      });
    }

    // Format categories for display
    const catLabels = sortedBuckets.map((b) => {
      const [, m, d] = b.split("-").map(Number);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[m - 1]} ${d}`;
    });

    return {
      series: seriesData,
      categories: catLabels,
      models: topModels,
    };
  }, [completions, granularity]);

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "bar",
      stacked: true,
      toolbar: { show: false },
      background: "transparent",
      fontFamily: "var(--font-mono-accent, monospace)",
    },
    plotOptions: {
      bar: {
        borderRadius: 2,
        columnWidth: granularity === "daily" ? "80%" : "60%",
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: {
        style: {
          colors: dark ? "#6b7280" : "#9ca3af",
          fontSize: "9px",
          fontFamily: "var(--font-mono-accent, monospace)",
        },
        rotate: -45,
        rotateAlways: categories.length > 15,
        hideOverlappingLabels: true,
        maxHeight: 60,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: {
          colors: dark ? "#6b7280" : "#9ca3af",
          fontSize: "10px",
          fontFamily: "var(--font-mono-accent, monospace)",
        },
        formatter: (val: number) => formatCompact(val),
      },
    },
    grid: {
      borderColor: dark ? "#1f2937" : "#f3f4f6",
      strokeDashArray: 3,
    },
    tooltip: {
      theme: "dark",
      style: { fontFamily: "var(--font-mono-accent, monospace)", fontSize: "11px" },
      y: {
        formatter: (val: number) => formatCompact(val) + " tokens",
      },
    },
    legend: {
      position: "bottom",
      labels: { colors: dark ? "#9ca3af" : "#6b7280" },
      fontFamily: "var(--font-mono-accent, monospace)",
      fontSize: "10px",
      markers: { size: 6, shape: "square" as const },
    },
    theme: { mode: dark ? "dark" : "light" },
  };

  if (completions.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600 font-mono-accent text-xs">
        no model data to display
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">
          ~ tokens by model
        </span>
        <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800/50 rounded p-0.5">
          {(["daily", "weekly"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-2 py-0.5 text-[10px] font-mono-accent rounded transition-all duration-200 ${
                granularity === g
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <ReactApexChart
        options={options}
        series={series}
        type="bar"
        height={height}
      />
    </div>
  );
}
