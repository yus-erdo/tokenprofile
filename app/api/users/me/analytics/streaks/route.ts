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
