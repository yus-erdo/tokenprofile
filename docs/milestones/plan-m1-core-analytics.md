# Milestone 1: Core Analytics — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add peak hours, streak tracking, usage trends, and multi-model breakdown analytics to the toqqen profile.

**Architecture:** Server-side Firestore aggregation via new API endpoints, rendered with ApexCharts in new components on the profile Overview tab. A shared ApexCharts wrapper handles theme syncing.

**Tech Stack:** Next.js API routes, Firestore queries, ApexCharts (`apexcharts` + `react-apexcharts`), TypeScript

---

## File Structure

```
lib/charts/apex-wrapper.tsx          — CREATE: Dynamic-imported ApexCharts wrapper with theme sync
lib/charts/chart-colors.ts           — CREATE: Shared color palette for light/dark themes

app/api/users/me/analytics/peak-hours/route.ts   — CREATE: Peak hours aggregation endpoint
app/api/users/me/analytics/streaks/route.ts      — CREATE: Streak calculation endpoint
app/api/users/me/analytics/trends/route.ts       — CREATE: Usage trends endpoint
app/api/users/me/analytics/models/route.ts       — CREATE: Model breakdown endpoint

components/analytics/peak-hours-chart.tsx   — CREATE: Radial + bar chart for peak hours
components/analytics/streak-display.tsx     — CREATE: Streak counter UI
components/analytics/trends-chart.tsx       — CREATE: Line/area chart for trends
components/analytics/model-breakdown.tsx    — CREATE: Donut chart + table for models

components/profile-content.tsx              — MODIFY: Add analytics section below stats grid

app/[username]/page.tsx                     — MODIFY: Pass streak data to public profile

test/analytics/peak-hours.test.ts           — CREATE: Tests for peak hours endpoint
test/analytics/streaks.test.ts              — CREATE: Tests for streaks endpoint
test/analytics/trends.test.ts               — CREATE: Tests for trends endpoint
test/analytics/models.test.ts               — CREATE: Tests for models endpoint
```

---

## Chunk 1: ApexCharts Setup & Shared Utilities

### Task 1: Install ApexCharts and create shared wrapper

**Files:**
- Modify: `package.json`
- Create: `lib/charts/apex-wrapper.tsx`
- Create: `lib/charts/chart-colors.ts`

- [ ] **Step 1: Install ApexCharts**

```bash
npm install apexcharts react-apexcharts
```

- [ ] **Step 2: Create chart color palette**

Create `lib/charts/chart-colors.ts`:

```typescript
export const chartColors = {
  light: {
    primary: '#2563eb',
    secondary: '#7c3aed',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    muted: '#9ca3af',
    background: '#ffffff',
    foreground: '#111827',
    gridLine: '#e5e7eb',
    series: ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d'],
  },
  dark: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    muted: '#6b7280',
    background: '#0a0a0a',
    foreground: '#f9fafb',
    gridLine: '#1f2937',
    series: ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'],
  },
} as const

export type ThemeColors = typeof chartColors.light
```

- [ ] **Step 3: Create ApexCharts wrapper component**

Create `lib/charts/apex-wrapper.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { chartColors } from './chart-colors'
import type { Props as ApexChartProps } from 'react-apexcharts'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface ChartWrapperProps extends Omit<ApexChartProps, 'options'> {
  options: ApexCharts.ApexOptions
}

export function ChartWrapper({ options, ...props }: ChartWrapperProps) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const colors = isDark ? chartColors.dark : chartColors.light

  const themedOptions: ApexCharts.ApexOptions = {
    ...options,
    theme: { mode: isDark ? 'dark' : 'light' },
    chart: {
      ...options.chart,
      background: 'transparent',
      toolbar: { show: false, ...options.chart?.toolbar },
      foreColor: colors.foreground,
    },
    grid: {
      borderColor: colors.gridLine,
      ...options.grid,
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      ...options.tooltip,
    },
    colors: options.colors || colors.series,
  }

  return <ReactApexChart options={themedOptions} {...props} />
}
```

- [ ] **Step 4: Verify the build compiles**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add lib/charts/ package.json package-lock.json
git commit -m "feat: add ApexCharts with theme-aware wrapper component"
```

---

## Chunk 2: Peak Hours Analytics

### Task 2: Peak hours API endpoint

**Files:**
- Create: `app/api/users/me/analytics/peak-hours/route.ts`
- Create: `test/analytics/peak-hours.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/analytics/peak-hours.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase admin
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}))

