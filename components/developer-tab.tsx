"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";

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

      <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Installation</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Connect Claude Code to start tracking your usage automatically.
        </p>
        <InstallSection apiKey={data.apiKey} firestoreId={session!.user.firestoreId} />
      </section>
    </div>
  );
}

// --- Installation Section ---

function InstallSection({ apiKey, firestoreId }: { apiKey: string; firestoreId: string }) {
  const [tab, setTab] = useState<"automatic" | "manual">("automatic");
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const autoCommand = `curl -fsSL https://tokenprofile.app/api/hook-script | bash -s -- "${apiKey}"`;

  const manualJson = JSON.stringify(
    {
      hooks: {
        Stop: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command: "bash /path/to/tokenprofile-hook.sh",
              },
            ],
          },
        ],
      },
    },
    null,
    2
  );

  function copyText(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex mb-4 bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5">
        {(["automatic", "manual"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize ${
              tab === t
                ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mb-4">
        {tab === "automatic" ? (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Run this in your terminal:
            </p>
            {/* Terminal block */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <div className="w-2 h-2 rounded-full bg-red-400/60" />
                <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
                <div className="w-2 h-2 rounded-full bg-green-400/60" />
                <span className="text-[10px] text-gray-400 dark:text-gray-600 ml-1.5 font-mono">terminal</span>
              </div>
              <div className="relative bg-gray-950 p-3">
                <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all leading-relaxed pr-14">
                  <span className="text-gray-500">$ </span>{autoCommand}
                </pre>
                <button
                  onClick={() => copyText(autoCommand, setCopiedCommand)}
                  className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded transition-all duration-200 ${
                    copiedCommand
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {copiedCommand ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 text-[10px] font-bold mr-1.5">1</span>
                Add your API key to your shell config:
              </p>
              <div className="relative rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="bg-gray-950 p-3">
                  <code className="text-xs font-mono text-green-400">
                    <span className="text-gray-500">export </span>TOKEN_PROFILE_API_KEY=<span className="text-amber-400">&quot;{apiKey}&quot;</span>
                  </code>
                </div>
                <button
                  onClick={() => copyText(`export TOKEN_PROFILE_API_KEY="${apiKey}"`, setCopiedKey)}
                  className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded transition-all duration-200 ${
                    copiedKey
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {copiedKey ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-800 text-[10px] font-bold mr-1.5">2</span>
                Add to <code className="text-[11px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">~/.claude/settings.json</code>
              </p>
              <div className="relative rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="bg-gray-950 p-3">
                  <pre className="text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">{manualJson}</pre>
                </div>
                <button
                  onClick={() => copyText(manualJson, setCopiedJson)}
                  className={`absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded transition-all duration-200 ${
                    copiedJson
                      ? "bg-green-500/20 text-green-400"
                      : "bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {copiedJson ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Polling-based verification */}
      <HookVerification firestoreId={firestoreId} />
    </div>
  );
}

// --- Hook Verification (polling) ---

function HookVerification({ firestoreId }: { firestoreId: string }) {
  const [verified, setVerified] = useState(false);
  const [eventInfo, setEventInfo] = useState<{ model: string; totalTokens: number } | null>(null);
  const [since] = useState(() => new Date().toISOString());

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/me/latest-event?since=${encodeURIComponent(since)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.event) {
        setVerified(true);
        setEventInfo(data.event);
      }
    } catch {
      // ignore polling errors
    }
  }, [since]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  return (
    <div className={`rounded-xl border p-3.5 transition-all duration-500 ${
      verified
        ? "border-green-500/30 bg-green-50 dark:bg-green-500/5"
        : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50"
    }`}>
      {verified ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/15">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Hook is working!</p>
            {eventInfo && (
              <p className="text-xs text-green-600/70 dark:text-green-500/70 mt-0.5">
                {eventInfo.model} &middot; {eventInfo.totalTokens.toLocaleString()} tokens
              </p>
            )}
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
