"use client";

import dynamic from "next/dynamic";
import type { Props as ApexProps } from "react-apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded h-[200px]" />
  ),
});

interface ChartWrapperProps extends ApexProps {
  className?: string;
}

export function ChartWrapper({ className, ...props }: ChartWrapperProps) {
  return (
    <div className={className}>
      <ReactApexChart {...props} />
    </div>
  );
}

export default ChartWrapper;