// Mock next-auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { GET } from '@/app/api/users/me/analytics/peak-hours/route'
import { adminDb } from '@/lib/firebase/admin'
import { auth } from '@/auth'

describe('GET /api/users/me/analytics/peak-hours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new Request('http://localhost/api/users/me/analytics/peak-hours')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns hourly and daily aggregation', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { firestoreId: 'user123' },
    } as any)

    const mockEvents = [
      { timestamp: { toDate: () => new Date('2026-03-10T09:30:00Z') }, totalTokens: 1000, costUsd: 0.05 },
      { timestamp: { toDate: () => new Date('2026-03-10T09:45:00Z') }, totalTokens: 2000, costUsd: 0.10 },
      { timestamp: { toDate: () => new Date('2026-03-11T14:00:00Z') }, totalTokens: 3000, costUsd: 0.15 },
    ]

    const mockDocs = mockEvents.map(e => ({ data: () => e }))
    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    } as any)

    const req = new Request('http://localhost/api/users/me/analytics/peak-hours?year=2026')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.hourly).toHaveLength(24)
    expect(data.daily).toHaveLength(7)
    // Hour 9 should have 2 completions, 3000 tokens
    expect(data.hourly[9].completions).toBe(2)
    expect(data.hourly[9].tokens).toBe(3000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/analytics/peak-hours.test.ts
```
Expected: FAIL — route file doesn't exist

- [ ] **Step 3: Write the endpoint**

Create `app/api/users/me/analytics/peak-hours/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()))

  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year + 1, 0, 1)

  const snapshot = await adminDb
    .collection('events')
    .where('userId', '==', session.user.firestoreId)
    .where('timestamp', '>=', startOfYear)
    .where('timestamp', '<', endOfYear)
    .get()

  // Initialize 24 hours and 7 days
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    completions: 0,
    tokens: 0,
    cost: 0,
  }))

  const daily = Array.from({ length: 7 }, (_, i) => ({
    day: i, // 0 = Sunday
    completions: 0,
    tokens: 0,
    cost: 0,
  }))

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const date = data.timestamp.toDate()
    const hour = date.getUTCHours()
    const day = date.getUTCDay()

    hourly[hour].completions++
    hourly[hour].tokens += data.totalTokens || 0
    hourly[hour].cost += data.costUsd || 0

    daily[day].completions++
    daily[day].tokens += data.totalTokens || 0
    daily[day].cost += data.costUsd || 0
  }

  return NextResponse.json({ hourly, daily, year })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/analytics/peak-hours.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/users/me/analytics/peak-hours/ test/analytics/peak-hours.test.ts
git commit -m "feat: add peak hours analytics endpoint"
```

### Task 3: Peak hours UI component

**Files:**
- Create: `components/analytics/peak-hours-chart.tsx`

- [ ] **Step 1: Create the peak hours chart component**

Create `components/analytics/peak-hours-chart.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChartWrapper } from '@/lib/charts/apex-wrapper'

interface PeakHoursData {
  hourly: { hour: number; completions: number; tokens: number; cost: number }[]
  daily: { day: number; completions: number; tokens: number; cost: number }[]
}

export function PeakHoursChart({ year }: { year: number }) {
  const [data, setData] = useState<PeakHoursData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/me/analytics/peak-hours?year=${year}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [year])

  if (loading || !data) return <div className="h-64 animate-pulse bg-muted rounded-lg" />

  const hourLabels = Array.from({ length: 24 }, (_, i) =>
    i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
  )

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const hourlyOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', height: 280 },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    xaxis: { categories: hourLabels, labels: { rotate: -45, style: { fontSize: '11px' } } },
    yaxis: { title: { text: 'Completions' } },
    dataLabels: { enabled: false },
  }

  const dailyOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', height: 220 },
    plotOptions: { bar: { borderRadius: 4, horizontal: true } },
    xaxis: { categories: dayLabels },
    yaxis: { title: { text: '' } },
    dataLabels: { enabled: false },
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Activity by Hour</h3>
        <ChartWrapper
          type="bar"
          height={280}
          options={hourlyOptions}
          series={[{ name: 'Completions', data: data.hourly.map(h => h.completions) }]}
        />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Activity by Day</h3>
        <ChartWrapper
          type="bar"
          height={220}
          options={dailyOptions}
          series={[{ name: 'Completions', data: data.daily.map(d => d.completions) }]}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/analytics/peak-hours-chart.tsx
