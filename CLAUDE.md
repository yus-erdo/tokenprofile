# toqqen

LLM token usage tracker. Next.js 16 + Tailwind CSS 4 + Firebase.

## Color Palette

Three color families: **gray** (structure), **green** (data), **blue** (interactive labels).

### Green — Data Visualization Scale

Matches GitHub contribution graph. Used for heatmap, sparklines, percentage bars.

| Level | Dark | Light | Usage |
|-------|------|-------|-------|
| 0 (empty) | `#161b22` | `#ebedf0` | Zero/no data |
| 1 (low) | `#0e4429` | `#9be9a8` | <25% intensity |
| 2 (med) | `#006d32` | `#40c463` | <50% intensity |
| 3 (high) | `#26a641` | `#30a14e` | <75% intensity |
| 4 (max) | `#39d353` | `#216e39` | >=75% intensity |
| Emerald 500 | `#10b981` | `#059669` | Percentage bars, success accents |

### Blue — UI Accent (Labels, Interactive)

| Name | Hex | Usage |
|------|-----|-------|
| Blue 600 | `#2563eb` | Box labels (light mode) |
| Blue 400 | `#60a5fa` | Box labels (dark mode) |
| Blue (GitHub) | `#58a6ff` | Model chart accent |

### Gray — Structure & Text

| Name | Hex | Usage |
|------|-----|-------|
| White | `#ffffff` | Light mode background |
| Gray 950 | `#030712` | Dark mode background (body) |
| Gray 100 | `#f3f4f6` | Grid lines (light), primary text (dark) |
| Gray 300 | `#d1d5db` | Borders (light) |
| Gray 500 | `#6b7280` | Secondary/muted text |
| Gray 900 | `#111827` | Primary text (light) |
| `#30363d` | — | Borders (dark, GitHub dark theme) |
| `#21262d` | — | Subtle dividers, bar track bg (dark) |

### Rules

- Use the green scale for all data-intensity visualizations (heatmaps, sparklines, charts)
- Use blue for interactive labels and terminal box titles
- Never introduce new accent colors without adding them here
- Sparkline bar shades must match heatmap shades (defined as CSS vars `--sparkline-0` through `--sparkline-4`)
