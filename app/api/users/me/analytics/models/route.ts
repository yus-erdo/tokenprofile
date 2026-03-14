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

  const modelMap = new Map<string, { tokens: number; cost: number; completions: number }>()
  let totalTokens = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const model = data.model || 'unknown'
    const existing = modelMap.get(model) || { tokens: 0, cost: 0, completions: 0 }
    existing.tokens += data.totalTokens || 0
    existing.cost += data.costUsd || 0
    existing.completions++
    totalTokens += data.totalTokens || 0
    modelMap.set(model, existing)
  }

  const models = Array.from(modelMap.entries())
    .map(([model, stats]) => ({
      model,
      ...stats,
      percentage: totalTokens > 0 ? (stats.tokens / totalTokens) * 100 : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens)

  return NextResponse.json({ models, totalTokens, year })
}
