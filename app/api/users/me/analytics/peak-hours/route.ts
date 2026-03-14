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
