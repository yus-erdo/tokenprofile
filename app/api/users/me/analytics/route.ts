import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { adminDb } from '@/lib/firebase/admin'

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.toISOString().slice(0, 10)
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()))
    const granularity = url.searchParams.get('granularity') || 'week'

    // Read pre-aggregated daily stats instead of all events
    const snapshot = await adminDb
      .collection('userStats')
      .doc(session.user.firestoreId)
      .collection('daily')
      .where('date', '>=', `${year}-01-01`)
      .where('date', '<=', `${year}-12-31`)
      .orderBy('date', 'asc')
      .get()

    // Peak hours
    const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, completions: 0, tokens: 0, cost: 0 }))
    const daily = Array.from({ length: 7 }, (_, i) => ({ day: i, completions: 0, tokens: 0, cost: 0 }))

    // Trends
    const trendBuckets = new Map<string, { tokens: number; cost: number; completions: number }>()

    // Models
    const modelMap = new Map<string, { tokens: number; cost: number; completions: number }>()
    let totalTokens = 0

    // Streaks
    const activeDates: string[] = []

    for (const doc of snapshot.docs) {
      const data = doc.data()
      const dateStr = data.date as string
      const tokens = data.tokens || 0
      const cost = data.cost || 0
      const completions = data.completions || 0
      const dayOfWeek = data.dayOfWeek ?? new Date(dateStr).getUTCDay()

      // Peak hours — aggregate from hourly buckets
      const hours = data.hours as Record<string, number> | undefined
      if (hours) {
        for (const [h, count] of Object.entries(hours)) {
          const hi = parseInt(h)
          hourly[hi].completions += count
        }
      }

      // Day of week
      daily[dayOfWeek].completions += completions
      daily[dayOfWeek].tokens += tokens
      daily[dayOfWeek].cost += cost

      // Trends
      const trendKey = granularity === 'month' ? getMonthKey(dateStr) : getWeekKey(dateStr)
      const existing = trendBuckets.get(trendKey) || { tokens: 0, cost: 0, completions: 0 }
      existing.tokens += tokens
      existing.cost += cost
      existing.completions += completions
      trendBuckets.set(trendKey, existing)

      // Models
      const models = data.models as Record<string, number> | undefined
      const modelTokens = data.modelTokens as Record<string, number> | undefined
      const modelCost = data.modelCost as Record<string, number> | undefined
      if (models) {
        for (const [model, count] of Object.entries(models)) {
          const m = modelMap.get(model) || { tokens: 0, cost: 0, completions: 0 }
          m.completions += count
          m.tokens += modelTokens?.[model] || 0
          m.cost += modelCost?.[model] || 0
          modelMap.set(model, m)
        }
      }
      totalTokens += tokens

      // Streaks
      if (completions > 0) activeDates.push(dateStr)
    }

    // Compute trend periods
    const periods = Array.from(trendBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, stats], i, arr) => {
        const prev = i > 0 ? arr[i - 1][1] : null
        return {
          period,
          ...stats,
          change: prev ? {
            tokens: prev.tokens ? ((stats.tokens - prev.tokens) / prev.tokens) * 100 : 0,
            cost: prev.cost ? ((stats.cost - prev.cost) / prev.cost) * 100 : 0,
            completions: prev.completions ? ((stats.completions - prev.completions) / prev.completions) * 100 : 0,
          } : null,
        }
      })

    // Models with percentages
    const modelsResult = Array.from(modelMap.entries())
      .map(([model, stats]) => ({
        model,
        ...stats,
        percentage: totalTokens > 0 ? (stats.tokens / totalTokens) * 100 : 0,
      }))
      .sort((a, b) => b.tokens - a.tokens)

    // Streaks
    const sortedDates = activeDates.sort().reverse()
    let currentStreak = 0
    let longestStreak = sortedDates.length > 0 ? 1 : 0
    let streak = 1

    if (sortedDates.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      const startDate = sortedDates[0] === today || sortedDates[0] === yesterday ? sortedDates[0] : null

      if (startDate) {
        for (let i = 0; i < sortedDates.length; i++) {
          const expected = new Date(startDate)
          expected.setDate(expected.getDate() - i)
          if (sortedDates[i] === expected.toISOString().slice(0, 10)) currentStreak++
          else break
        }
      }

      const sortedAsc = [...sortedDates].reverse()
      for (let i = 1; i < sortedAsc.length; i++) {
        const prev = new Date(sortedAsc[i - 1])
        const curr = new Date(sortedAsc[i])
        if ((curr.getTime() - prev.getTime()) / 86400000 === 1) {
          streak++
          longestStreak = Math.max(longestStreak, streak)
        } else {
          streak = 1
        }
      }
    }

    return NextResponse.json({
      peakHours: { hourly, daily },
      trends: { periods, granularity },
      models: { models: modelsResult, totalTokens },
      streaks: { currentStreak, longestStreak, totalActiveDays: activeDates.length },
      year,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
