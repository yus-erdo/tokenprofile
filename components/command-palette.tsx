"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTheme } from "./theme-provider";

interface CommandItem {
  id: string;
  label: string;
  category: "navigation" | "actions";
  keywords: string;
  action: () => void;
}

function fuzzyMatch(text: string, query: string): { match: boolean; score: number; indices: number[] } {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const indices: number[] = [];
  let qi = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) {
      indices.push(ti);
      // Consecutive matches score higher
      if (lastMatchIndex === ti - 1) score += 3;
      // Start of word scores higher
      if (ti === 0 || lowerText[ti - 1] === " ") score += 2;
      score += 1;
      lastMatchIndex = ti;
      qi++;
    }
  }

  return { match: qi === lowerQuery.length, score, indices };
}

function HighlightedText({ text, indices }: { text: string; indices: number[] }) {
  const indexSet = new Set(indices);
  return (
    <span>
      {text.split("").map((char, i) =>
        indexSet.has(i) ? (
          <span key={i} className="text-orange-500 dark:text-orange-400 font-semibold">{char}</span>
        ) : (
          <span key={i}>{char}</span>
        )
      )}
    </span>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const username = session?.user?.username;

  const commands: CommandItem[] = [
    ...(username
      ? [
          {
            id: "nav-profile",
            label: "Go to Profile",
            category: "navigation" as const,
            keywords: "profile home overview",
            action: () => router.push(`/${username}`),
          },
          {
            id: "nav-developer",
            label: "Go to Developer",
            category: "navigation" as const,
            keywords: "developer api key hooks",
            action: () => router.push(`/${username}?tab=developer`),
          },
        ]
      : []),
    {
      id: "nav-settings",
      label: "Go to Settings",
      category: "navigation" as const,
      keywords: "settings preferences config",
      action: () => router.push("/settings"),
    },
    ...(username
      ? [
          {
            id: "action-export-csv",
            label: "Export Data (CSV)",
            category: "actions" as const,
            keywords: "export download csv data",
            action: () => {
              window.location.href = "/api/users/me/export?format=csv";
            },
          },
          {
            id: "action-export-json",
            label: "Export Data (JSON)",
            category: "actions" as const,
            keywords: "export download json data",
            action: () => {
              window.location.href = "/api/users/me/export?format=json";
            },
          },
        ]
      : []),
    {
      id: "action-theme",
      label: `Toggle Theme (${theme === "dark" ? "switch to light" : "switch to dark"})`,
      category: "actions" as const,
      keywords: "theme dark light mode toggle",
      action: () => {
        document.documentElement.classList.add("transitioning");
        setTimeout(() => document.documentElement.classList.remove("transitioning"), 350);
        setTheme(theme === "dark" ? "light" : "dark");
      },
    },
  ];

  const filtered = search.trim()
    ? commands
        .map((cmd) => {
          const labelResult = fuzzyMatch(cmd.label, search);
          const keywordResult = fuzzyMatch(cmd.keywords, search);
          const best = labelResult.score >= keywordResult.score ? labelResult : keywordResult;
          return { cmd, ...best, labelIndices: labelResult.match ? labelResult.indices : [] };
        })
        .filter((r) => r.match)
        .sort((a, b) => b.score - a.score)
        .map((r) => ({ ...r.cmd, matchIndices: r.labelIndices }))
    : commands.map((c) => ({ ...c, matchIndices: [] as number[] }));

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setSelectedIndex(0);
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) {
            setSearch("");
            setSelectedIndex(0);
          }
          return !prev;
        });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-command-item]");
    const item = items[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        close();
      }
    } else if (e.key === "Escape") {
      close();
    }
  }

  if (!open) return null;

  // Group filtered commands by category
  const navItems = filtered.filter((c) => c.category === "navigation");
  const actionItems = filtered.filter((c) => c.category === "actions");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={close}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm font-mono-accent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono-accent text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-600 font-mono-accent">
              No matching commands
            </div>
          )}

          {navItems.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">
                ~ navigation
              </div>
              {navItems.map((item) => {
                const globalIdx = filtered.indexOf(item);
                return (
                  <button
                    key={item.id}
                    data-command-item
                    onClick={() => {
                      item.action();
                      close();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-mono-accent text-left transition-colors ${
                      globalIdx === selectedIndex
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <HighlightedText text={item.label} indices={item.matchIndices} />
                  </button>
                );
              })}
            </>
          )}

          {actionItems.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mt-1">
                ~ actions
              </div>
              {actionItems.map((item) => {
                const globalIdx = filtered.indexOf(item);
                return (
                  <button
                    key={item.id}
                    data-command-item
                    onClick={() => {
                      item.action();
                      close();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-mono-accent text-left transition-colors ${
                      globalIdx === selectedIndex
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <HighlightedText text={item.label} indices={item.matchIndices} />
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-600 font-mono-accent">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">&#8593;&#8595;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">&#9166;</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteButton() {
  return (
    <button
      onClick={() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
        );
      }}
      className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title="Command palette (Cmd+K)"
      aria-label="Open command palette"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>
  );
}
