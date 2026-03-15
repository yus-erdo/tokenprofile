"use client";

import { useState } from "react";

interface SpikeAlertProps {
  multiplier: number;
}

export function SpikeAlert({ multiplier }: SpikeAlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || multiplier < 2) return null;

  return (
    <div className="border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-yellow-600 dark:text-yellow-400 text-sm shrink-0">&#x26a0;</span>
        <span className="text-xs font-mono-accent text-yellow-800 dark:text-yellow-300 truncate">
          your usage today is {multiplier}x your 7-day average
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 text-sm shrink-0 ml-3 font-mono-accent press-effect"
        aria-label="Dismiss spike alert"
      >
        dismiss
      </button>
    </div>
  );
}
