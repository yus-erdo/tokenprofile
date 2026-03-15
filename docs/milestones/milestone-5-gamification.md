# Milestone 5 — Gamification

**Priority:** 🟡 Medium
**Effort:** Medium
**Dependencies:** M1 (streak data, analytics)

## Goal

Add achievements, badges, and goals to make tracking usage fun and engaging.

## Features

### 5.1 Achievements & Badges
Unlock badges based on usage milestones.

- [ ] Define badge catalog:
  - **Token milestones:** First 10K, First 100K, First 1M, First 10M, Token Whale (100M)
  - **Streak badges:** 7-day streak, 30-day streak, 100-day streak, 365-day streak
  - **Time-based:** Weekend Warrior (10+ weekend completions), Night Owl (50+ completions after 10pm), Early Bird (50+ before 7am)
  - **Model variety:** Polyglot (used 3+ models), Model Master (used all available models)
  - **Misc:** First Completion, Speed Demon (100+ completions in a day)
- [ ] Badge evaluation engine — checks user stats against badge criteria
- [ ] Store unlocked badges in user document: `badges: { id: string, unlockedAt: Timestamp }[]`
- [ ] API endpoint: `GET /api/users/me/badges`
- [ ] API endpoint: `GET /api/users/{username}/badges` (public)
- [ ] UI: Badge showcase grid on profile
  - Unlocked badges: full color with unlock date
  - Locked badges: greyed out with progress indicator
- [ ] Badge detail modal: name, description, criteria, unlock date

### 5.2 Confetti Burst
Celebrate when a badge is unlocked or a milestone is hit.

- [ ] Lightweight confetti animation (canvas-confetti or CSS-only)
- [ ] Trigger on: badge unlock, streak milestone, first completion of the day
- [ ] Toast notification with badge icon and congratulations message
- [ ] Don't show confetti for badges unlocked retroactively on first load

### 5.3 Usage Goals
Set daily or weekly targets and track progress.

- [ ] Goal types: daily token target, daily completion target, weekly token target
- [ ] Settings UI: set goal amount and type
- [ ] Store in user document: `goals: { type: string, target: number, active: boolean }[]`
- [ ] Progress bar/ring showing current progress toward goal
- [ ] Visual indicator when goal is met (checkmark, color change)
- [ ] Goal streak: consecutive days/weeks meeting the goal

## Technical Notes

- Badge evaluation can run on-demand (when profile loads) — no need for background jobs initially
- Consider evaluating badges server-side to prevent cheating (even though this is personal data)
- Confetti: use `canvas-confetti` (3KB gzipped) — lightweight and battle-tested
- Goals progress can be calculated from existing daily aggregation
- Badge icons: use emoji or simple SVG icons to keep it lightweight

## Definition of Done

- At least 15 badges defined with clear criteria
- Badges evaluate correctly against real user data
- Confetti fires on new badge unlock (not retroactive)
- Usage goals track progress accurately
- All badge/goal UI works on public and private profiles
