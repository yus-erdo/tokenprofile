'use client'

import { useEffect, useState } from 'react'
import { ChartWrapper } from '@/lib/charts/apex-wrapper'

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

  if (loading) return <div className="h-64 animate-pulse bg-muted rounded-lg" />
  if (models.length === 0) return null

  const formatModel = (m: string) => m.replace('claude-', '').replace(/-/g, ' ')

  const donutOptions: ApexCharts.ApexOptions = {
    chart: { type: 'donut', height: 280 },
    labels: models.map(m => formatModel(m.model)),
    legend: { position: 'bottom', fontSize: '12px' },
    plotOptions: {
      pie: {
        donut: {
          size: '60%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              formatter: () => models.reduce((sum, m) => sum + m.completions, 0).toLocaleString(),
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Model Usage</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartWrapper
          type="donut"
          height={280}
          options={donutOptions}
          series={models.map(m => m.completions)}
        />
        <div className="space-y-2">
          {models.map(m => (
            <div key={m.model} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div>
                <p className="text-sm font-medium">{formatModel(m.model)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {m.completions} completions
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono">{m.tokens.toLocaleString()} tokens</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  ${m.cost.toFixed(2)} · {m.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
