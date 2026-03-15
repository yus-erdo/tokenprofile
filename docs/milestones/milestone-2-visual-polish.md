# Milestone 2 — Visual Polish & UX

**Priority:** 🔴 Critical
**Effort:** Medium
**Dependencies:** None (can be done in parallel with M1)
**Status:** Complete

## Goal

Elevate the UI quality with micro-interactions, loading states, and terminal-aesthetic polish.

## Features

### 2.1 Bento Grid Dashboard
Replace the current flat layout with a modular bento grid of stat cards.

- [x] Design bento grid layout for the Overview tab
  - Cards: Completions, Tokens, Est. Cost, Top Model (2-column responsive grid)
  - Responsive: 2-column on desktop, 1 on mobile
- [x] Implement CSS grid-based bento layout component
- [x] Each card is a self-contained component with consistent styling
- [x] Terminal-style `~` prefix labels, monospace uppercase tracking

### 2.2 Number Counters
Animate numbers rolling up on page load for stat values.

- [x] Create `AnimatedCounter` component
  - Smooth count-up animation from 0 to target value
  - Duration ~1s with ease-out cubic curve
  - Format: numbers with commas, costs with $
- [x] Apply to all stat cards in the bento grid
- [x] Only animate on first load (not on every re-render)

### 2.3 Skeleton Loaders
Pulsing placeholder UI while data loads.

- [x] Create skeleton variants for:
  - Stat cards (rectangle with pulsing gradient)
  - Heatmap (grid of pulsing squares)
  - Completion list items
- [x] Match exact dimensions of real content to prevent layout shift

### 2.4 Terminal-Aesthetic Cards
Solid, high-contrast cards that lean into the dev/terminal feel.

- [x] Solid backgrounds (gray-50 light / gray-900 dark) — no frosted glass
- [x] Clean 1px borders, no shadows or hover-lift effects
- [x] Uppercase monospace labels with tracking for section headers
- [x] High contrast text — dark text on light bg, light text on dark bg

### 2.5 Dot Grid Background
Subtle dot pattern behind content areas.

- [x] CSS-only dot grid pattern (no images)
- [x] Subtle opacity — visible but not distracting
- [x] Adapts to light/dark theme
- [x] Applied to main content area background

### 2.6 Monospace Typography Accents
Lean into the dev/terminal aesthetic for certain elements.

- [x] Use monospace font for: token counts, costs, model names, API keys
- [x] Keep sans-serif for: headings, descriptions, navigation
- [x] Consistent font pairing across the app

### 2.7 Haptic-Style Feedback
Subtle animations on interactive elements.

- [x] Button press: slight scale-down (0.97) on click
- [x] Tab switch: smooth underline slide animation
- [x] Keep animations under 200ms — snappy, not sluggish

### 2.8 Smooth Theme Transition
Improve light/dark mode toggle with a smooth transition.

- [x] CSS transition on background-color, color, border-color (300ms)
- [x] No flash of unstyled content on theme switch
- [x] Ensure all components participate in the transition

## Technical Notes

- All visual changes are CSS/Tailwind-first — minimal JS for animations
- Terminal aesthetic: solid backgrounds, monospace fonts, `~` prefixed labels, no glassmorphism
- Performance: animations do not cause layout thrashing

## Definition of Done

- [x] Bento grid renders responsively across breakpoints
- [x] Number counters animate smoothly without jank
- [x] Skeleton loaders match real content dimensions
- [x] All visual effects work in both light and dark mode
- [x] No text overflow on large numbers
