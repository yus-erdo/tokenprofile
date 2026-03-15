"use client";

import { useState, useMemo } from "react";
import { ChartWrapper } from "@/lib/charts/apex-wrapper";
import { chartColors } from "@/lib/charts/chart-colors";
import { useTheme } from "@/lib/charts/use-theme";

interface RadialClockChartProps {
  /** hourly data: index 0 = hour 0 (midnight), index 23 = hour 23 (11pm) */
  hourly: number[];
  /** optional second dataset for toggle (e.g., tokens vs completions) */
  hourlyAlt?: number[];
  label?: string;
  labelAlt?: string;
}

export function RadialClockChart({
  hourly,
  hourlyAlt,
  label = "completions",
  labelAlt = "tokens",
}: RadialClockChartProps) {
  const [metric, setMetric] = useState<"primary" | "alt">("primary");
  const isDark = useTheme();
  const colors = isDark ? chartColors.dark : chartColors.light;

  const data = metric === "alt" && hourlyAlt ? hourlyAlt : hourly;
  const activeLabel = metric === "alt" ? labelAlt : label;
  const total = data.reduce((a, b) => a + b, 0);
  const hasData = total > 0;

  const categories = useMemo(
    () => Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}h`),
    []
  );

  const formatTotal = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "polarArea",
      background: "transparent",
    },
    labels: categories,
    fill: {
      opacity: 0.85,
    },
    stroke: {
      width: 1,
      colors: [isDark ? "#1f2937" : "#e5e7eb"],
    },
    colors: data.map((val) => {
      if (!hasData) return colors.muted;
      const max = Math.max(...data);
      const intensity = max > 0 ? val / max : 0;
      if (isDark) {
        // from gray-800 to emerald-400
        const r = Math.round(31 + intensity * (52 - 31));
        const g = Math.round(41 + intensity * (211 - 41));
        const b = Math.round(55 + intensity * (153 - 55));
        return `rgb(${r},${g},${b})`;
      }
      // from gray-200 to emerald-500
      const r = Math.round(229 - intensity * (229 - 16));
      const g = Math.round(231 - intensity * (231 - 185));
      const b = Math.round(235 - intensity * (235 - 129));
      return `rgb(${r},${g},${b})`;
    }),
    plotOptions: {
      polarArea: {
        rings: {
          strokeWidth: 0,
        },
        spokes: {
          strokeWidth: 0.5,
          connectorColors: colors.border,
        },
      },
    },
    yaxis: {
      show: false,
    },
    legend: {
      show: false,
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      y: {
        formatter: (val: number) => {
          if (activeLabel === "tokens") return formatTotal(val);
          return String(val);
        },
      },
    },
  };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-600 font-mono-accent text-xs">
        <div className="mb-2">no hourly data yet</div>
        <div className="w-24 h-24 rounded-full border border-dashed border-gray-300 dark:border-gray-700" />
      </div>
    );
  }

  return (
    <div className="relative">
      {hourlyAlt && (
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setMetric("primary")}
            className={`px-2 py-0.5 text-[10px] rounded font-mono-accent transition-colors ${
              metric === "primary"
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {label}
          </button>
          <button
            onClick={() => setMetric("alt")}
            className={`px-2 py-0.5 text-[10px] rounded font-mono-accent transition-colors ${
              metric === "alt"
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {labelAlt}
          </button>
        </div>
      )}
      <div className="relative">
        <ChartWrapper
          type="polarArea"
          series={data}
          options={options}
          height={280}
        />
        {/* Center text overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center -mt-2">
            <div className="text-lg font-bold font-mono-accent text-gray-900 dark:text-gray-100">
              {formatTotal(total)}
            </div>
            <div className="text-[9px] text-gray-400 dark:text-gray-600 font-mono-accent">
              {activeLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
