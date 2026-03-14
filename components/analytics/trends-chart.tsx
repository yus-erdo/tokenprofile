'use client'

import { useEffect, useState } from 'react'
import { ChartWrapper } from '@/lib/charts/apex-wrapper'

interface TrendPeriod {
  period: string
  tokens: number
  cost: number
  completions: number
  change: { tokens: number; cost: number; completions: number } | null
}

export function TrendsChart({ year }: { year: number }) {
  const [data, setData] = useState<TrendPeriod[]>([])
  const [granularity, setGranularity] = useState<'week' | 'month'>('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/users/me/analytics/trends?granularity=${granularity}&year=${year}`)
      .then(r => r.json())
      .then(d => setData(d.periods || []))
      .finally(() => setLoading(false))
  }, [granularity, year])

  if (loading) return <div className="h-64 animate-pulse bg-muted rounded-lg" />

  const options: ApexCharts.ApexOptions = {
    chart: { type: 'area', height: 300, stacked: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: data.map(d => d.period),
      labels: { rotate: -45, style: { fontSize: '11px' } },
    },
    yaxis: [
      { title: { text: 'Tokens' }, labels: { formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v) } },
      { opposite: true, title: { text: 'Completions' } },
    ],
    dataLabels: { enabled: false },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Usage Trends</h3>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setGranularity('week')}
            className={`px-2 py-1 rounded ${granularity === 'week' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            Weekly
          </button>
          <button
            onClick={() => setGranularity('month')}
            className={`px-2 py-1 rounded ${granularity === 'month' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            Monthly
          </button>
        </div>
      </div>
      <ChartWrapper
        type="area"
        height={300}
        options={options}
        series={[
          { name: 'Tokens', data: data.map(d => d.tokens) },
          { name: 'Completions', data: data.map(d => d.completions) },
        ]}
      />
    </div>
  )
}
