"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface HeatmapProps {
  data: Record<string, { tokens: number; completions: number }>;
  year: number;
}

const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatCompact(n: number): string {
  if (n < 1_000) return n.toString();
  if (n < 1_000_000) return (n / 1_000).toFixed(n < 10_000 ? 1 : 0) + "K";
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0) + "M";
  return (n / 1_000_000_000).toFixed(1) + "B";
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getColor(value: number, max: number, dark: boolean): string {
  if (value === 0) return dark ? "#161b22" : "#ebedf0";
  const ratio = value / max;
  if (ratio < 0.25) return dark ? "#0e4429" : "#9be9a8";
  if (ratio < 0.5) return dark ? "#006d32" : "#40c463";
  if (ratio < 0.75) return dark ? "#26a641" : "#30a14e";
  return dark ? "#39d353" : "#216e39";
}

interface HoveredCell {
  x: number;
  y: number;
  dateStr: string;
  tokens: number;
  completions: number;
}

export function Heatmap({ data, year }: HeatmapProps) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null);
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
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
      const entry = data[dateStr];
      const tokens = entry?.tokens || 0;
      const completions = entry?.completions || 0;
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
    });
  };

  if (!mounted) {
    return <div style={{ height: svgHeight }} />;
  }

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height="auto"
      >
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
              onMouseEnter={(e) => handleMouseEnter(e, day)}
              onMouseLeave={() => setHoveredCell(null)}
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

      {hoveredCell && (
        <div
          className="absolute pointer-events-none transition-opacity duration-150"
          style={{
            left: hoveredCell.x,
            top: hoveredCell.y - 6,
            transform: "translate(-50%, -100%)",
            opacity: hoveredCell ? 1 : 0,
          }}
        >
          <div
            className="rounded-md px-2.5 py-1.5 text-white text-center shadow-md"
            style={{
              backgroundColor: "#24292f",
              fontSize: 11,
              lineHeight: "16px",
              whiteSpace: "nowrap",
            }}
          >
            <div className="font-medium">{formatDate(hoveredCell.dateStr)}</div>
            <div className="opacity-90">
              {hoveredCell.completions} completion{hoveredCell.completions !== 1 ? "s" : ""} · {formatCompact(hoveredCell.tokens)} tokens
            </div>
          </div>
          <div
            className="mx-auto"
            style={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #24292f",
            }}
          />
        </div>
      )}
    </div>
  );
}