git commit -m "feat: add peak hours chart component with ApexCharts"
```

---

## Chunk 3: Streak Tracking

### Task 4: Streaks API endpoint

**Files:**
- Create: `app/api/users/me/analytics/streaks/route.ts`
- Create: `test/analytics/streaks.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/analytics/streaks.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { GET } from '@/app/api/users/me/analytics/streaks/route'
import { adminDb } from '@/lib/firebase/admin'
import { auth } from '@/auth'

describe('GET /api/users/me/analytics/streaks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/users/me/analytics/streaks'))
    expect(res.status).toBe(401)
  })

  it('calculates current and longest streaks', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { firestoreId: 'user123' },
    } as any)

    // 3-day streak ending today (2026-03-14), plus a past 5-day streak
    const today = new Date('2026-03-14T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(today)

    const dates = [
      '2026-03-14', '2026-03-13', '2026-03-12', // current: 3 days
      '2026-03-05', '2026-03-04', '2026-03-03', '2026-03-02', '2026-03-01', // past: 5 days
    ]

    const mockDocs = dates.map(d => ({
      data: () => ({ timestamp: { toDate: () => new Date(d + 'T10:00:00Z') } }),
    }))

    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    } as any)

    const res = await GET(new Request('http://localhost/api/users/me/analytics/streaks'))
    const data = await res.json()

    expect(data.currentStreak).toBe(3)
    expect(data.longestStreak).toBe(5)

    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/analytics/streaks.test.ts
