/**
 * Backfill yearly stats from existing events.
 * Run once: npx tsx --require dotenv/config scripts/backfill-daily-stats.ts
 * Set DOTENV_CONFIG_PATH=.env.local
 */
import 'dotenv/config'
import { adminDb } from '../lib/firebase/admin'

interface YearlyStats {
  totalTokens: number
  totalCost: number
  completionCount: number
  heatmap: Record<string, { tokens: number; completions: number }>
  models: Record<string, number>
  modelTokens: Record<string, number>
  modelCost: Record<string, number>
  hours: Record<string, number>
  daily: Record<string, number>
  dailyTokens: Record<string, number>
  dailyCost: Record<string, number>
  updatedAt: Date
}

async function backfill() {
  console.log('Fetching all events...')
  const eventsSnapshot = await adminDb.collection('events').get()
  console.log(`Found ${eventsSnapshot.size} events`)

  // Group by userId + year
  const yearlyMap = new Map<string, YearlyStats>()

  for (const doc of eventsSnapshot.docs) {
    const data = doc.data()
    const userId = data.userId
    const timestamp = data.timestamp?.toDate?.()
    if (!userId || !timestamp) continue

    const dateStr = timestamp.toISOString().slice(0, 10)
    const year = dateStr.slice(0, 4)
    const hour = String(timestamp.getUTCHours())
    const day = String(timestamp.getUTCDay())
    const model = data.model || 'unknown'
    const tokens = data.totalTokens || 0
    const cost = data.costUsd || 0
    const key = `${userId}/${year}`

    const existing = yearlyMap.get(key) || {
      totalTokens: 0,
      totalCost: 0,
      completionCount: 0,
      heatmap: {},
      models: {},
      modelTokens: {},
      modelCost: {},
      hours: {},
      daily: {},
      dailyTokens: {},
      dailyCost: {},
      updatedAt: new Date(),
    }

    existing.totalTokens += tokens
    existing.totalCost += cost
    existing.completionCount += 1

    // Heatmap
    if (!existing.heatmap[dateStr]) existing.heatmap[dateStr] = { tokens: 0, completions: 0 }
    existing.heatmap[dateStr].tokens += tokens
    existing.heatmap[dateStr].completions += 1

    // Models
    existing.models[model] = (existing.models[model] || 0) + 1
    existing.modelTokens[model] = (existing.modelTokens[model] || 0) + tokens
    existing.modelCost[model] = (existing.modelCost[model] || 0) + cost

    // Hours
    existing.hours[hour] = (existing.hours[hour] || 0) + 1

    // Day of week
    existing.daily[day] = (existing.daily[day] || 0) + 1
    existing.dailyTokens[day] = (existing.dailyTokens[day] || 0) + tokens
    existing.dailyCost[day] = (existing.dailyCost[day] || 0) + cost

    yearlyMap.set(key, existing)
  }

  console.log(`Writing ${yearlyMap.size} yearly stat documents...`)

  for (const [key, stats] of yearlyMap) {
    const [userId, year] = key.split('/')
    const ref = adminDb
      .collection('userStats')
      .doc(userId)
      .collection('yearly')
      .doc(year)

    await ref.set(stats)
    console.log(`  Wrote ${key}: ${stats.completionCount} completions, ${Object.keys(stats.heatmap).length} active days`)
  }

  console.log('Done!')
}

backfill().catch(console.error)
