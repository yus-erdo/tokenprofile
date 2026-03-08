"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { type User } from "firebase/auth";

interface OnboardingModalProps {
  apiKey: string;
  userId: string;
  onComplete: () => void;
}

const TOTAL_STEPS = 3;

export function OnboardingModal({ apiKey, userId, onComplete }: OnboardingModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  async function handleComplete() {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch("/api/users/me", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hasOnboarded: true }),
    });
    onComplete();
  }

  function nextStep() {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header with progress dots and skip */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  i + 1 === step
                    ? "bg-orange-500"
                    : i + 1 < step
                      ? "bg-orange-300 dark:bg-orange-700"
                      : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleComplete}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Step content */}
        <div key={step} className="animate-fade-in px-6 pb-6">
          {step === 1 && (
            <StepInterests onContinue={nextStep} user={user} />
          )}
          {step === 2 && (
            <StepInstallHook apiKey={apiKey} userId={userId} onContinue={nextStep} />
          )}
          {step === 3 && (
            <StepDone onComplete={handleComplete} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Step 1: Interests ---

const INTEREST_OPTIONS = [
  "See how much I'm spending on AI",
  "Understand which models I use most",
  "Track my coding activity over time",
  "Share my AI usage publicly",
  "Compare cost across different models",
  "Set budgets or spending alerts",
];

function StepInterests({ onContinue, user }: { onContinue: () => void; user: User | null }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggle(interest: string) {
    setSelected((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  async function handleContinue() {
    if (!user) { onContinue(); return; }
    setSaving(true);
    try {
      const token = await user.getIdToken();
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ interests: selected }),
      });
    } catch {
      // Non-critical — continue anyway
    }
    setSaving(false);
    onContinue();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">What matters most to you?</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Select any that apply — this helps us improve your experience.
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        {INTEREST_OPTIONS.map((interest) => (
          <button
            key={interest}
            onClick={() => toggle(interest)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              selected.includes(interest)
                ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            {interest}
          </button>
        ))}
      </div>
      <button
        onClick={handleContinue}
        disabled={saving}
        className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
      >
        {saving ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}

// --- Step 2: Install Hook ---

function StepInstallHook({ apiKey, userId, onContinue }: { apiKey: string; userId: string; onContinue: () => void }) {
  const [tab, setTab] = useState<"automatic" | "manual">("automatic");
  const [copiedCommand, setCopiedCommand] = useState(false);
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
      <h2 className="text-xl font-semibold mb-2">Install the hook</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Connect Claude Code to Token Profile to start tracking your usage.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setTab("automatic")}
          className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
            tab === "automatic"
              ? "bg-white dark:bg-gray-700 shadow-sm font-medium"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Automatic
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
            tab === "manual"
              ? "bg-white dark:bg-gray-700 shadow-sm font-medium"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Manual
        </button>
      </div>

      {/* Tab content */}
      {tab === "automatic" ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Run this command in your terminal:
          </p>
          <div className="relative">
            <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {autoCommand}
            </pre>
            <button
              onClick={() => copyText(autoCommand, setCopiedCommand)}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              {copiedCommand ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              1. Set your API key in your shell config:
            </p>
            <code className="block bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-xs font-mono">
              export TOKEN_PROFILE_API_KEY=&quot;{apiKey}&quot;
            </code>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              2. Add to <code className="text-xs">~/.claude/settings.json</code>:
            </p>
            <div className="relative">
              <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                {manualJson}
              </pre>
              <button
                onClick={() => copyText(manualJson, setCopiedJson)}
                className="absolute top-2 right-2 px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {copiedJson ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time verification */}
      <HookVerification userId={userId} />

      <button
        onClick={onContinue}
        className="w-full mt-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
      >
        Continue
      </button>
    </div>
  );
}

// --- Hook Verification (real-time Firestore listener) ---

function HookVerification({ userId }: { userId: string }) {
  const [verified, setVerified] = useState(false);
  const [eventInfo, setEventInfo] = useState<{ model: string; totalTokens: number } | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "events"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setVerified(true);
        setEventInfo({
          model: data.model || "unknown",
          totalTokens: data.totalTokens || 0,
        });
      }
    });

    return unsubscribe;
  }, [userId]);

  return (
    <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      {verified ? (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium">Hook is working!</p>
            {eventInfo && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Received: {eventInfo.model} · {eventInfo.totalTokens.toLocaleString()} tokens
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm">Waiting for your first event...</p>
        </div>
      )}
    </div>
  );
}

// --- Step 3: Done ---

function StepDone({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="text-center py-4">
      <h2 className="text-xl font-semibold mb-2">You&apos;re all set!</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Your profile is ready. Start using Claude Code and watch your activity appear.
      </p>
      <button
        onClick={onComplete}
        className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
      >
        Go to your profile
      </button>
    </div>
  );
}