```

- [ ] **Step 3: Write the endpoint**

Create `app/api/users/me/analytics/streaks/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function GET() {
  const session = await auth()
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const snapshot = await adminDb
    .collection('events')
    .where('userId', '==', session.user.firestoreId)
    .orderBy('timestamp', 'desc')
    .get()

  // Collect unique active dates (UTC date strings)
  const activeDatesSet = new Set<string>()
  for (const doc of snapshot.docs) {
    const date = doc.data().timestamp.toDate()
    activeDatesSet.add(date.toISOString().slice(0, 10))
  }

  const activeDates = Array.from(activeDatesSet).sort().reverse() // newest first

  if (activeDates.length === 0) {
    return NextResponse.json({ currentStreak: 0, longestStreak: 0, totalActiveDays: 0 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  // Calculate current streak
  let currentStreak = 0
  const startDate = activeDates[0] === today || activeDates[0] === yesterday ? activeDates[0] : null

  if (startDate) {
    for (let i = 0; i < activeDates.length; i++) {
      const expected = new Date(startDate)
      expected.setDate(expected.getDate() - i)
      const expectedStr = expected.toISOString().slice(0, 10)
      if (activeDates[i] === expectedStr) {
        currentStreak++
      } else {
        break
      }
    }
  }

  // Calculate longest streak
  const sortedAsc = [...activeDates].reverse()
  let longestStreak = 1
  let streak = 1
  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = new Date(sortedAsc[i - 1])
    const curr = new Date(sortedAsc[i])
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000
    if (diffDays === 1) {
      streak++
      longestStreak = Math.max(longestStreak, streak)
    } else {
      streak = 1
    }
  }

  return NextResponse.json({
    currentStreak,
    longestStreak,
    totalActiveDays: activeDates.length,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/analytics/streaks.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/api/users/me/analytics/streaks/ test/analytics/streaks.test.ts
git commit -m "feat: add streak tracking analytics endpoint"
```

### Task 5: Streak display UI

**Files:**
- Create: `components/analytics/streak-display.tsx`

- [ ] **Step 1: Create streak display component**

Create `components/analytics/streak-display.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

interface StreakData {
  currentStreak: number
  longestStreak: number
  totalActiveDays: number
}

export function StreakDisplay() {
  const [data, setData] = useState<StreakData | null>(null)

  useEffect(() => {
    fetch('/api/users/me/analytics/streaks')
      .then(r => r.json())
      .then(setData)
  }, [])

  if (!data) return null

  return (
    <div className="flex gap-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
        <span className="text-lg">🔥</span>
        <div>
          <p className="text-xl font-bold font-mono text-orange-600 dark:text-orange-400">
            {data.currentStreak}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Current Streak</p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
        <span className="text-lg">🏆</span>
        <div>
          <p className="text-xl font-bold font-mono text-yellow-600 dark:text-yellow-400">
            {data.longestStreak}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Longest Streak</p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <span className="text-lg">📅</span>
        <div>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {data.totalActiveDays}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Active Days</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/analytics/streak-display.tsx
git commit -m "feat: add streak display component"
```

---

## Chunk 4: Usage Trends

### Task 6: Trends API endpoint

**Files:**
- Create: `app/api/users/me/analytics/trends/route.ts`
- Create: `test/analytics/trends.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/analytics/trends.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: vi.fn() },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET } from '@/app/api/users/me/analytics/trends/route'
import { adminDb } from '@/lib/firebase/admin'
import { auth } from '@/auth'

describe('GET /api/users/me/analytics/trends', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/users/me/analytics/trends'))
    expect(res.status).toBe(401)
  })

  it('returns weekly aggregated trends', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { firestoreId: 'u1' } } as any)

    const mockDocs = [
      { data: () => ({ timestamp: { toDate: () => new Date('2026-03-01T10:00:00Z') }, totalTokens: 1000, costUsd: 0.05 }) },
      { data: () => ({ timestamp: { toDate: () => new Date('2026-03-02T10:00:00Z') }, totalTokens: 2000, costUsd: 0.10 }) },
      { data: () => ({ timestamp: { toDate: () => new Date('2026-03-09T10:00:00Z') }, totalTokens: 3000, costUsd: 0.15 }) },
    ]

    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    } as any)

    const res = await GET(new Request('http://localhost/api/users/me/analytics/trends?granularity=week'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.periods).toBeDefined()
    expect(data.periods.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/analytics/trends.test.ts
```

- [ ] **Step 3: Write the endpoint**

Create `app/api/users/me/analytics/trends/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { adminDb } from '@/lib/firebase/admin'

function getWeekKey(date: Date): string {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()) // start of week (Sunday)
  return d.toISOString().slice(0, 10)
}

function getMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7) // "2026-03"
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const granularity = url.searchParams.get('granularity') || 'week'
  const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()))

  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year + 1, 0, 1)

  const snapshot = await adminDb
    .collection('events')
    .where('userId', '==', session.user.firestoreId)
    .where('timestamp', '>=', startOfYear)
    .where('timestamp', '<', endOfYear)
    .orderBy('timestamp', 'asc')
    .get()

  const buckets = new Map<string, { tokens: number; cost: number; completions: number }>()

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const date = data.timestamp.toDate()
    const key = granularity === 'month' ? getMonthKey(date) : getWeekKey(date)

    const existing = buckets.get(key) || { tokens: 0, cost: 0, completions: 0 }
    existing.tokens += data.totalTokens || 0
    existing.cost += data.costUsd || 0
    existing.completions++
    buckets.set(key, existing)
  }

  const periods = Array.from(buckets.entries())
    .map(([period, stats], i, arr) => {
      const prev = i > 0 ? arr[i - 1][1] : null
      return {
        period,
        ...stats,
        change: prev
          ? {
              tokens: prev.tokens ? ((stats.tokens - prev.tokens) / prev.tokens) * 100 : 0,
              cost: prev.cost ? ((stats.cost - prev.cost) / prev.cost) * 100 : 0,
              completions: prev.completions
                ? ((stats.completions - prev.completions) / prev.completions) * 100
                : 0,
            }
          : null,
      }
    })
    .sort((a, b) => a.period.localeCompare(b.period))

  return NextResponse.json({ periods, granularity, year })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/analytics/trends.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/api/users/me/analytics/trends/ test/analytics/trends.test.ts
git commit -m "feat: add usage trends analytics endpoint"
```

### Task 7: Trends chart UI

**Files:**
- Create: `components/analytics/trends-chart.tsx`

- [ ] **Step 1: Create the trends chart component**

Create `components/analytics/trends-chart.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChartWrapper } from '@/lib/charts/apex-wrapper'

