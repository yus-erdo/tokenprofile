"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useTheme } from "@/lib/charts/use-theme";
import { chartColors } from "@/lib/charts/chart-colors";

type ApexChartProps = ComponentProps<typeof import("react-apexcharts").default>;

export function ChartWrapper(props: ApexChartProps) {
  const [Chart, setChart] = useState<typeof import("react-apexcharts").default | null>(null);
  const isDark = useTheme();

  useEffect(() => {
    import("react-apexcharts").then((mod) => setChart(() => mod.default));
  }, []);

  if (!Chart) {
    return (
      <div
        className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded"
        style={{ height: props.height ?? 200, width: props.width ?? "100%" }}
      />
    );
  }

  const colors = isDark ? chartColors.dark : chartColors.light;

  const mergedOptions: ApexCharts.ApexOptions = {
    ...props.options,
    theme: {
      mode: isDark ? "dark" : "light",
      ...props.options?.theme,
    },
    chart: {
      background: "transparent",
      fontFamily: "var(--font-mono-accent), ui-monospace, monospace",
      ...props.options?.chart,
      toolbar: { show: false, ...props.options?.chart?.toolbar },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      style: { fontFamily: "var(--font-mono-accent), ui-monospace, monospace", fontSize: "11px" },
      ...props.options?.tooltip,
    },
    legend: {
      labels: { colors: colors.text },
      fontFamily: "var(--font-mono-accent), ui-monospace, monospace",
      fontSize: "11px",
      ...props.options?.legend,
    },
  };

  return <Chart {...props} options={mergedOptions} />;
}

export default ChartWrapper;
