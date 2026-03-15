"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { HookInstallGuide } from "@/components/hook-install-guide";

const RETENTION_OPTIONS = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
  { value: "2y", label: "2 years" },
  { value: "forever", label: "Forever" },
] as const;

interface RetentionData {
  period: string;
  updatedAt: string | null;
  dataRange: { earliest: string | null; latest: string | null };
}

interface UserData {
  username?: string;
  deletedAt?: string;
  deletionScheduledFor?: string;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);

  // Retention change confirmation
  const [pendingPeriod, setPendingPeriod] = useState<string | null>(null);

  const showMessage = useCallback((text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
  }, [session, status, router]);

  // Fetch retention settings and user data
  useEffect(() => {
    if (!session) return;

    fetch("/api/users/me/settings/retention")
      .then((r) => r.json())
      .then((d) => setRetention(d))
      .catch(() => {});

    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => {
        setUserData(d);
        if (d.apiKey) setApiKey(d.apiKey);
      })
      .catch(() => {});
  }, [session]);

  async function handleRetentionChange(period: string) {
    if (!retention) return;
    if (period === retention.period) return;

    // If changing to a shorter period, show confirmation
    if (period !== "forever") {
      setPendingPeriod(period);
      return;
    }

    await saveRetention(period);
  }

  async function saveRetention(period: string) {
    setSaving(true);
    setPendingPeriod(null);
    try {
      const res = await fetch("/api/users/me/settings/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (res.ok) {
        setRetention((prev) => (prev ? { ...prev, period } : prev));
        showMessage("Retention period updated", "success");
      } else {
        showMessage("Failed to update retention period", "error");
      }
    } catch {
      showMessage("Failed to update retention period", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCleanup() {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/users/me/cleanup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCleanupResult(`${data.deleted} event${data.deleted !== 1 ? "s" : ""} deleted`);
        // Refresh retention data to update data range
        const retRes = await fetch("/api/users/me/settings/retention");
        const retData = await retRes.json();
        setRetention(retData);
      } else {
        showMessage(data.error || "Cleanup failed", "error");
      }
    } catch {
      showMessage("Cleanup failed", "error");
    } finally {
      setCleaning(false);
    }
  }

  async function handleExport(format: string) {
    setExportingFormat(format);
    try {
      const res = await fetch(`/api/users/me/export?format=${format}`);
      if (!res.ok) {
        showMessage("Export failed", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `toqqen-export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage(`${format.toUpperCase()} export downloaded`, "success");
    } catch {
      showMessage("Export failed", "error");
    } finally {
      setExportingFormat(null);
    }
  }

  async function handleDeleteAccount() {
    if (!userData?.username || deleteConfirmText !== userData.username) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/users/me/delete", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setShowDeleteDialog(false);
        setDeleteConfirmText("");
        setUserData((prev) =>
          prev ? { ...prev, deletedAt: data.deletedAt, deletionScheduledFor: data.deletionScheduledFor } : prev,
        );
        showMessage("Account scheduled for deletion", "success");
      } else {
        showMessage(data.error || "Failed to delete account", "error");
      }
    } catch {
      showMessage("Failed to delete account", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCancelDeletion() {
    setCancellingDeletion(true);
    try {
      const res = await fetch("/api/users/me/cancel-deletion", { method: "POST" });
      if (res.ok) {
        setUserData((prev) => {
          if (!prev) return prev;
          const updated = { ...prev };
          delete updated.deletedAt;
          delete updated.deletionScheduledFor;
          return updated;
        });
        showMessage("Account deletion cancelled", "success");
      } else {
        const data = await res.json();
        showMessage(data.error || "Failed to cancel deletion", "error");
      }
    } catch {
      showMessage("Failed to cancel deletion", "error");
    } finally {
      setCancellingDeletion(false);
    }
  }

  async function handleRegenerateKey() {
    if (!confirm("Regenerate API key? Your existing hooks will stop working.")) return;
    try {
      const res = await fetch("/api/users/me/regenerate-key", { method: "POST" });
      const result = await res.json();
      if (result.apiKey) {
        setApiKey(result.apiKey);
        showMessage("API key regenerated", "success");
      }
    } catch {
      showMessage("Failed to regenerate key", "error");
    }
  }

  function copyApiKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (status === "loading" || !session) {
    return (
      <div className="p-8 text-center text-gray-500">Loading...</div>
    );
  }

  const isDeletionPending = !!userData?.deletedAt;
  const deletionDate = userData?.deletionScheduledFor ? new Date(userData.deletionScheduledFor) : null;
  const daysUntilDeletion = deletionDate
    ? Math.max(0, Math.ceil((deletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">~ settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 font-mono">data & privacy</p>

        {message && (
          <div
            className={`px-4 py-2 rounded-lg mb-6 text-sm ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Deletion pending banner */}
        {isDeletionPending && (
          <div className="border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  ~ account deletion scheduled
                </p>
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                  Your account will be permanently deleted in{" "}
                  <span className="font-mono font-bold">{daysUntilDeletion}</span> day
                  {daysUntilDeletion !== 1 ? "s" : ""}.
                  {deletionDate && (
                    <span className="text-red-500 dark:text-red-600">
                      {" "}({deletionDate.toLocaleDateString()})
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleCancelDeletion}
                disabled={cancellingDeletion}
                className="shrink-0 px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 disabled:opacity-50"
              >
                {cancellingDeletion ? "Cancelling..." : "Cancel Deletion"}
              </button>
            </div>
          </div>
        )}

        {/* API Key */}
        {apiKey && (
          <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-1">~ api key</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Use this key in your hooks to push completion data.
            </p>
            <div className="flex items-center gap-2 mb-4">
              <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono truncate">{apiKey}</code>
              <button onClick={copyApiKey} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-mono">
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={handleRegenerateKey} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 font-mono">
                Regenerate
              </button>
            </div>
          </section>
        )}

        {/* Installation */}
        {apiKey && (
          <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-1">~ setup</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Connect your AI coding tool to start tracking usage automatically.
            </p>
            <HookInstallGuide apiKey={apiKey} />
          </section>
        )}

        {/* Data Retention */}
        <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">~ data retention</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose how long to keep your usage data.
          </p>

          {retention && (
            <>
              {/* Data range */}
              {retention.dataRange.earliest && retention.dataRange.latest && (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    ~ your data spans from{" "}
                    <span className="text-gray-700 dark:text-gray-300">
                      {new Date(retention.dataRange.earliest).toLocaleDateString()}
                    </span>
                    {" "}to{" "}
                    <span className="text-gray-700 dark:text-gray-300">
                      {new Date(retention.dataRange.latest).toLocaleDateString()}
                    </span>
                  </p>
                </div>
              )}

              {/* Retention options */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                {RETENTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleRetentionChange(opt.value)}
                    disabled={saving}
                    className={`px-3 py-2 text-sm font-mono rounded-lg border transition-colors ${
                      retention.period === opt.value
                        ? "border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    } disabled:opacity-50`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Run cleanup button */}
              {retention.period !== "forever" && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCleanup}
                    disabled={cleaning}
                    className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    {cleaning ? "Cleaning up..." : "Run cleanup now"}
                  </button>
                  {cleanupResult && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{cleanupResult}</span>
                  )}
                </div>
              )}
            </>
          )}

          {!retention && (
            <div className="py-4 text-center text-sm text-gray-400">Loading retention settings...</div>
          )}
        </section>

        {/* Retention change confirmation dialog */}
        {pendingPeriod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-2">~ confirm retention change</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Changing your retention period to{" "}
                <span className="font-mono font-bold">
                  {RETENTION_OPTIONS.find((o) => o.value === pendingPeriod)?.label}
                </span>{" "}
                means data older than this period can be deleted when you run cleanup. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setPendingPeriod(null)}
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveRetention(pendingPeriod)}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Data */}
        <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">~ export data</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Download a copy of all your data. Includes profile info and usage events.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => handleExport("json")}
              disabled={!!exportingFormat}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 font-mono"
            >
              {exportingFormat === "json" ? "Exporting..." : "Export JSON"}
            </button>
            <button
              onClick={() => handleExport("csv")}
              disabled={!!exportingFormat}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 font-mono"
            >
              {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </section>

        {/* Delete Account */}
        <section className="border border-red-200 dark:border-red-900/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">~ danger zone</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Permanently delete your account and all associated data. You will have a 7-day grace period to cancel.
          </p>

          {!isDeletionPending ? (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              Delete Account
            </button>
          ) : (
            <p className="text-sm text-red-500 dark:text-red-400 font-mono">
              Deletion already scheduled. Use the banner above to cancel.
            </p>
          )}
        </section>

        {/* Delete confirmation dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">~ delete account</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This will permanently delete your account and all data after a 7-day grace period. To confirm,
                type your username below:
              </p>
              <div className="mb-4">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-mono">
                  ~ type &quot;{userData?.username}&quot; to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder={userData?.username || ""}
                  autoComplete="off"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeleteConfirmText("");
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== userData?.username}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Delete My Account"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sign out (convenience) */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-mono"
          >
            ~ sign out
          </button>
        </div>
      </div>
  );
}
