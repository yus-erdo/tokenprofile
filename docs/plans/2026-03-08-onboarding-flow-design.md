# Onboarding Flow Design

## Trigger

- Fires once after first GitHub sign-in, before user interacts with their profile
- Profile loads in the background (dimmed), modal overlay on top
- Tracked via a `hasOnboarded` flag in the user's Firestore doc
- Skippable at any point via an "X" or "Skip" button

## Step 1: "What matters most to you?"

- Multi-select pill/chip selector
- Options:
  - See how much I'm spending on AI
  - Understand which models I use most
  - Track my coding activity over time
  - Share my AI usage publicly
  - Compare cost across different models
  - Set budgets or spending alerts
- Stored in user doc (e.g. `interests: string[]`)
- "Continue" button (works even with no selection — everything is skippable)

## Step 2: Install the Hook

- Two tabs: **Automatic** | **Manual**
- **Automatic tab**: one-liner shell command to copy, auto-configures `~/.claude/settings.json`
- **Manual tab**: JSON snippet to paste into settings, plus API key (already generated at signup)
- Below the tabs: real-time verification area
  - Default state: "Waiting for your first event..." with a subtle pulse/spinner
  - Listens via Firestore `onSnapshot` for any event with this user's ID
  - On event received: green checkmark + "Got it! Your hook is working" with event details (model, tokens)
- "Continue" / "Skip" button available regardless of verification state

## Step 3: Done

- Brief confirmation: "You're all set"
- "Go to your profile" button that dismisses the modal
- Sets `hasOnboarded: true` in Firestore

## Progress Indicator

- Small dots or step indicators at the top of the modal (1 · 2 · 3)
- Current step highlighted

## UI Details

- Modal: centered, ~max-w-lg, rounded, dark mode aware
- Backdrop: profile page dimmed with backdrop blur
- Transitions between steps (subtle slide or fade)
- Matches existing design: gray palette, orange accents, Tailwind only

## Data Model Changes

- Add `hasOnboarded: boolean` to user doc
- Add `interests: string[]` to user doc
