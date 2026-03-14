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
