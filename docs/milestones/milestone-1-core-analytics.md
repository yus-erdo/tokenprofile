# Milestone 1 — Core Analytics

**Priority:** 🔴 Critical
**Effort:** Medium
**Dependencies:** None (builds on existing event data)

## Goal

Give users deeper insight into their AI usage patterns beyond the heatmap. This is the foundation for gamification, alerts, and reports.

## Features

### 1.1 Peak Hours Analysis
Show when the user is most active with AI — time-of-day and day-of-week patterns.

- [ ] API endpoint: `GET /api/users/me/analytics/peak-hours`
  - Aggregate events by hour-of-day (0-23) and day-of-week (0-6)
  - Return token counts and completion counts per bucket
  - Support `year` query param for filtering
- [ ] UI: Radial clock chart showing usage intensity by hour
- [ ] UI: Day-of-week bar chart (Mon-Sun)
- [ ] Add to profile Overview tab as a new section

### 1.2 Streak Tracking
GitHub-style streak tracking — current streak, longest streak, streak badges.

- [ ] Server-side streak calculation from daily activity data
  - A "day" = at least 1 completion recorded
  - Calculate current streak (consecutive days including today)
  - Calculate longest streak (all-time)
- [ ] API endpoint: `GET /api/users/me/analytics/streaks`
- [ ] UI: Streak counter displayed prominently on profile
  - Current streak with fire icon
  - Longest streak with trophy icon
- [ ] Include streak data in public profile API response

### 1.3 Usage Trends
Weekly and monthly summary stats — trend lines showing usage over time.

- [ ] API endpoint: `GET /api/users/me/analytics/trends`
  - Aggregate by week or month (query param `granularity=week|month`)
  - Return: tokens, cost, completions per period
  - Include percentage change vs previous period
- [ ] UI: Line/area chart showing trends over time
- [ ] Stat cards showing week-over-week and month-over-month changes

### 1.4 Multi-Model Breakdown
Break down usage by model — see which models you use most.

- [ ] API endpoint: `GET /api/users/me/analytics/models`
  - Group events by model
  - Return: tokens, cost, completion count per model
  - Support date range filtering
- [ ] UI: Donut/pie chart showing model distribution
- [ ] UI: Table with per-model stats (tokens, cost, % of total)
- [ ] Show model breakdown in the stats section of profile

## Technical Notes

- **Charting library: ApexCharts** (`apexcharts` + `react-apexcharts`)
  - Install: `npm install apexcharts react-apexcharts`
  - Use `next/dynamic` with `ssr: false` since ApexCharts requires `window`
  - Configure dark/light theme via ApexCharts theme options (sync with app theme)
  - Create a shared chart wrapper component that handles theme syncing
- All aggregation should happen server-side via Firestore queries
- Consider caching aggregated results (Firestore document or in-memory) since these are expensive queries
- Events already have `model`, `timestamp`, `totalTokens`, `costUsd` fields — no schema changes needed

## Definition of Done

- All 4 analytics features have working API endpoints with tests
- UI components render correctly in both light and dark mode
- Data is accurate against raw event data
- Public profile shows streak data
- Charts are responsive (mobile + desktop)