interface TrendPeriod {
  period: string
  tokens: number
  cost: number
  completions: number
  change: { tokens: number; cost: number; completions: number } | null
}

export function TrendsChart({ year }: { year: number }) {
  const [data, setData] = useState<TrendPeriod[]>([])
  const [granularity, setGranularity] = useState<'week' | 'month'>('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/users/me/analytics/trends?granularity=${granularity}&year=${year}`)
      .then(r => r.json())
      .then(d => setData(d.periods || []))
      .finally(() => setLoading(false))
  }, [granularity, year])

  if (loading) return <div className="h-64 animate-pulse bg-muted rounded-lg" />

  const options: ApexCharts.ApexOptions = {
    chart: { type: 'area', height: 300, stacked: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: data.map(d => d.period),
      labels: { rotate: -45, style: { fontSize: '11px' } },
    },
    yaxis: [
      { title: { text: 'Tokens' }, labels: { formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v) } },
      { opposite: true, title: { text: 'Completions' } },
    ],
    dataLabels: { enabled: false },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Usage Trends</h3>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setGranularity('week')}
            className={`px-2 py-1 rounded ${granularity === 'week' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            Weekly
          </button>
          <button
            onClick={() => setGranularity('month')}
            className={`px-2 py-1 rounded ${granularity === 'month' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            Monthly
          </button>
        </div>
      </div>
      <ChartWrapper
        type="area"
        height={300}
        options={options}
        series={[
          { name: 'Tokens', data: data.map(d => d.tokens) },
          { name: 'Completions', data: data.map(d => d.completions) },
        ]}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/analytics/trends-chart.tsx
git commit -m "feat: add usage trends chart component"
```

---

## Chunk 5: Model Breakdown

### Task 8: Model breakdown API endpoint

**Files:**
- Create: `app/api/users/me/analytics/models/route.ts`
- Create: `test/analytics/models.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/analytics/models.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: vi.fn() },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET } from '@/app/api/users/me/analytics/models/route'
import { adminDb } from '@/lib/firebase/admin'
import { auth } from '@/auth'

