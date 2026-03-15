# Milestone 2: Visual Polish & UX — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the UI with bento grid layout, animated counters, skeleton loaders, glassmorphism, dot grid background, monospace accents, micro-interactions, and smooth theme transitions.

**Architecture:** Pure CSS/Tailwind-first approach with minimal JS. New reusable components for animations and layout. Applied to existing profile page components.

**Tech Stack:** Tailwind CSS, CSS animations, React hooks, Next.js

---

## File Structure

```
components/ui/animated-counter.tsx     — CREATE: Counting animation component
components/ui/skeleton.tsx             — CREATE: Skeleton loader variants
components/ui/bento-card.tsx           — CREATE: Glassmorphism card with hover effects
components/ui/bento-grid.tsx           — CREATE: Responsive grid layout
app/globals.css                        — MODIFY: Add dot grid, transitions, glassmorphism styles

components/profile-content.tsx         — MODIFY: Use bento grid + new components
components/nav.tsx                     — MODIFY: Button micro-interactions
```

---

## Chunk 1: Core UI Components

### Task 1: Animated counter component

**Files:**
- Create: `components/ui/animated-counter.tsx`

- [ ] **Step 1: Create the animated counter component**

Create `components/ui/animated-counter.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number
  format?: (value: number) => string
  className?: string
}

export function AnimatedCounter({
  value,
  duration = 1000,
  format = (v) => v.toLocaleString(),
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const prevValue = useRef(0)
  const hasAnimated = useRef(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (hasAnimated.current && prevValue.current === value) return

    const start = hasAnimated.current ? prevValue.current : 0
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + (value - start) * eased
      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
        prevValue.current = value
        hasAnimated.current = true
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {format(Math.round(displayValue))}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/animated-counter.tsx
git commit -m "feat: add animated counter component with ease-out animation"
```

### Task 2: Skeleton loader component

**Files:**
- Create: `components/ui/skeleton.tsx`

- [ ] **Step 1: Create skeleton loader variants**

Create `components/ui/skeleton.tsx`:

```tsx
interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function HeatmapSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="grid grid-cols-[repeat(53,1fr)] gap-[3px]">
        {Array.from({ length: 371 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full min-w-[8px]" />
        ))}
      </div>
    </div>
  )
}

export function CompletionItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/skeleton.tsx
git commit -m "feat: add skeleton loader components for stats, heatmap, and completions"
```

### Task 3: Bento card with terminal aesthetic

**Files:**
- Create: `components/ui/bento-card.tsx`

- [ ] **Step 1: Create the bento card component**

Create `components/ui/bento-card.tsx`:

```tsx
interface BentoCardProps {
  children: React.ReactNode
  className?: string
  span?: 1 | 2
}

export function BentoCard({ children, className = '', span = 1 }: BentoCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-lg p-4
        bg-gray-50 dark:bg-gray-900
        border border-gray-200 dark:border-gray-800
        transition-colors duration-200
        ${span === 2 ? 'col-span-1 md:col-span-2' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/bento-card.tsx
git commit -m "feat: add glassmorphism bento card component"
```

### Task 4: Bento grid layout

**Files:**
- Create: `components/ui/bento-grid.tsx`

- [ ] **Step 1: Create the bento grid component**

Create `components/ui/bento-grid.tsx`:

```tsx
interface BentoGridProps {
  children: React.ReactNode
  className?: string
  cols?: 2 | 3 | 4
}

export function BentoGrid({ children, className = '', cols = 3 }: BentoGridProps) {
  const colsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid gap-4 ${colsClass[cols]} ${className}`}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/bento-grid.tsx
git commit -m "feat: add responsive bento grid layout component"
```

---

## Chunk 2: Global Styles

### Task 5: Add dot grid background, monospace accents, and smooth theme transitions

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add global styles**

Add the following to `app/globals.css` (after existing styles):

```css
/* Dot grid background */
.dot-grid-bg {
  background-image: radial-gradient(circle, currentColor 1px, transparent 1px);
  background-size: 24px 24px;
  color: rgb(0 0 0 / 0.05);
}

.dark .dot-grid-bg {
  color: rgb(255 255 255 / 0.05);
}

/* Smooth theme transitions */
html.transitioning,
html.transitioning *,
html.transitioning *::before,
html.transitioning *::after {
  transition: background-color 300ms ease, color 300ms ease, border-color 300ms ease, box-shadow 300ms ease !important;
}

/* Monospace accent class */
.font-mono-accent {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

/* Button press micro-interaction */
.press-effect {
  transition: transform 100ms ease;
}
.press-effect:active {
  transform: scale(0.97);
}

/* Tab underline slide */
.tab-underline {
  position: relative;
}
.tab-underline::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: currentColor;
  transform: scaleX(0);
  transition: transform 200ms ease;
}
.tab-underline[data-active='true']::after {
  transform: scaleX(1);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add dot grid, theme transitions, monospace accents, micro-interactions CSS"
```

---

## Chunk 3: Apply to Profile

### Task 6: Update theme toggle for smooth transitions

**Files:**
- Modify: `components/theme-toggle.tsx`

- [ ] **Step 1: Add transition class on theme switch**

In the theme toggle's click handler, before changing the theme, add:

```typescript
document.documentElement.classList.add('transitioning')
setTimeout(() => document.documentElement.classList.remove('transitioning'), 350)
```

This triggers the CSS transition for all elements during the switch.

- [ ] **Step 2: Commit**

```bash
git add components/theme-toggle.tsx
git commit -m "feat: add smooth transition animation to theme toggle"
```

### Task 7: Apply bento grid and animated counters to profile stats

**Files:**
- Modify: `components/profile-content.tsx`

- [ ] **Step 1: Refactor stats grid to use bento grid with glassmorphism cards**

In `profile-content.tsx`:

1. Import the new components:
```tsx
import { BentoGrid } from '@/components/ui/bento-grid'
import { BentoCard } from '@/components/ui/bento-card'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { StatCardSkeleton, CompletionItemSkeleton } from '@/components/ui/skeleton'
```

2. Replace the existing stats grid with BentoGrid + BentoCard. Each stat card should use `AnimatedCounter` for the value. Replace loading states with skeleton components.

3. Add `dot-grid-bg` class to the main content wrapper.

4. Add `font-mono-accent` class to token counts, costs, and model names.

5. Add `press-effect` class to interactive buttons.

- [ ] **Step 2: Verify dev server renders correctly**

```bash
npm run dev
```

Check profile page: bento grid layout, animated counters, glassmorphism cards, dot grid background.

- [ ] **Step 3: Run all tests to ensure no regressions**

```bash
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add components/profile-content.tsx
git commit -m "feat: apply bento grid, animated counters, and glassmorphism to profile stats"
```

### Task 8: Apply micro-interactions to nav and tabs

**Files:**
- Modify: `components/nav.tsx`
- Modify: `components/profile-tabs.tsx`

- [ ] **Step 1: Add press-effect to nav buttons and links**

In `components/nav.tsx`, add `press-effect` class to interactive elements (sign-in button, navigation links).

- [ ] **Step 2: Add tab underline animation to profile tabs**

In `components/profile-tabs.tsx`, add `tab-underline` class and `data-active` attribute to tab buttons.

- [ ] **Step 3: Commit**

```bash
git add components/nav.tsx components/profile-tabs.tsx
git commit -m "feat: add micro-interactions to nav buttons and profile tabs"
```

### Task 9: Final build verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```
