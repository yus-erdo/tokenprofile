'use client'

import { useEffect, useState } from 'react'

interface StreakData {
  currentStreak: number
  longestStreak: number
  totalActiveDays: number
}

export function StreakDisplay() {
  const [data, setData] = useState<StreakData | null>(null)

  useEffect(() => {
    fetch('/api/users/me/analytics/streaks')
      .then(r => r.json())
      .then(setData)
  }, [])

  if (!data) return null

  return (
    <div className="flex gap-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
        <span className="text-lg" role="img" aria-label="fire">&#x1F525;</span>
        <div>
          <p className="text-xl font-bold font-mono text-orange-600 dark:text-orange-400">
            {data.currentStreak}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Current Streak</p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
        <span className="text-lg" role="img" aria-label="trophy">&#x1F3C6;</span>
        <div>
          <p className="text-xl font-bold font-mono text-yellow-600 dark:text-yellow-400">
            {data.longestStreak}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Longest Streak</p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <span className="text-lg" role="img" aria-label="calendar">&#x1F4C5;</span>
        <div>
          <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {data.totalActiveDays}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Active Days</p>
        </div>
      </div>
    </div>
  )
}
