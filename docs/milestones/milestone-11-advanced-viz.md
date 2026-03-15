# Milestone 11 — Advanced Visualizations

**Priority:** 🟢 Low
**Effort:** Large
**Dependencies:** M1 (analytics), M3 (chart patterns)

## Goal

Add advanced data visualizations for users who want deep insight into their usage patterns.

## Features

### 11.1 Radial Chart (Clock Face)
24-hour clock showing usage intensity by hour of day.

- [ ] Circular chart divided into 24 segments (one per hour)
- [ ] Segment intensity based on token count or completion count
- [ ] Color gradient from low to high activity
- [ ] Center text showing total for the period
- [ ] Interactive: hover/tap a segment to see details
- [ ] Toggle: tokens vs completions vs cost
- [ ] Responsive sizing

### 11.2 Sparklines
Tiny inline charts next to key metrics.

- [ ] Sparkline component: 7-day trend line (60px wide, 20px tall)
- [ ] Show alongside stat cards: tokens, cost, completions
- [ ] Color: green if trending up, red if trending down, neutral if flat
- [ ] SVG-based for crisp rendering at small sizes
- [ ] Data from the existing trends endpoint (M1)

### 11.3 Sankey Diagram
Flow visualization: Projects → Models → Token Types.

- [ ] Three columns:
  - Left: Projects (source of completions)
  - Middle: Models (which model was used)
  - Right: Token types (input, output, cache)
- [ ] Flow width proportional to token count
- [ ] Interactive: hover to highlight a single flow path
- [ ] Filter by date range
- [ ] Color-coded by model or project
- [ ] This is complex — consider using d3-sankey or a dedicated library

## Technical Notes

- **Use ApexCharts** (installed in M1) for all chart types:
  - Radial chart: `type: 'polarArea'` or `type: 'radar'` with 24 categories
  - Sparklines: ApexCharts has built-in sparkline mode (`chart.sparkline.enabled: true`)
- Sankey: ApexCharts doesn't support Sankey natively — use `d3-sankey` for this one chart
- All visualizations should degrade gracefully with small datasets
- Consider lazy-loading advanced viz components (code-split)
- These are "nice to have" — don't block other milestones

## Definition of Done

- Radial chart renders accurately and is interactive
- Sparklines appear next to relevant stat cards
- Sankey diagram correctly maps project → model → token type flows
- All visualizations work in both themes
- Performance acceptable with 1+ year of data
- Graceful empty/insufficient data states
