# Milestone 6 — Power User

**Priority:** 🟡 Medium
**Effort:** Medium
**Dependencies:** None (mostly standalone)

## Goal

Features for power users who want more control over their data and navigation.

## Features

### 6.1 Custom Date Ranges
Filter heatmap and stats by arbitrary date periods.

- [ ] Date range picker component (start date, end date)
- [ ] Preset ranges: Last 7 days, Last 30 days, Last 90 days, This year, All time
- [ ] Custom range via calendar picker
- [ ] All analytics endpoints accept `from` and `to` query params
- [ ] Heatmap, stats, charts all filter to selected range
- [ ] URL query params for shareable filtered views
- [ ] Persist last-used range in localStorage

### 6.2 Export Data
CSV and JSON download of usage data.

- [ ] API endpoint: `GET /api/users/me/export`
  - Query params: `format=csv|json`, `from`, `to`
  - Returns all events within range
  - CSV columns: date, model, input_tokens, output_tokens, cache_tokens, total_tokens, cost_usd, project, source
  - JSON: array of event objects
- [ ] Download button in Developer tab or settings area
- [ ] Show estimated file size before download
- [ ] Stream large exports (don't load all into memory)
- [ ] Rate limit: max 1 export per minute

### 6.3 Command Palette
cmd+k to navigate, search sessions, switch views.

- [ ] Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows)
- [ ] Search categories:
  - **Navigation:** Go to Profile, Go to Settings, Go to Developer
  - **Actions:** Export Data, Regenerate API Key, Toggle Theme
  - **Search:** Find completions by project name, model, date
- [ ] Fuzzy search with highlighted matches
- [ ] Recent commands / frequently used at the top
- [ ] Keyboard navigation (up/down arrows, enter to select, esc to close)
- [ ] Smooth open/close animation with backdrop blur

## Technical Notes

- Date range picker: build with native `<input type="date">` or use a lightweight library
- Export streaming: use `ReadableStream` in the API route for large datasets
- Command palette: implement as a modal with portal rendering
- Fuzzy search: use a simple scoring algorithm (no need for a library)
- Keyboard shortcuts: register at the layout level, check for input focus to avoid conflicts

## Definition of Done

- Date ranges filter all data views consistently
- Export produces valid CSV and JSON files
- Command palette opens/closes smoothly and navigates correctly
- All features accessible and functional on mobile (palette via button, not just keyboard)
