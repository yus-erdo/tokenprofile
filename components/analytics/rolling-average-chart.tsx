"use client";

import { useEffect, useMemo, useState } from "react";
import ReactApexChart from "@/lib/charts/apex-wrapper";
import { CHART_COLORS } from "@/lib/charts/chart-colors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RollingAverageChartProps {
  data: Record<string, { tokens: number; completions: number }>;
  year: number;
  height?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function padDatePart(n: number): string {
  return String(n).padStart(2, "0");
}

function formatCompact(n: number): string {
  if (n < 1_000) return n.toString();
  if (n < 1_000_000) return (n / 1_000).toFixed(n < 10_000 ? 1 : 0) + "K";
  return (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0) + "M";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RollingAverageChart({ data, year, height = 220 }: RollingAverageChartProps) {
  const [dark, setDark] = useState(false);
  const [showRolling, setShowRolling] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    setDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const { categories, dailyTokens, rollingAvg } = useMemo(() => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const today = new Date();
    const end = endDate < today ? endDate : today;

    const cats: string[] = [];
    const daily: number[] = [];

    const current = new Date(startDate);
    while (current <= end) {
      const dateStr = `${current.getFullYear()}-${padDatePart(current.getMonth() + 1)}-${padDatePart(current.getDate())}`;
      cats.push(dateStr);
      daily.push(data[dateStr]?.tokens ?? 0);
      current.setDate(current.getDate() + 1);
    }

    // Compute 7-day rolling average
    const rolling: (number | null)[] = [];
    for (let i = 0; i < daily.length; i++) {
      if (i < 6) {
        rolling.push(null);
      } else {
        let sum = 0;
        for (let j = i - 6; j <= i; j++) {
          sum += daily[j];
        }
        rolling.push(Math.round(sum / 7));
      }
    }

    // Format categories as month labels (show only first of month)
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedCats = cats.map((c) => {
      const [, m, d] = c.split("-").map(Number);
      if (d === 1) return months[m - 1];
      return "";
    });

    return { categories: formattedCats, dailyTokens: daily, rollingAvg: rolling };
  }, [data, year]);

  const series = useMemo(() => {
    const s: { name: string; type: string; data: (number | null)[] }[] = [
      {
        name: "daily tokens",
        type: "bar",
        data: dailyTokens,
      },
    ];
    if (showRolling) {
      s.push({
        name: "7-day avg",
        type: "line",
        data: rollingAvg as number[],
      });
    }
    return s;
  }, [dailyTokens, rollingAvg, showRolling]);

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "line",
      toolbar: { show: false },
      background: "transparent",
      fontFamily: "var(--font-mono-accent, monospace)",
    },
    stroke: {
      width: [0, 2.5],
      curve: "smooth",
    },
    plotOptions: {
      bar: {
        borderRadius: 1,
        columnWidth: "90%",
      },
    },
    colors: [
      dark ? CHART_COLORS.green.dark : CHART_COLORS.green.light,
      CHART_COLORS.green.primary,
    ],
    fill: {
      opacity: [0.6, 1],
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
        hideOverlappingLabels: true,
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
      shared: true,
      intersect: false,
      style: { fontFamily: "var(--font-mono-accent, monospace)", fontSize: "11px" },
      y: {
        formatter: (val: number) => (val != null ? formatCompact(val) + " tokens" : "—"),
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      labels: { colors: dark ? "#9ca3af" : "#6b7280" },
      fontFamily: "var(--font-mono-accent, monospace)",
      fontSize: "10px",
    },
    theme: { mode: dark ? "dark" : "light" },
  };

  const hasData = dailyTokens.some((t) => t > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600 font-mono-accent text-xs">
        no activity data to display
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">
          ~ daily activity
        </span>
        <button
          onClick={() => setShowRolling(!showRolling)}
          className={`px-2 py-0.5 text-[10px] font-mono-accent rounded transition-all duration-200 ${
            showRolling
              ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
              : "bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          7-day avg
        </button>
      </div>
      <ReactApexChart
        options={options}
        series={series}
        type="line"
        height={height}
      />
    </div>
  );
}
