# toqqen Roadmap — Milestones

## Overview

Feature milestones organized by priority and dependency order. Each milestone is self-contained and shippable.

| # | Milestone | Priority | Effort | Status |
|---|-----------|----------|--------|--------|
| 1 | [Core Analytics](./milestone-1-core-analytics.md) | 🔴 Critical | Medium | Not Started |
| 2 | [Visual Polish & UX](./milestone-2-visual-polish.md) | 🔴 Critical | Medium | Complete |
| 3 | [Heatmap & Visualizations](./milestone-3-heatmap-viz.md) | 🟠 High | Medium | Not Started |
| 4 | [Profile Enhancements](./milestone-4-profile.md) | 🟠 High | Small | Not Started |
| 5 | [Gamification](./milestone-5-gamification.md) | 🟡 Medium | Medium | Not Started |
| 6 | [Power User](./milestone-6-power-user.md) | 🟡 Medium | Medium | Not Started |
| 7 | [Budgets & Alerts](./milestone-7-budgets-alerts.md) | 🟡 Medium | Medium | Not Started |
| 8 | [Data & Privacy](./milestone-8-data-privacy.md) | 🟠 High | Small | Not Started |
| 9 | [Teams](./milestone-9-teams.md) | 🟡 Medium | Large | Not Started |
| 10 | [Reports](./milestone-10-reports.md) | 🟢 Low | Medium | Not Started |
| 11 | [Advanced Visualizations](./milestone-11-advanced-viz.md) | 🟢 Low | Large | Not Started |

## Dependency Graph

```
M1 (Core Analytics) ──┬──> M3 (Heatmap & Viz)
                       ├──> M5 (Gamification)
                       ├──> M7 (Budgets & Alerts)
                       └──> M10 (Reports)

M2 (Visual Polish) ───┬──> M3 (Heatmap & Viz)
                       └──> M4 (Profile)

M6 (Power User) ──────> standalone
M8 (Data & Privacy) ──> standalone (but should ship before Teams)
M9 (Teams) ────────────> depends on M1, M8
M11 (Advanced Viz) ────> depends on M1, M3
```

## Guiding Principles

- Ship each milestone independently — no big bang releases
- Existing data model supports most features; minimize schema changes
- Server-side aggregation where possible to keep client lightweight
- All new UI follows existing dark/light theme patterns
- **Charting: ApexCharts** (`apexcharts` + `react-apexcharts`) for all charts and visualizations (except Sankey which uses d3-sankey)
