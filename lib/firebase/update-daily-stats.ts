import { adminDb } from './admin'
import { FieldValue } from 'firebase-admin/firestore'

interface EventData {
  userId: string
  model: string | null
  totalTokens: number
  costUsd: number
  timestamp: Date
}

export async function updateDailyStats(event: EventData) {
  const dateStr = event.timestamp.toISOString().slice(0, 10) // "2026-03-14"
  const hour = event.timestamp.getUTCHours()
  const day = event.timestamp.getUTCDay() // 0=Sun

  const ref = adminDb
    .collection('userStats')
    .doc(event.userId)
    .collection('daily')
    .doc(dateStr)

  await ref.set(
    {
      date: dateStr,
      tokens: FieldValue.increment(event.totalTokens),
      cost: FieldValue.increment(event.costUsd),
      completions: FieldValue.increment(1),
      [`models.${event.model || 'unknown'}`]: FieldValue.increment(1),
      [`modelTokens.${event.model || 'unknown'}`]: FieldValue.increment(event.totalTokens),
      [`modelCost.${event.model || 'unknown'}`]: FieldValue.increment(event.costUsd),
      [`hours.${hour}`]: FieldValue.increment(1),
      dayOfWeek: day,
      updatedAt: new Date(),
    },
    { merge: true }
  )
}
