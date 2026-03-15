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
  const dateStr = event.timestamp.toISOString().slice(0, 10)
  const year = dateStr.slice(0, 4)
  const hour = event.timestamp.getUTCHours()
  const day = event.timestamp.getUTCDay()
  const model = event.model || 'unknown'

  const yearlyRef = adminDb
    .collection('userStats')
    .doc(event.userId)
    .collection('yearly')
    .doc(year)

  await yearlyRef.set(
    {
      totalTokens: FieldValue.increment(event.totalTokens),
      totalCost: FieldValue.increment(event.costUsd),
      completionCount: FieldValue.increment(1),
      [`heatmap.${dateStr}.tokens`]: FieldValue.increment(event.totalTokens),
      [`heatmap.${dateStr}.completions`]: FieldValue.increment(1),
      [`models.${model}`]: FieldValue.increment(1),
      [`modelTokens.${model}`]: FieldValue.increment(event.totalTokens),
      [`modelCost.${model}`]: FieldValue.increment(event.costUsd),
      [`hours.${hour}`]: FieldValue.increment(1),
      [`daily.${day}`]: FieldValue.increment(1),
      [`dailyTokens.${day}`]: FieldValue.increment(event.totalTokens),
      [`dailyCost.${day}`]: FieldValue.increment(event.costUsd),
      updatedAt: new Date(),
    },
    { merge: true }
  )
}
