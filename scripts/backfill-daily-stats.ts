/**
 * Backfill daily stats from existing events.
 * Run once: npx tsx scripts/backfill-daily-stats.ts
 */
import 'dotenv/config'
import { adminDb } from '../lib/firebase/admin'

async function backfill() {
  console.log('Fetching all events...')
  const eventsSnapshot = await adminDb.collection('events').get()
  console.log(`Found ${eventsSnapshot.size} events`)

  // Group by userId + date
  const updates = new Map<string, {
    userId: string
    date: string
    tokens: number
    cost: number
    completions: number
    models: Record<string, number>
    modelTokens: Record<string, number>
    modelCost: Record<string, number>
    hours: Record<string, number>
    dayOfWeek: number
  }>()

  for (const doc of eventsSnapshot.docs) {
    const data = doc.data()
    const userId = data.userId
    const timestamp = data.timestamp?.toDate?.()
    if (!userId || !timestamp) continue

    const dateStr = timestamp.toISOString().slice(0, 10)
    const hour = timestamp.getUTCHours()
    const dayOfWeek = timestamp.getUTCDay()
    const key = `${userId}/${dateStr}`
    const model = data.model || 'unknown'

    const existing = updates.get(key) || {
      userId,
      date: dateStr,
      tokens: 0,
      cost: 0,
      completions: 0,
      models: {} as Record<string, number>,
      modelTokens: {} as Record<string, number>,
      modelCost: {} as Record<string, number>,
      hours: {} as Record<string, number>,
      dayOfWeek,
    }

    existing.tokens += data.totalTokens || 0
    existing.cost += data.costUsd || 0
    existing.completions += 1
    existing.models[model] = (existing.models[model] || 0) + 1
    existing.modelTokens[model] = (existing.modelTokens[model] || 0) + (data.totalTokens || 0)
    existing.modelCost[model] = (existing.modelCost[model] || 0) + (data.costUsd || 0)
    existing.hours[String(hour)] = (existing.hours[String(hour)] || 0) + 1
    updates.set(key, existing)
  }

  console.log(`Writing ${updates.size} daily stat documents...`)

  const batch = adminDb.batch()
  let count = 0

  for (const [key, stats] of updates) {
    const [userId, date] = key.split('/')
    const ref = adminDb
      .collection('userStats')
      .doc(userId)
      .collection('daily')
      .doc(date)

    batch.set(ref, {
      date: stats.date,
      tokens: stats.tokens,
      cost: stats.cost,
      completions: stats.completions,
      models: stats.models,
      modelTokens: stats.modelTokens,
      modelCost: stats.modelCost,
      hours: stats.hours,
      dayOfWeek: stats.dayOfWeek,
      updatedAt: new Date(),
    })

    count++
    // Firestore batch limit is 500
    if (count % 450 === 0) {
      await batch.commit()
      console.log(`  Committed ${count} docs...`)
    }
  }

  await batch.commit()
  console.log(`Done! Wrote ${count} daily stat documents.`)
}

backfill().catch(console.error)