describe('GET /api/users/me/analytics/models', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns model breakdown with percentages', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { firestoreId: 'u1' } } as any)

    const mockDocs = [
      { data: () => ({ model: 'claude-opus-4-6', totalTokens: 5000, costUsd: 0.25 }) },
      { data: () => ({ model: 'claude-opus-4-6', totalTokens: 3000, costUsd: 0.15 }) },
      { data: () => ({ model: 'claude-sonnet-4-6', totalTokens: 2000, costUsd: 0.05 }) },
    ]

    vi.mocked(adminDb.collection).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    } as any)

    const res = await GET(new Request('http://localhost/api/users/me/analytics/models?year=2026'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.models).toHaveLength(2)
    expect(data.models[0].model).toBe('claude-opus-4-6')
    expect(data.models[0].completions).toBe(2)
    expect(data.models[0].tokens).toBe(8000)
    expect(data.models[0].percentage).toBeCloseTo(80) // 8000/10000 * 100
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/analytics/models.test.ts
```

- [ ] **Step 3: Write the endpoint**

Create `app/api/users/me/analytics/models/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()))

  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year + 1, 0, 1)

  const snapshot = await adminDb
    .collection('events')
    .where('userId', '==', session.user.firestoreId)
    .where('timestamp', '>=', startOfYear)
    .where('timestamp', '<', endOfYear)
    .get()

  const modelMap = new Map<string, { tokens: number; cost: number; completions: number }>()
  let totalTokens = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const model = data.model || 'unknown'
    const existing = modelMap.get(model) || { tokens: 0, cost: 0, completions: 0 }
    existing.tokens += data.totalTokens || 0
    existing.cost += data.costUsd || 0
    existing.completions++
    totalTokens += data.totalTokens || 0
    modelMap.set(model, existing)
  }

  const models = Array.from(modelMap.entries())
    .map(([model, stats]) => ({
      model,
      ...stats,
      percentage: totalTokens > 0 ? (stats.tokens / totalTokens) * 100 : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens)

  return NextResponse.json({ models, totalTokens, year })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/analytics/models.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/api/users/me/analytics/models/ test/analytics/models.test.ts
git commit -m "feat: add model breakdown analytics endpoint"
```

### Task 9: Model breakdown UI

**Files:**
- Create: `components/analytics/model-breakdown.tsx`

- [ ] **Step 1: Create model breakdown component**

Create `components/analytics/model-breakdown.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChartWrapper } from '@/lib/charts/apex-wrapper'

interface ModelData {
  model: string
  tokens: number
  cost: number
  completions: number
  percentage: number
}

export function ModelBreakdown({ year }: { year: number }) {
  const [models, setModels] = useState<ModelData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/me/analytics/models?year=${year}`)
      .then(r => r.json())
      .then(d => setModels(d.models || []))
      .finally(() => setLoading(false))
  }, [year])

  if (loading) return <div className="h-64 animate-pulse bg-muted rounded-lg" />
  if (models.length === 0) return null

  const formatModel = (m: string) => m.replace('claude-', '').replace(/-/g, ' ')

  const donutOptions: ApexCharts.ApexOptions = {
    chart: { type: 'donut', height: 280 },
    labels: models.map(m => formatModel(m.model)),
    legend: { position: 'bottom', fontSize: '12px' },
    plotOptions: {
      pie: {
        donut: {
          size: '60%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              formatter: () => models.reduce((sum, m) => sum + m.completions, 0).toLocaleString(),
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Model Usage</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartWrapper
          type="donut"
          height={280}
          options={donutOptions}
          series={models.map(m => m.completions)}
        />
        <div className="space-y-2">
          {models.map(m => (
            <div key={m.model} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div>
                <p className="text-sm font-medium">{formatModel(m.model)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {m.completions} completions
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono">{m.tokens.toLocaleString()} tokens</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  ${m.cost.toFixed(2)} · {m.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/analytics/model-breakdown.tsx
git commit -m "feat: add model breakdown chart and table component"
```

---

## Chunk 6: Integration into Profile

### Task 10: Wire analytics into profile page

**Files:**
- Modify: `components/profile-content.tsx`

- [ ] **Step 1: Add analytics section to profile-content.tsx**

Add imports and render the analytics components below the existing stats grid in `profile-content.tsx`. The analytics section should only show for the profile owner (when `isOwner` is true).

After the existing completions/stats section, add:

```tsx
import { PeakHoursChart } from '@/components/analytics/peak-hours-chart'
import { StreakDisplay } from '@/components/analytics/streak-display'
import { TrendsChart } from '@/components/analytics/trends-chart'
import { ModelBreakdown } from '@/components/analytics/model-breakdown'
```

And in the JSX, after the stats grid and before the completions list:

```tsx
{isOwner && (
  <div className="space-y-8 mt-8">
    <StreakDisplay />
    <TrendsChart year={year} />
    <ModelBreakdown year={year} />
    <PeakHoursChart year={year} />
  </div>
)}
```

- [ ] **Step 2: Verify the dev server renders correctly**

```bash
npm run dev
```

Open the profile page and verify analytics sections appear.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add components/profile-content.tsx
git commit -m "feat: integrate analytics components into profile page"
```

### Task 11: Add streak data to public profile API

**Files:**
- Modify: `app/api/users/[username]/route.ts`

- [ ] **Step 1: Add streak calculation to public user endpoint**

In the GET handler, after fetching the user stats, calculate streaks from events and include in response:

```typescript
// Add streak data
const activeDatesSet = new Set<string>()
eventsSnap.docs.forEach(doc => {
  const ts = doc.data().timestamp?.toDate()
  if (ts) activeDatesSet.add(ts.toISOString().slice(0, 10))
})
const activeDates = Array.from(activeDatesSet).sort().reverse()

let currentStreak = 0
const today = new Date().toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const startDate = activeDates[0] === today || activeDates[0] === yesterday ? activeDates[0] : null
if (startDate) {
  for (let i = 0; i < activeDates.length; i++) {
    const expected = new Date(startDate)
    expected.setDate(expected.getDate() - i)
    if (activeDates[i] === expected.toISOString().slice(0, 10)) currentStreak++
    else break
  }
}
```

Add `currentStreak` to the response JSON.

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

- [ ] **Step 3: Commit**

```bash
git add app/api/users/\\[username\\]/route.ts
git commit -m "feat: include streak data in public profile API"
```
