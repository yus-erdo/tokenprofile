"use client";

import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-48 text-gray-400 font-mono-accent text-xs">
      loading chart...
    </div>
  ),
});

export default ReactApexChart;
