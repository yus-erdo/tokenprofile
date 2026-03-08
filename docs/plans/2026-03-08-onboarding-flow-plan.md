# Onboarding Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a post-signup onboarding modal that collects user interests and guides hook installation with real-time verification.

**Architecture:** Client-side modal overlay rendered on the profile page, triggered when `hasOnboarded` is falsy on the user doc. Three steps: interests selection, hook installation (with tabs + Firestore real-time listener for verification), and completion screen. All steps skippable.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Firebase Firestore (client SDK for real-time listeners)

---

### Task 1: Update Data Model — Add `hasOnboarded` and `interests` Fields

**Files:**
- Modify: `app/sign-in/page.tsx:68-77` (add fields to new user doc)
- Modify: `app/api/users/me/route.ts:26-29` (allow PATCH of new fields)

**Step 1: Add `hasOnboarded: false` and `interests: []` to new user creation**

In `app/sign-in/page.tsx`, update the `setDoc` call at line 68:

```tsx
await setDoc(userRef, {
  username: githubUsername.toLowerCase().replace(/\s+/g, "-"),
  displayName: firebaseUser.displayName || "",
  bio: "",
  avatarUrl: firebaseUser.photoURL || "",
  location: githubLocation,
  website: githubBlog,
  apiKey: crypto.randomUUID() + crypto.randomUUID().replace(/-/g, ""),
  createdAt: new Date(),
  hasOnboarded: false,
  interests: [],
});
```

**Step 2: Allow PATCH of `hasOnboarded` and `interests`**

In `app/api/users/me/route.ts`, update the `allowed` array at line 26:

```ts
const allowed = ["displayName", "bio", "location", "website", "hasOnboarded", "interests"];
```

**Step 3: Redirect new users to their profile instead of /settings**

In `app/sign-in/page.tsx`, change the new-user redirect at line 91 from `router.push("/settings")` to navigate to the profile (the onboarding modal will appear there automatically):

```tsx
// After setDoc for new users, get the username we just created
const newUsername = githubUsername.toLowerCase().replace(/\s+/g, "-");
router.push(`/${newUsername}`);
```

Note: The existing user redirect at line 89 stays the same.

**Step 4: Verify locally**

Run: `bun dev`
- Sign in as a new user → should redirect to profile page (not /settings)
- Check Firestore document has `hasOnboarded: false` and `interests: []`

**Step 5: Commit**

```bash
git add app/sign-in/page.tsx app/api/users/me/route.ts
git commit -m "Add hasOnboarded and interests fields to user data model"
```

---

### Task 2: Create the Onboarding Modal Shell

**Files:**
- Create: `components/onboarding-modal.tsx`
- Modify: `app/[username]/page.tsx` (render the modal)

**Step 1: Build the modal component with step navigation**

Create `components/onboarding-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";

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

  function handleSkip() {
    handleComplete();
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
                className={`w-2 h-2 rounded-full transition-colors ${
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
            onClick={handleSkip}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Step content */}
        <div className="px-6 pb-6">
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
```

The individual step components (`StepInterests`, `StepInstallHook`, `StepDone`) will be implemented in the next tasks. For now, add placeholder implementations in the same file:

```tsx
function StepInterests({ onContinue, user }: { onContinue: () => void; user: any }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">What matters most to you?</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Select any that apply — this helps us improve your experience.</p>
      <button onClick={onContinue} className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium">
        Continue
      </button>
    </div>
  );
}

function StepInstallHook({ apiKey, userId, onContinue }: { apiKey: string; userId: string; onContinue: () => void }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Install the hook</h2>
      <button onClick={onContinue} className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium">
        Continue
      </button>
    </div>
  );
}

function StepDone({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="text-center py-4">
      <h2 className="text-xl font-semibold mb-2">You're all set!</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Your profile is ready. Start using Claude Code and watch your activity appear.</p>
      <button onClick={onComplete} className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium">
        Go to your profile
      </button>
    </div>
  );
}
```

**Step 2: Wire the modal into the profile page**

The profile page (`app/[username]/page.tsx`) is a server component. We need a thin client wrapper that checks `hasOnboarded` and renders the modal.

Create a wrapper approach: pass `hasOnboarded` and `apiKey` as props from the server component into a new client component that conditionally renders the modal.

In `app/[username]/page.tsx`, add to the server component:

1. After fetching the user doc (line 29), extract `hasOnboarded` and `apiKey`:
```tsx
const hasOnboarded = user.hasOnboarded !== false; // treat missing as onboarded (existing users)
const apiKey = user.apiKey || "";
```

2. Import and render the `OnboardingModal` via a client wrapper at the end of the JSX (inside the outer div, before closing `</div>`):
```tsx
<OnboardingWrapper
  hasOnboarded={hasOnboarded}
  apiKey={apiKey}
  userId={userDoc.id}
