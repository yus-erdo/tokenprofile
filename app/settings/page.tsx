"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  apiKey: string;
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in");
      return;
    }
    if (user) {
      user.getIdToken().then((token) => {
        fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then(setProfile);
      });
    }
  }, [user, loading, router]);

  async function handleSave() {
    if (!profile || !user) return;
    setSaving(true);
    const token = await user.getIdToken();
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        displayName: profile.displayName,
        bio: profile.bio,
      }),
    });
    if (res.ok) setMessage("Profile updated!");
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleRegenerateKey() {
    if (!user || !confirm("Regenerate API key? Your existing hooks will stop working.")) return;
    const token = await user.getIdToken();
    const res = await fetch("/api/users/me/regenerate-key", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.apiKey && profile) {
      setProfile({ ...profile, apiKey: data.apiKey });
      setMessage("API key regenerated!");
      setTimeout(() => setMessage(""), 3000);
    }
  }

  function copyApiKey() {
    if (!profile) return;
    navigator.clipboard.writeText(profile.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !profile) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {message && (
        <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg mb-4">{message}</div>
      )}

      <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
            <input
              type="text"
              value={profile.displayName || ""}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
            <textarea
              value={profile.bio || ""}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900"
            />
          </div>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </section>

      <section className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">API Key</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Use this key in your Claude Code hooks to push session data.</p>
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono truncate">{profile.apiKey}</code>
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
          Add a Stop hook to your Claude Code settings to automatically track token usage.
          See the README for the full hook script.
        </p>
      </section>
    </div>
  );
}
