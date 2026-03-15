import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()))

    // Single doc read
    const yearlyDoc = await adminDb
      .collection('userStats')
      .doc(session.user.firestoreId)
      .collection('yearly')
      .doc(String(year))
      .get()

    if (!yearlyDoc.exists) {
      return NextResponse.json({
        peakHours: { hourly: Array.from({ length: 24 }, (_, i) => ({ hour: i, completions: 0, tokens: 0, cost: 0 })), daily: Array.from({ length: 7 }, (_, i) => ({ day: i, completions: 0, tokens: 0, cost: 0 })) },
        trends: { periods: [], granularity: 'week' },
        models: { models: [], totalTokens: 0 },
        streaks: { currentStreak: 0, longestStreak: 0, totalActiveDays: 0 },
        year,
      })
    }

    const data = yearlyDoc.data()!
    return NextResponse.json({ ...data, year })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
