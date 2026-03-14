import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { adminDb } from '@/lib/firebase/admin'

function getWeekKey(date: Date): string {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.toISOString().slice(0, 10)
}

function getMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
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

    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year + 1, 0, 1)

    // Single query for all analytics
    const snapshot = await adminDb
      .collection('events')
      .where('userId', '==', session.user.firestoreId)
      .where('timestamp', '>=', startOfYear)
      .where('timestamp', '<', endOfYear)
      .orderBy('timestamp', 'asc')
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
    const activeDatesSet = new Set<string>()

    for (const doc of snapshot.docs) {
      const data = doc.data()
      const date = data.timestamp.toDate()
      const tokens = data.totalTokens || 0
      const cost = data.costUsd || 0

      // Peak hours
      const hour = date.getUTCHours()
      const day = date.getUTCDay()
      hourly[hour].completions++
      hourly[hour].tokens += tokens
      hourly[hour].cost += cost
      daily[day].completions++
      daily[day].tokens += tokens
      daily[day].cost += cost

      // Trends
      const trendKey = granularity === 'month' ? getMonthKey(date) : getWeekKey(date)
      const existing = trendBuckets.get(trendKey) || { tokens: 0, cost: 0, completions: 0 }
      existing.tokens += tokens
      existing.cost += cost
      existing.completions++
      trendBuckets.set(trendKey, existing)

      // Models
      const model = data.model || 'unknown'
      const modelExisting = modelMap.get(model) || { tokens: 0, cost: 0, completions: 0 }
      modelExisting.tokens += tokens
      modelExisting.cost += cost
      modelExisting.completions++
      totalTokens += tokens
      modelMap.set(model, modelExisting)

      // Streaks
      activeDatesSet.add(date.toISOString().slice(0, 10))
    }

    // Compute trend periods with change
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

    // Compute models with percentages
    const models = Array.from(modelMap.entries())
      .map(([model, stats]) => ({
        model,
        ...stats,
        percentage: totalTokens > 0 ? (stats.tokens / totalTokens) * 100 : 0,
      }))
      .sort((a, b) => b.tokens - a.tokens)

    // Compute streaks
    const activeDates = Array.from(activeDatesSet).sort().reverse()
    let currentStreak = 0
    let longestStreak = activeDates.length > 0 ? 1 : 0
    let streak = 1

    if (activeDates.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      const startDate = activeDates[0] === today || activeDates[0] === yesterday ? activeDates[0] : null

      if (startDate) {
        for (let i = 0; i < activeDates.length; i++) {
          const expected = new Date(startDate)
          expected.setDate(expected.getDate() - i)
          if (activeDates[i] === expected.toISOString().slice(0, 10)) {
            currentStreak++
          } else break
        }
      }

      const sortedAsc = [...activeDates].reverse()
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
      models: { models, totalTokens },
      streaks: { currentStreak, longestStreak, totalActiveDays: activeDates.length },
      year,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
