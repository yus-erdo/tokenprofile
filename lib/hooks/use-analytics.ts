'use client'

import { useEffect, useState, useCallback } from 'react'

interface AnalyticsData {
  peakHours: {
    hourly: { hour: number; completions: number; tokens: number; cost: number }[]
    daily: { day: number; completions: number; tokens: number; cost: number }[]
  }
  trends: {
    periods: { period: string; tokens: number; cost: number; completions: number; change: { tokens: number; cost: number; completions: number } | null }[]
    granularity: string
  }
  models: {
    models: { model: string; tokens: number; cost: number; completions: number; percentage: number }[]
    totalTokens: number
  }
  streaks: {
    currentStreak: number
    longestStreak: number
    totalActiveDays: number
  }
}

const cache = new Map<string, { data: AnalyticsData; timestamp: number }>()
const CACHE_TTL = 30_000 // 30 seconds

export function useAnalytics(year: number, granularity: 'week' | 'month' = 'week') {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    const key = `${year}-${granularity}`
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setData(cached.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/users/me/analytics?year=${year}&granularity=${granularity}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      cache.set(key, { data: json, timestamp: Date.now() })
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [year, granularity])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error }
}
