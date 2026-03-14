'use client'

import { useEffect, useState } from 'react'

interface ModelData {
  model: string
  tokens: number
  cost: number
  completions: number
  percentage: number
}

export function ModelBreakdown({ year }: { year: number }) {
  const [models, setModels] = useState<ModelData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/me/analytics/models?year=${year}`)
      .then(r => r.json())
      .then(d => setModels(d.models || []))
      .finally(() => setLoading(false))
  }, [year])

  if (loading) return <div className="h-32 animate-pulse bg-gray-100 dark:bg-gray-900 rounded-lg" />
  if (models.length === 0) return null

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-3">~ models</h3>
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        {models.map((m, i) => (
          <div
            key={m.model}
            className={`flex items-center justify-between px-4 py-2.5 ${i !== 0 ? 'border-t border-gray-100 dark:border-gray-800/50' : ''}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono-accent font-medium text-gray-900 dark:text-gray-100 truncate">{m.model}</span>
              <span className="text-xs font-mono-accent text-gray-400 dark:text-gray-600">{m.completions} runs</span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs font-mono-accent text-gray-700 dark:text-gray-300">{m.tokens.toLocaleString()} <span className="text-gray-400 dark:text-gray-600">tok</span></span>
              <span className="text-xs font-mono-accent text-gray-700 dark:text-gray-300">${m.cost.toFixed(2)}</span>
              <span className="text-xs font-mono-accent text-gray-400 dark:text-gray-600 w-12 text-right">{m.percentage.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
