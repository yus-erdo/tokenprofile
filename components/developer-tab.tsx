"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { HookInstallGuide } from "./hook-install-guide";

interface DeveloperData {
  apiKey: string;
}

export function DeveloperTab() {
  const { data: session } = useSession();
  const [data, setData] = useState<DeveloperData | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session) return;
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => setData({ apiKey: d.apiKey }));
  }, [session]);

  async function handleRegenerateKey() {
    if (!confirm("Regenerate API key? Your existing hooks will stop working.")) return;
    const res = await fetch("/api/users/me/regenerate-key", { method: "POST" });
    const result = await res.json();
    if (result.apiKey && data) {
      setData({ ...data, apiKey: result.apiKey });
      setMessage("API key regenerated!");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  function copyApiKey() {
    if (!data) return;
    navigator.clipboard.writeText(data.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!data) return <div className="py-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="flex-1 min-w-0">
      {message && (
        <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg mb-4">{message}</div>
      )}

      <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">API Key</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Use this key in your Claude Code hooks to push completion data.</p>
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono truncate">{data.apiKey}</code>
          <button onClick={copyApiKey} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={handleRegenerateKey} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600 dark:text-red-400">
            Regenerate
          </button>
        </div>
      </section>

      <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Export Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Download your completion history as CSV or JSON.</p>
        <ExportButtons />
      </section>

      <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Installation</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Connect your AI coding tool to start tracking usage automatically.
        </p>
        <InstallSection apiKey={data.apiKey} />
      </section>
    </div>
  );
}

// --- Export Section ---

function ExportButtons() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState("");

  async function handleExport(format: "csv" | "json") {
    setExporting(format);
    setExportMsg("");
    try {
      const res = await fetch(`/api/users/me/export?format=${format}`);
      if (res.status === 429) {
        setExportMsg("Rate limited. Please wait 1 minute between exports.");
        return;
      }
      if (!res.ok) {
        setExportMsg("Export failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `toqqen-export-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMsg(`${format.toUpperCase()} exported!`);
      setTimeout(() => setExportMsg(""), 3000);
    } catch {
      setExportMsg("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleExport("csv")}
          disabled={exporting !== null}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 font-mono-accent press-effect"
        >
          {exporting === "csv" ? "Exporting..." : "Download CSV"}
        </button>
        <button
          onClick={() => handleExport("json")}
          disabled={exporting !== null}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 font-mono-accent press-effect"
        >
          {exporting === "json" ? "Exporting..." : "Download JSON"}
        </button>
      </div>
      {exportMsg && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-mono-accent">{exportMsg}</p>
      )}
    </div>
  );
}

// --- Installation Section ---

function InstallSection({ apiKey }: { apiKey: string }) {
  return <HookInstallGuide apiKey={apiKey} footer={<HookStatus />} />;
}

// --- Hook Status ---

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function HookStatus() {
  const [status, setStatus] = useState<"loading" | "has-events" | "no-events">("loading");
  const [eventInfo, setEventInfo] = useState<{ model: string; totalTokens: number; createdAt: string } | null>(null);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me/latest-event");
      if (!res.ok) return;
      const data = await res.json();
      if (data.event) {
        setStatus("has-events");
        setEventInfo(data.event);
      } else {
        setStatus("no-events");
      }
    } catch {
      // ignore errors
    }
  }, []);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  // Poll only when no events yet
  useEffect(() => {
    if (status !== "no-events") return;
    const interval = setInterval(fetchLatest, 3000);
    return () => clearInterval(interval);
  }, [status, fetchLatest]);

  if (status === "loading") return null;

  return (
    <div className={`rounded-xl border p-3.5 transition-all duration-500 ${
      status === "has-events"
        ? "border-green-500/30 bg-green-50 dark:bg-green-500/5"
        : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50"
    }`}>
      {status === "has-events" && eventInfo ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/15">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Hook is connected</p>
            <p className="text-xs text-green-600/70 dark:text-green-500/70 mt-0.5">
              Last event {formatTimeAgo(eventInfo.createdAt)} &middot; {eventInfo.model} &middot; {eventInfo.totalTokens.toLocaleString()} tokens
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="w-3.5 h-3.5 border-2 border-gray-300 dark:border-gray-600 border-t-orange-500 rounded-full animate-spin" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for first event...</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Run a Claude Code completion to verify</p>
          </div>
        </div>
      )}
    </div>
  );
}