/>
```

Create `components/onboarding-wrapper.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { OnboardingModal } from "./onboarding-modal";

interface Props {
  hasOnboarded: boolean;
  apiKey: string;
  userId: string;
}

export function OnboardingWrapper({ hasOnboarded, apiKey, userId }: Props) {
  const { user } = useAuth();
  const [show, setShow] = useState(!hasOnboarded);

  // Only show for the profile owner
  if (!user || user.uid !== userId || !show) return null;

  return <OnboardingModal apiKey={apiKey} userId={userId} onComplete={() => setShow(false)} />;
}
```

**Step 3: Verify locally**

Run: `bun dev`
- New user sign-in → should see modal overlay on profile
- Skip button → modal closes, `hasOnboarded: true` set in Firestore
- Refresh → modal should NOT appear again

**Step 4: Commit**

```bash
git add components/onboarding-modal.tsx components/onboarding-wrapper.tsx app/[username]/page.tsx
git commit -m "Add onboarding modal shell with step navigation"
```

---

### Task 3: Implement Step 1 — Interests Selection

**Files:**
- Modify: `components/onboarding-modal.tsx` (replace `StepInterests` placeholder)

**Step 1: Implement the interests pill selector**

Replace the `StepInterests` placeholder in `components/onboarding-modal.tsx`:

```tsx
import { useState } from "react";
import { type User } from "firebase/auth";

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
```

**Step 2: Verify locally**

Run: `bun dev`
- Modal step 1 shows pill buttons for each interest
- Clicking toggles selection state (orange border + fill)
- Continue saves interests to Firestore and advances to step 2
- Continue works with zero selections (skippable)

**Step 3: Commit**

```bash
git add components/onboarding-modal.tsx
git commit -m "Implement interests selection step in onboarding"
```

---

### Task 4: Implement Step 2 — Hook Installation with Tabs

**Files:**
- Modify: `components/onboarding-modal.tsx` (replace `StepInstallHook` placeholder)

**Step 1: Implement the hook installation step with Automatic/Manual tabs**

Replace the `StepInstallHook` placeholder in `components/onboarding-modal.tsx`:

```tsx
function StepInstallHook({ apiKey, userId, onContinue }: { apiKey: string; userId: string; onContinue: () => void }) {
  const [tab, setTab] = useState<"automatic" | "manual">("automatic");
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // One-liner that downloads the hook script and configures Claude Code settings
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
              export TOKEN_PROFILE_API_KEY="{apiKey}"
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

      {/* Real-time verification — added in Task 5 */}
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
```

Add a placeholder for `HookVerification` (implemented in Task 5):

```tsx
function HookVerification({ userId }: { userId: string }) {
  return null; // Implemented in Task 5
}
```

**Step 2: Verify locally**

Run: `bun dev`
- Step 2 shows Automatic/Manual tabs
- Tab switching works, correct content shown
- Copy buttons work for both command and JSON
- Continue button advances to step 3

**Step 3: Commit**

```bash
git add components/onboarding-modal.tsx
git commit -m "Implement hook installation step with automatic/manual tabs"
```

---

### Task 5: Implement Real-Time Hook Verification

**Files:**
- Modify: `components/onboarding-modal.tsx` (replace `HookVerification` placeholder)

**Step 1: Implement the Firestore real-time listener**

Replace the `HookVerification` placeholder in `components/onboarding-modal.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

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
```

Note: This query requires a composite Firestore index on `events` collection: `userId` ASC + `createdAt` DESC. The existing app already uses a similar index (`userId` + `timestamp`). If needed, Firestore will auto-suggest the index creation link in the browser console.

**Step 2: Verify locally**

Run: `bun dev`
- Step 2 shows "Waiting for your first event..." with spinner
- Run a Claude Code completion with the hook configured
- Verification area transitions to green checkmark with event details
- Works even if events already exist (existing users testing)

**Step 3: Commit**

```bash
git add components/onboarding-modal.tsx
git commit -m "Add real-time hook verification with Firestore listener"
```

---

### Task 6: Create Auto-Install Hook Script Endpoint

**Files:**
- Create: `app/api/hook-script/route.ts`

**Step 1: Create the endpoint that serves an auto-installer script**

The automatic install tab references `https://tokenprofile.app/api/hook-script`. This endpoint returns a bash script that:
1. Downloads `tokenprofile-hook.sh` to `~/.claude/hooks/`
2. Adds the API key to shell config
3. Configures Claude Code settings

Create `app/api/hook-script/route.ts`:

```ts
import { NextResponse } from "next/server";

const SCRIPT = `#!/bin/bash
set -e

API_KEY="\${1:?Usage: curl ... | bash -s -- YOUR_API_KEY}"

HOOK_DIR="$HOME/.claude/hooks"
SETTINGS_FILE="$HOME/.claude/settings.json"
HOOK_SCRIPT="$HOOK_DIR/tokenprofile-hook.sh"

echo "Installing Token Profile hook..."

# 1. Create hooks directory
mkdir -p "$HOOK_DIR"

# 2. Download hook script
curl -fsSL "https://tokenprofile.app/scripts/tokenprofile-hook.sh" -o "$HOOK_SCRIPT"
chmod +x "$HOOK_SCRIPT"

# 3. Add API key to shell config
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
  SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
  SHELL_CONFIG="$HOME/.bash_profile"
else
  SHELL_CONFIG="$HOME/.profile"
fi

if ! grep -q "TOKEN_PROFILE_API_KEY" "$SHELL_CONFIG" 2>/dev/null; then
  printf '\\nexport TOKEN_PROFILE_API_KEY="%s"\\n' "$API_KEY" >> "$SHELL_CONFIG"
  echo "Added API key to $SHELL_CONFIG"
else
  echo "TOKEN_PROFILE_API_KEY already set in $SHELL_CONFIG"
fi

# 4. Configure Claude Code settings
if [ -f "$SETTINGS_FILE" ]; then
  # Merge hook into existing settings using jq if available, otherwise warn
  if command -v jq &>/dev/null; then
    HOOK_ENTRY='{"matcher":"","hooks":[{"type":"command","command":"bash '"$HOOK_SCRIPT"'"}]}'
    UPDATED=$(jq --argjson hook "[$HOOK_ENTRY]" '
      .hooks.Stop = ((.hooks.Stop // []) + $hook | unique_by(.hooks[0].command))
    ' "$SETTINGS_FILE")
    echo "$UPDATED" > "$SETTINGS_FILE"
    echo "Updated $SETTINGS_FILE"
  else
    echo "Warning: jq not found. Please manually add the hook to $SETTINGS_FILE"
    echo "See: https://tokenprofile.app → Developer tab for manual setup instructions"
  fi
else
  mkdir -p "$(dirname "$SETTINGS_FILE")"
  cat > "$SETTINGS_FILE" << SETTINGS_EOF
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash $HOOK_SCRIPT"
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF
  echo "Created $SETTINGS_FILE"
fi

echo ""
echo "Done! Token Profile hook installed."
echo "Run a Claude Code completion to verify it's working."
`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache",
    },
  });
}
```

**Step 2: Serve the hook script as a static file**

The installer downloads the hook script from `/scripts/tokenprofile-hook.sh`. In Next.js, files in `public/` are served statically. Copy or symlink:

```bash
mkdir -p public/scripts
cp scripts/tokenprofile-hook.sh public/scripts/tokenprofile-hook.sh
```

**Step 3: Verify locally**

Run: `bun dev`
- `curl http://localhost:3000/api/hook-script` returns the installer script
- `curl http://localhost:3000/scripts/tokenprofile-hook.sh` returns the hook script

**Step 4: Commit**

```bash
git add app/api/hook-script/route.ts public/scripts/tokenprofile-hook.sh
git commit -m "Add auto-install hook script endpoint"
```

---

### Task 7: Polish and Integration Testing

**Files:**
- Modify: `components/onboarding-modal.tsx` (final polish)

**Step 1: Add transition animation between steps**

Wrap the step content area with a fade transition. A simple approach using a key-based re-render:

```tsx
<div key={step} className="animate-fade-in px-6 pb-6">
```

Add to `app/globals.css` (or wherever global styles live):

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
```

**Step 2: End-to-end manual test**

1. Clear `hasOnboarded` in Firestore for test user `yusuf-erdo`
2. Sign in → profile page loads with modal overlay
3. Step 1: select interests → continue → verify interests saved in Firestore
4. Step 2: see hook install tabs, copy commands, verify real-time listener
5. Step 3: "Go to your profile" → modal closes
6. Refresh → modal does NOT reappear
7. Test "Skip" at each step → jumps to completion

**Step 3: Commit**

```bash
git add components/onboarding-modal.tsx app/globals.css
git commit -m "Add fade transitions to onboarding modal steps"
```
