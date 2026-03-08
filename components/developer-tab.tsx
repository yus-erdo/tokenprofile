"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { useEffect, useState } from "react";

interface DeveloperData {
  apiKey: string;
}

export function DeveloperTab() {
  const { user } = useAuth();
  const [data, setData] = useState<DeveloperData | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) => {
      fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => setData({ apiKey: d.apiKey }));
    });
  }, [user]);

  async function handleRegenerateKey() {
    if (!user || !confirm("Regenerate API key? Your existing hooks will stop working.")) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/users/me/regenerate-key", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
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
        <h2 className="text-lg font-semibold mb-4">Hook Setup</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Add a Stop hook to your Claude Code settings to automatically track completions.
          See the README for the full hook script.
        </p>
      </section>
    </div>
  );
}
