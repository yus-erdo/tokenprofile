"use client";

import { useState, useEffect, useCallback } from "react";

interface OnboardingModalProps {
  apiKey: string;
  userId: string;
  onComplete: () => void;
}

const STEP_LABELS = ["Interests", "Setup", "Ready"];

export function OnboardingModal({ apiKey, userId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleComplete() {
    await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasOnboarded: true }),
    });
    onComplete();
  }

  function nextStep() {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={handleComplete} />

      {/* Modal */}
      <div className={`relative w-full max-w-[480px] mx-4 transition-all duration-500 ${mounted ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}>
        {/* Glow effect */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-orange-500/20 via-transparent to-transparent" />

        <div className="relative bg-white dark:bg-gray-950 rounded-2xl shadow-2xl shadow-black/20 border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Top accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

          {/* Header */}
          <div className="px-7 pt-6 pb-4">
            <div className="flex items-center justify-between mb-5">
              {/* Step indicator */}
              <div className="flex items-center gap-1">
                {STEP_LABELS.map((label, i) => {
                  const stepNum = i + 1;
                  const isCompleted = stepNum < step;
                  const isCurrent = stepNum === step;
                  const canClick = isCompleted;
                  return (
                  <div key={label} className="flex items-center">
                    <button
                      type="button"
                      disabled={!canClick}
                      onClick={() => canClick && setStep(stepNum)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                        canClick ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" : ""
                      } ${
                      isCurrent
                        ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        : isCompleted
                          ? "text-gray-400 dark:text-gray-500"
                          : "text-gray-300 dark:text-gray-700"
                    }`}>
                      <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold transition-all duration-300 ${
                        isCurrent
                          ? "bg-orange-500 text-white"
                          : isCompleted
                            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
                      }`}>
                        {isCompleted ? (
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          stepNum
                        )}
                      </span>
                      {isCurrent && <span>{label}</span>}
                    </button>
                    {i < STEP_LABELS.length - 1 && (
                      <div className={`w-6 h-px mx-0.5 transition-colors duration-300 ${
                        i + 1 < step ? "bg-gray-300 dark:bg-gray-700" : "bg-gray-100 dark:bg-gray-800"
                      }`} />
                    )}
                  </div>
                  );
                })}
              </div>

              <button
                onClick={handleComplete}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1 px-2 -mr-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Skip
              </button>
            </div>
          </div>

          {/* Step content */}
          <div key={step} className="animate-fade-in px-7 pb-7">
            {step === 1 && <StepInterests onContinue={nextStep} />}
            {step === 2 && <StepInstallHook apiKey={apiKey} userId={userId} onContinue={nextStep} />}
            {step === 3 && <StepDone onComplete={handleComplete} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Step 1: Interests ---

const INTEREST_OPTIONS = [
  { label: "Track my spending", icon: "dollar" },
  { label: "Compare models", icon: "switch" },
  { label: "Track coding activity", icon: "chart" },
  { label: "Share usage publicly", icon: "share" },
  { label: "Set budget alerts", icon: "bell" },
  { label: "Optimize costs", icon: "zap" },
] as const;

function InterestIcon({ type, className }: { type: string; className?: string }) {
  const cn = className || "w-3.5 h-3.5";
  switch (type) {
    case "dollar":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "switch":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
    case "chart":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
    case "share":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>;
    case "bell":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
    case "zap":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    default:
      return null;
  }
}

function StepInterests({ onContinue }: { onContinue: () => void }) {
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
    setSaving(true);
    try {
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      <h2 className="text-lg font-semibold tracking-tight mb-1">What matters most to you?</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Select any that apply — helps us tailor your experience.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {INTEREST_OPTIONS.map(({ label, icon }) => {
          const isSelected = selected.includes(label);
          return (
            <button
              key={label}
              onClick={() => toggle(label)}
              className={`group flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-left text-sm transition-all duration-200 border ${
                isSelected
                  ? "border-orange-500/50 bg-orange-50 dark:bg-orange-500/5 text-gray-900 dark:text-gray-100 shadow-sm shadow-orange-500/10"
                  : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
              }`}
            >
              <span className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-colors duration-200 ${
                isSelected
                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400"
              }`}>
                <InterestIcon type={icon} />
              </span>
              <span className="font-medium">{label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={handleContinue}
        disabled={saving}
        className="w-full py-2.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 text-white dark:text-gray-900 rounded-xl transition-all duration-200 text-sm font-medium"
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
      <h2 className="text-lg font-semibold tracking-tight mb-1">Install the hook</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Connect Claude Code to start tracking your usage automatically.
      </p>

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
      <HookVerification userId={userId} />

      <button
        onClick={onContinue}
        className="w-full mt-4 py-2.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-xl transition-all duration-200 text-sm font-medium"
      >
        Continue
      </button>
    </div>
  );
}

// --- Hook Verification (polling) ---

function HookVerification({ userId }: { userId: string }) {
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

// --- Step 3: Done ---

function StepDone({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="text-center py-6">
      {/* Animated checkmark */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 mb-5 shadow-lg shadow-orange-500/20">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold tracking-tight mb-2">You&apos;re all set!</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-[280px] mx-auto leading-relaxed">
        Start using Claude Code and watch your activity appear on your profile.
      </p>
      <button
        onClick={onComplete}
        className="w-full py-2.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-xl transition-all duration-200 text-sm font-medium"
      >
        Go to your profile
      </button>
    </div>
  );
}
