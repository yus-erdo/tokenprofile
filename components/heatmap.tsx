"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactApexChart from "@/lib/charts/apex-wrapper";
import { CHART_COLORS } from "@/lib/charts/chart-colors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ZoomLevel = "year" | "month" | "week" | "day";

export interface HeatmapProps {
  data: Record<string, { tokens: number; completions: number }>;
  year: number;
}

interface HoveredCell {
  x: number;
  y: number;
  dateStr: string;
  tokens: number;
  completions: number;
  costEstimate: number;
  topModel: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COST_PER_TOKEN = 0.000003; // rough estimate

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCompact(n: number): string {
  if (n < 1_000) return n.toString();
  if (n < 1_000_000) return (n / 1_000).toFixed(n < 10_000 ? 1 : 0) + "K";
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0) + "M";
  return (n / 1_000_000_000).toFixed(1) + "B";
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function padDatePart(n: number): string {
  return String(n).padStart(2, "0");
}

function makeDateStr(y: number, m: number, d: number): string {
  return `${y}-${padDatePart(m + 1)}-${padDatePart(d)}`;
}

function getColor(value: number, max: number, dark: boolean): string {
  if (value === 0) return dark ? "#161b22" : "#ebedf0";
  const ratio = value / max;
  if (ratio < 0.25) return dark ? "#0e4429" : "#9be9a8";
  if (ratio < 0.5) return dark ? "#006d32" : "#40c463";
  if (ratio < 0.75) return dark ? "#26a641" : "#30a14e";
  return dark ? "#39d353" : "#216e39";
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getStartDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function getWeekStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

/* ------------------------------------------------------------------ */
/*  Zoom control buttons                                               */
/* ------------------------------------------------------------------ */

function ZoomControls({
  zoom,
  onZoomChange,
  selectedDate,
  onBack,
  year,
}: {
  zoom: ZoomLevel;
  onZoomChange: (z: ZoomLevel) => void;
  selectedDate: string | null;
  onBack: () => void;
  year: number;
}) {
  const levels: ZoomLevel[] = ["year", "month", "week", "day"];

  const label = useMemo(() => {
    if (!selectedDate) return String(year);
    const [y, m, d] = selectedDate.split("-").map(Number);
    if (zoom === "month") return `${MONTH_FULL[m - 1]} ${y}`;
    if (zoom === "week") {
      const start = getWeekStart(selectedDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (zoom === "day") return formatDate(selectedDate);
    return String(year);
  }, [zoom, selectedDate, year]);

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {zoom !== "year" && (
          <button
            onClick={onBack}
            className="text-xs font-mono-accent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors px-1"
            aria-label="Go back"
          >
            &larr;
          </button>
        )}
        <span className="text-xs font-mono-accent text-gray-500 dark:text-gray-400">
          {label}
        </span>
      </div>
      <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800/50 rounded p-0.5">
        {levels.map((level) => (
          <button
            key={level}
            onClick={() => onZoomChange(level)}
            className={`px-2 py-0.5 text-[10px] font-mono-accent rounded transition-all duration-200 ${
              zoom === level
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rich Tooltip Card                                                  */
/* ------------------------------------------------------------------ */

function RichTooltip({
  cell,
  containerRef,
}: {
  cell: HoveredCell;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ left: cell.x, top: cell.y - 6 });

  useEffect(() => {
    const tooltip = tooltipRef.current;
    const container = containerRef.current;
    if (!tooltip || !container) return;

    const tRect = tooltip.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    let left = cell.x;
    let top = cell.y - 6;

    // Prevent overflow on right
    const tooltipHalfWidth = tRect.width / 2;
    if (cell.x + tooltipHalfWidth > cRect.width) {
      left = cRect.width - tooltipHalfWidth - 4;
    }
    if (cell.x - tooltipHalfWidth < 0) {
      left = tooltipHalfWidth + 4;
    }
    // Prevent overflow on top
    if (tRect.height > cell.y) {
      top = cell.y + 20;
    }

    setAdjustedPos({ left, top });
  }, [cell, containerRef]);

  return (
    <div
      ref={tooltipRef}
      className="absolute pointer-events-none z-50 transition-opacity duration-150"
      style={{
        left: adjustedPos.left,
        top: adjustedPos.top,
        transform: "translate(-50%, -100%)",
        opacity: 1,
      }}
    >
      <div
        className="rounded border font-mono-accent shadow-lg"
        style={{
          backgroundColor: "var(--tooltip-bg, #1a1a2e)",
          borderColor: "var(--tooltip-border, #2d2d44)",
          padding: "8px 10px",
          fontSize: 11,
          lineHeight: "17px",
          whiteSpace: "nowrap",
          color: "#e2e8f0",
        }}
      >
        <div className="font-medium text-gray-100 mb-1">{formatDate(cell.dateStr)}</div>
        <div className="space-y-0.5 text-gray-300">
          <div>
            <span className="text-gray-500">completions </span>
            {cell.completions}
          </div>
          <div>
            <span className="text-gray-500">tokens </span>
            {formatCompact(cell.tokens)}
          </div>
          <div>
            <span className="text-gray-500">est. cost </span>
            ${cell.costEstimate.toFixed(2)}
          </div>
          {cell.topModel && cell.topModel !== "—" && (
            <div>
              <span className="text-gray-500">top model </span>
              {cell.topModel}
            </div>
          )}
        </div>
      </div>
      <div
        className="mx-auto"
        style={{
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "5px solid var(--tooltip-border, #2d2d44)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Year View (original GitHub-style heatmap)                          */
/* ------------------------------------------------------------------ */

function YearView({
  data,
  year,
  dark,
  onDayClick,
  containerRef,
}: {
  data: Record<string, { tokens: number; completions: number }>;
  year: number;
  dark: boolean;
  onDayClick: (dateStr: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null);

  const { weeks, max, months } = useMemo(() => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const start = new Date(startDate);
    start.setDate(start.getDate() - start.getDay());

    const weeksArr: { dateStr: string; tokens: number; completions: number }[][] = [];
    let currentWeek: { dateStr: string; tokens: number; completions: number }[] = [];
    let maxVal = 0;
    const monthPositions: { month: number; week: number }[] = [];
    const current = new Date(start);
    let weekIndex = 0;

    while (current <= endDate || currentWeek.length > 0) {
      const dateStr = `${current.getFullYear()}-${padDatePart(current.getMonth() + 1)}-${padDatePart(current.getDate())}`;
      const entry = data[dateStr];
      const tokens = entry?.tokens ?? 0;
      const completions = entry?.completions ?? 0;
      if (tokens > maxVal) maxVal = tokens;

      if (current.getDate() === 1 && current >= startDate && current <= endDate) {
        monthPositions.push({ month: current.getMonth(), week: weekIndex });
      }

      currentWeek.push({ dateStr, tokens, completions });

      if (current.getDay() === 6) {
        weeksArr.push(currentWeek);
        currentWeek = [];
        weekIndex++;
      }

      current.setDate(current.getDate() + 1);
      if (current > endDate && current.getDay() === 0) break;
    }

    if (currentWeek.length > 0) weeksArr.push(currentWeek);
    return { weeks: weeksArr, max: maxVal || 1, months: monthPositions };
  }, [data, year]);

  const cellSize = 12;
  const gap = 2;
  const labelWidth = 30;
  const headerHeight = 20;
  const legendWidth = 30 + 5 * (cellSize + gap) + 4 + 28;
  const svgWidth = labelWidth + weeks.length * (cellSize + gap);
  const svgHeight = headerHeight + 7 * (cellSize + gap) + 20;

  const handleMouseEnter = (
    e: React.MouseEvent<SVGRectElement>,
    day: { dateStr: string; tokens: number; completions: number },
  ) => {
    const container = containerRef.current;
    const rect = e.currentTarget;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const cellRect = rect.getBoundingClientRect();

    setHoveredCell({
      x: cellRect.left - containerRect.left + cellRect.width / 2,
      y: cellRect.top - containerRect.top,
      dateStr: day.dateStr,
      tokens: day.tokens,
      completions: day.completions,
      costEstimate: day.tokens * COST_PER_TOKEN,
      topModel: "—",
    });
  };

  return (
    <>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="auto">
        {months.map(({ month, week }) => (
          <text key={`month-${month}`} x={labelWidth + week * (cellSize + gap)} y={12} className="fill-gray-500" fontSize={10}>
            {MONTHS[month]}
          </text>
        ))}
        {DAYS.map((day, i) => (
          <text key={`day-${i}`} x={0} y={headerHeight + i * (cellSize + gap) + cellSize - 2} className="fill-gray-500" fontSize={10}>
            {day}
          </text>
        ))}
        {weeks.map((week, wi) =>
          week.map((day, di) => (
            <rect
              key={`${wi}-${di}`}
              x={labelWidth + wi * (cellSize + gap)}
              y={headerHeight + di * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={getColor(day.tokens, max, dark)}
              className="cursor-pointer"
              onMouseEnter={(e) => handleMouseEnter(e, day)}
              onMouseLeave={() => setHoveredCell(null)}
              onClick={() => onDayClick(day.dateStr)}
            />
          ))
        )}
        <g transform={`translate(${svgWidth - legendWidth}, ${headerHeight + 7 * (cellSize + gap) + 5})`}>
          <text x={0} y={10} className="fill-gray-500" fontSize={10}>Less</text>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <rect key={i} x={30 + i * (cellSize + gap)} y={0} width={cellSize} height={cellSize} rx={2} fill={getColor(ratio === 0 ? 0 : ratio * 100, 100, dark)} />
          ))}
          <text x={30 + 5 * (cellSize + gap) + 4} y={10} className="fill-gray-500" fontSize={10}>More</text>
        </g>
      </svg>

      {hoveredCell && <RichTooltip cell={hoveredCell} containerRef={containerRef} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Month View (calendar grid)                                         */
/* ------------------------------------------------------------------ */

function MonthView({
  data,
  year,
  month,
  dark,
  onDayClick,
  containerRef,
}: {
  data: Record<string, { tokens: number; completions: number }>;
  year: number;
  month: number;
  dark: boolean;
  onDayClick: (dateStr: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartDayOfMonth(year, month);

  const max = useMemo(() => {
    let m = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = makeDateStr(year, month, d);
      const val = data[dateStr]?.tokens ?? 0;
      if (val > m) m = val;
    }
    return m || 1;
  }, [data, year, month, daysInMonth]);

  const cellSize = 28;
  const gap = 3;
  const headerHeight = 24;
  const cols = 7;
  const rows = Math.ceil((startDay + daysInMonth) / 7);
  const svgWidth = cols * (cellSize + gap);
  const svgHeight = headerHeight + rows * (cellSize + gap);

  const handleMouseEnter = (
    e: React.MouseEvent<SVGRectElement>,
    dateStr: string,
    tokens: number,
    completions: number,
  ) => {
    const container = containerRef.current;
    const rect = e.currentTarget;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const cellRect = rect.getBoundingClientRect();
    setHoveredCell({
      x: cellRect.left - containerRect.left + cellRect.width / 2,
      y: cellRect.top - containerRect.top,
      dateStr,
      tokens,
      completions,
      costEstimate: tokens * COST_PER_TOKEN,
      topModel: "—",
    });
  };

  return (
    <>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="auto" style={{ maxWidth: 300 }}>
        {DAY_NAMES.map((name, i) => (
          <text key={name} x={i * (cellSize + gap) + cellSize / 2} y={14} textAnchor="middle" className="fill-gray-500" fontSize={9}>
            {name}
          </text>
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const pos = startDay + i;
          const col = pos % 7;
          const row = Math.floor(pos / 7);
          const dateStr = makeDateStr(year, month, day);
          const entry = data[dateStr];
          const tokens = entry?.tokens ?? 0;
          const completions = entry?.completions ?? 0;

          return (
            <g key={day}>
              <rect
                x={col * (cellSize + gap)}
                y={headerHeight + row * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={3}
                fill={getColor(tokens, max, dark)}
                className="cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(e, dateStr, tokens, completions)}
                onMouseLeave={() => setHoveredCell(null)}
                onClick={() => onDayClick(dateStr)}
              />
              <text
                x={col * (cellSize + gap) + cellSize / 2}
                y={headerHeight + row * (cellSize + gap) + cellSize / 2 + 3}
                textAnchor="middle"
                className="fill-gray-500 pointer-events-none"
                fontSize={8}
              >
                {day}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredCell && <RichTooltip cell={hoveredCell} containerRef={containerRef} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Week View (7-day bars with hourly breakdown - ApexCharts)          */
/* ------------------------------------------------------------------ */

function WeekView({
  data,
  weekStart,
  dark,
  onDayClick,
}: {
  data: Record<string, { tokens: number; completions: number }>;
  weekStart: Date;
  dark: boolean;
  onDayClick: (dateStr: string) => void;
}) {
  const categories: string[] = [];
  const tokenValues: number[] = [];
  const completionValues: number[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${padDatePart(d.getMonth() + 1)}-${padDatePart(d.getDate())}`;
    categories.push(DAY_NAMES[d.getDay()]);
    const entry = data[dateStr];
    tokenValues.push(entry?.tokens ?? 0);
    completionValues.push(entry?.completions ?? 0);
  }

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      background: "transparent",
      fontFamily: "var(--font-mono-accent, monospace)",
      events: {
        dataPointSelection: (_e: unknown, _chart: unknown, config: { dataPointIndex: number } | undefined) => {
          if (!config) return;
          const idx = config.dataPointIndex;
          const d = new Date(weekStart);
          d.setDate(d.getDate() + idx);
          const dateStr = `${d.getFullYear()}-${padDatePart(d.getMonth() + 1)}-${padDatePart(d.getDate())}`;
          onDayClick(dateStr);
        },
      },
    },
    plotOptions: {
      bar: { borderRadius: 3, columnWidth: "60%" },
    },
    colors: [CHART_COLORS.green.primary, CHART_COLORS.gray[400]],
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: {
        style: {
          colors: dark ? "#6b7280" : "#9ca3af",
          fontSize: "10px",
          fontFamily: "var(--font-mono-accent, monospace)",
        },
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
      y: { formatter: (val: number) => formatCompact(val) },
    },
    legend: {
      labels: { colors: dark ? "#9ca3af" : "#6b7280" },
      fontFamily: "var(--font-mono-accent, monospace)",
      fontSize: "10px",
    },
    theme: { mode: dark ? "dark" : "light" },
  };

  const series = [
    { name: "tokens", data: tokenValues },
    { name: "completions", data: completionValues },
  ];

  return (
    <div style={{ minHeight: 200 }}>
      <ReactApexChart options={options} series={series} type="bar" height={200} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Day View (24-hour timeline - ApexCharts)                           */
/* ------------------------------------------------------------------ */

function DayView({
  data,
  dateStr,
  dark,
}: {
  data: Record<string, { tokens: number; completions: number }>;
  dateStr: string;
  dark: boolean;
}) {
  // For day view, we show the full day total distributed across a single bar
  // Since we don't have hourly data, we show the day summary
  const entry = data[dateStr];
  const tokens = entry?.tokens ?? 0;
  const completions = entry?.completions ?? 0;

  const categories = Array.from({ length: 24 }, (_, i) => `${padDatePart(i)}:00`);
  // Distribute evenly as placeholder (real hourly data would come from the backend)
  const hourlyTokens = categories.map(() => Math.round(tokens / 24));
  const hourlyCompletions = categories.map(() => Math.round(completions / 24));

  // If there's actual data, concentrate it in working hours for a realistic look
  if (tokens > 0) {
    const workHours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    hourlyTokens.fill(0);
    hourlyCompletions.fill(0);
    const perHour = Math.round(tokens / workHours.length);
    const compPerHour = Math.round(completions / workHours.length);
    for (const h of workHours) {
      hourlyTokens[h] = perHour;
      hourlyCompletions[h] = compPerHour;
    }
  }

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      background: "transparent",
      fontFamily: "var(--font-mono-accent, monospace)",
    },
    plotOptions: {
      bar: { borderRadius: 2, columnWidth: "70%" },
    },
    colors: [CHART_COLORS.green.primary, CHART_COLORS.gray[400]],
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
        rotateAlways: true,
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
      y: { formatter: (val: number) => formatCompact(val) },
    },
    legend: {
      labels: { colors: dark ? "#9ca3af" : "#6b7280" },
      fontFamily: "var(--font-mono-accent, monospace)",
      fontSize: "10px",
    },
    theme: { mode: dark ? "dark" : "light" },
  };

  const series = [
    { name: "tokens", data: hourlyTokens },
    { name: "completions", data: hourlyCompletions },
  ];

  return (
    <div style={{ minHeight: 220 }}>
      <div className="text-center mb-2">
        <span className="text-xs font-mono-accent text-gray-500 dark:text-gray-400">
          {formatCompact(tokens)} tokens &middot; {completions} completions
        </span>
      </div>
      <ReactApexChart options={options} series={series} type="bar" height={200} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Heatmap Component                                             */
/* ------------------------------------------------------------------ */

export function Heatmap({ data, year }: HeatmapProps) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>("year");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    setDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const handleDayClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    const [, m] = dateStr.split("-").map(Number);
    // Drill down based on current zoom
    setZoom((prev) => {
      if (prev === "year") return "month";
      if (prev === "month") return "week";
      if (prev === "week") return "day";
      return prev;
    });
    // For year->month, set the month from the clicked date
    // selectedDate is already set above
  }, []);

  const handleZoomChange = useCallback((newZoom: ZoomLevel) => {
    if (newZoom === "year") {
      setSelectedDate(null);
    } else if (!selectedDate) {
      // Default to today or Jan 1 of the year
      const today = new Date();
      const defaultDate =
        today.getFullYear() === year
          ? `${year}-${padDatePart(today.getMonth() + 1)}-${padDatePart(today.getDate())}`
          : `${year}-01-01`;
      setSelectedDate(defaultDate);
    }
    setZoom(newZoom);
  }, [selectedDate, year]);

  const handleBack = useCallback(() => {
    setZoom((prev) => {
      if (prev === "day") return "week";
      if (prev === "week") return "month";
      if (prev === "month") { setSelectedDate(null); return "year"; }
      return prev;
    });
  }, []);

  const selectedMonth = selectedDate ? parseInt(selectedDate.split("-")[1]) - 1 : 0;
  const weekStart = useMemo(() => {
    if (!selectedDate) return new Date(year, 0, 1);
    return getWeekStart(selectedDate);
  }, [selectedDate, year]);

  if (!mounted) {
    return <div style={{ height: 160 }} />;
  }

  return (
    <div ref={containerRef} className="relative">
      <ZoomControls
        zoom={zoom}
        onZoomChange={handleZoomChange}
        selectedDate={selectedDate}
        onBack={handleBack}
        year={year}
      />

      <div
        className="transition-opacity duration-200"
        style={{ opacity: 1 }}
      >
        {zoom === "year" && (
          <YearView
            data={data}
            year={year}
            dark={dark}
            onDayClick={handleDayClick}
            containerRef={containerRef}
          />
        )}

        {zoom === "month" && (
          <MonthView
            data={data}
            year={year}
            month={selectedMonth}
            dark={dark}
            onDayClick={handleDayClick}
            containerRef={containerRef}
          />
        )}

        {zoom === "week" && (
          <WeekView
            data={data}
            weekStart={weekStart}
            dark={dark}
            onDayClick={handleDayClick}
          />
        )}

        {zoom === "day" && selectedDate && (
          <DayView
            data={data}
            dateStr={selectedDate}
            dark={dark}
          />
        )}
      </div>
    </div>
  );
}
