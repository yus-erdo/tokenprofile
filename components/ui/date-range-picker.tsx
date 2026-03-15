"use client";

import { useState, useEffect, useRef } from "react";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  label: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

const PRESETS: { label: string; from: () => string; to: () => string }[] = [
  { label: "Last 7 days", from: () => daysAgo(6), to: () => formatDate(new Date()) },
  { label: "Last 30 days", from: () => daysAgo(29), to: () => formatDate(new Date()) },
  { label: "Last 90 days", from: () => daysAgo(89), to: () => formatDate(new Date()) },
  { label: "This year", from: startOfYear, to: () => formatDate(new Date()) },
  { label: "All time", from: () => "2020-01-01", to: () => formatDate(new Date()) },
];

const STORAGE_KEY = "toqqen-date-range";

export function getStoredRange(): DateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.from && parsed.to && parsed.label) return parsed;
  } catch {
    // ignore
  }
  return null;
}

export function storeRange(range: DateRange) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
  } catch {
    // ignore
  }
}

export function getDefaultRange(): DateRange {
  return { from: startOfYear(), to: formatDate(new Date()), label: "This year" };
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function selectPreset(preset: (typeof PRESETS)[number]) {
    const range: DateRange = {
      from: preset.from(),
      to: preset.to(),
      label: preset.label,
    };
    storeRange(range);
    onChange(range);
    setOpen(false);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    const range: DateRange = { from: customFrom, to: customTo, label: "Custom" };
    storeRange(range);
    onChange(range);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono-accent border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 press-effect"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {value.label === "Custom" ? `${value.from} - ${value.to}` : value.label}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[240px] animate-fade-in">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-2">~ presets</div>
          <div className="flex flex-col gap-0.5 mb-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => selectPreset(preset)}
                className={`text-left px-2 py-1.5 text-xs font-mono-accent rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  value.label === preset.label
                    ? "text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-2">~ custom range</div>
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="flex-1 px-2 py-1 text-xs font-mono-accent bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="flex-1 px-2 py-1 text-xs font-mono-accent bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300"
              />
            </div>
            <button
              onClick={applyCustom}
              className="w-full px-2 py-1.5 text-xs font-mono-accent bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded hover:bg-gray-800 dark:hover:bg-gray-200 press-effect"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
