# Milestone 3 — Heatmap & Visualizations

**Priority:** 🟠 High
**Effort:** Medium
**Dependencies:** M1 (analytics data), M2 (visual patterns)

## Goal

Enhance the heatmap with richer interactions and add complementary data visualizations.

## Features

### 3.1 Heatmap Zoom Levels
Toggle between day, week, month, and year granularity.

- [ ] Add zoom control buttons above heatmap (Day | Week | Month | Year)
- [ ] Year view: current GitHub-style grid (default, already exists)
- [ ] Month view: calendar-style grid for selected month with day cells
- [ ] Week view: 7-day detailed bar chart with hourly breakdown
- [ ] Day view: 24-hour timeline showing individual completions
- [ ] Smooth animated transitions between zoom levels

### 3.2 Rich Tooltip Cards
Replace simple tooltips with rich hover previews.

- [ ] Tooltip shows: date, completion count, total tokens, total cost, top model used
- [ ] Styled card with subtle shadow and arrow pointer
- [ ] Positioned intelligently (doesn't go off-screen)
- [ ] Smooth fade-in animation
- [ ] Works on both desktop (hover) and mobile (tap)

### 3.3 Animated Transitions
Smooth morphing when changing date ranges or zoom levels.

- [ ] Cells animate position and color when switching years
- [ ] Fade-in for new data, fade-out for removed data
- [ ] Zoom transitions feel like "drilling down" into the data
- [ ] Keep animations under 300ms

### 3.4 Stacked Bar Chart
Daily breakdown by model — complements the heatmap.

- [ ] Bar chart with one bar per day/week (configurable)
- [ ] Each bar stacked by model (color-coded)
- [ ] Syncs with heatmap date range
- [ ] Hover shows per-model breakdown
- [ ] Legend showing model → color mapping

### 3.5 Rolling Average Line
Overlay a trend line on usage data.

- [ ] 7-day rolling average line chart
- [ ] Can overlay on the heatmap or appear below it
- [ ] Shows trend direction clearly
- [ ] Toggle-able (on/off)

## Technical Notes

- Heatmap is currently SVG-based — extend rather than rewrite
- **Use ApexCharts** (installed in M1) for stacked bar chart, rolling average line, and any new chart types
  - Stacked bar: `type: 'bar'` with `stacked: true`
  - Rolling average: `type: 'line'` overlay
- Tooltip positioning: use a portal to avoid overflow clipping
- Mobile: zoom controls should be touch-friendly (swipe between levels?)
- Consider virtualization for day-level views with many data points

## Definition of Done

- All zoom levels render correctly with smooth transitions
- Tooltips show accurate aggregated data
- Stacked bar chart displays per-model data correctly
- All visualizations responsive and theme-aware
- No performance issues with large datasets (1+ year of data)
