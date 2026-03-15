# Milestone 4 — Profile Enhancements

**Priority:** 🟠 High
**Effort:** Small
**Dependencies:** M2 (visual components)

## Goal

Make user profiles richer and more expressive — closer to a GitHub profile experience.

## Features

### 4.1 Contribution Summary
GitHub-style "X completions in the last year" summary text.

- [ ] Calculate yearly completion count from events
- [ ] Display above heatmap: "1,234 completions in the last year"
- [ ] Use animated counter (from M2) for the number
- [ ] Include on public profile

### 4.2 Pinned Stats
Let users choose which metrics to highlight on their profile.

- [ ] Default pinned stats: Total Tokens, Total Cost, Completions, Favorite Model
- [ ] Settings UI: drag-to-reorder or checkbox selection (max 4-6 pinned)
- [ ] Store pinned stat preferences in user document
- [ ] Public profile shows the user's chosen pinned stats

### 4.3 Activity Feed
Scrollable timeline of recent completions — more visual than the current list.

- [ ] Timeline-style layout with vertical line connector
- [ ] Each entry shows: model icon, token count, cost, project, relative time
- [ ] Group entries by day with day headers
- [ ] Infinite scroll with cursor-based pagination (extend existing endpoint)
- [ ] Real-time: new entries appear at top with animation

### 4.4 Avatar Ring
Colored border around avatar showing usage level.

- [ ] Tiers: Bronze (< 100k tokens), Silver (< 1M), Gold (< 10M), Diamond (10M+)
- [ ] Gradient ring around avatar image
- [ ] Tier name shown as small badge below avatar
- [ ] Thresholds configurable server-side
- [ ] Animate ring on profile load (draw-on effect)

### 4.5 Markdown Bio
Rich text profile description with markdown support.

- [ ] Parse bio field as markdown (bold, italic, links, code, lists)
- [ ] Use a lightweight markdown renderer (react-markdown or similar)
- [ ] Sanitize HTML to prevent XSS
- [ ] Preview in edit mode
- [ ] Render on public profile

## Technical Notes

- Pinned stats need a new field on the user document: `pinnedStats: string[]`
- Avatar ring is pure CSS (conic-gradient border)
- Activity feed extends existing completion list — refactor, don't rebuild
- Markdown rendering: ensure consistent styling in both themes
- XSS prevention critical for markdown bio — use allowlist-based sanitizer

## Definition of Done

- Contribution summary shows accurate count with animation
- Pinned stats are configurable and persist
- Activity feed loads smoothly with infinite scroll
- Avatar ring color matches usage tier
- Markdown bio renders safely with preview
