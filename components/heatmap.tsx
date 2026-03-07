"use client";

import { useEffect, useMemo, useState } from "react";

interface HeatmapProps {
  data: Record<string, number>; // { "2026-01-15": 45000, ... } date -> total_tokens
  year: number;
}

const DAYS = ["Mon", "", "Wed", "", "Fri", "", ""];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getColor(value: number, max: number, dark: boolean): string {
  if (value === 0) return dark ? "#161b22" : "#ebedf0";
  const ratio = value / max;
  if (ratio < 0.25) return dark ? "#0e4429" : "#9be9a8";
  if (ratio < 0.5) return dark ? "#006d32" : "#40c463";
  if (ratio < 0.75) return dark ? "#26a641" : "#30a14e";
  return dark ? "#39d353" : "#216e39";
}

export function Heatmap({ data, year }: HeatmapProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
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

    const weeksArr: { date: Date; value: number }[][] = [];
    let currentWeek: { date: Date; value: number }[] = [];
    let maxVal = 0;
    const monthPositions: { month: number; week: number }[] = [];

    const current = new Date(start);
    let weekIndex = 0;

    while (current <= endDate || currentWeek.length > 0) {
      const dateStr = current.toISOString().split("T")[0];
      const value = data[dateStr] || 0;
      if (value > maxVal) maxVal = value;

      if (current.getDate() === 1 && current >= startDate && current <= endDate) {
        monthPositions.push({ month: current.getMonth(), week: weekIndex });
      }

      currentWeek.push({ date: new Date(current), value });

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

  const svgWidth = labelWidth + weeks.length * (cellSize + gap);
  const svgHeight = headerHeight + 7 * (cellSize + gap) + 20;

  return (
    <div>
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
              fill={getColor(day.value, max, dark)}
            >
              <title>{day.date.toISOString().split("T")[0]}: {day.value.toLocaleString()} tokens</title>
            </rect>
          ))
        )}
        <g transform={`translate(${labelWidth + (weeks.length - 8) * (cellSize + gap)}, ${headerHeight + 7 * (cellSize + gap) + 5})`}>
          <text x={0} y={10} className="fill-gray-500" fontSize={10}>Less</text>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <rect key={i} x={30 + i * (cellSize + gap)} y={0} width={cellSize} height={cellSize} rx={2} fill={getColor(ratio === 0 ? 0 : ratio * 100, 100, dark)} />
          ))}
          <text x={30 + 5 * (cellSize + gap) + 4} y={10} className="fill-gray-500" fontSize={10}>More</text>
        </g>
      </svg>
    </div>
  );
}
