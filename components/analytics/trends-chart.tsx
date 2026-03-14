'use client'

import { ChartWrapper } from '@/lib/charts/apex-wrapper'

interface TrendPeriod {
  period: string
  tokens: number
  cost: number
  completions: number
  change: { tokens: number; cost: number; completions: number } | null
}

interface Props {
  data: {
    periods: TrendPeriod[]
    granularity: string
  }
  granularity: 'week' | 'month'
  onGranularityChange: (g: 'week' | 'month') => void
}

export function TrendsChart({ data, granularity, onGranularityChange }: Props) {
  if (data.periods.length === 0) return null

  const options: ApexCharts.ApexOptions = {
    chart: { type: 'area', height: 260 },
    stroke: { curve: 'straight', width: 2 },
    xaxis: {
      categories: data.periods.map(d => d.period),
    },
    yaxis: [
      {
        title: { text: 'tokens' },
        labels: {
          formatter: (v: number) => {
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}m`
            if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
            return String(Math.round(v))
          },
        },
      },
      {
        opposite: true,
        title: { text: 'completions' },
      },
    ],
    dataLabels: { enabled: false },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent">~ usage trends</h3>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => onGranularityChange('week')}
            className={`px-2 py-1 rounded font-mono-accent press-effect ${granularity === 'week' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            weekly
          </button>
          <button
            onClick={() => onGranularityChange('month')}
            className={`px-2 py-1 rounded font-mono-accent press-effect ${granularity === 'month' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            monthly
          </button>
        </div>
      </div>
      <ChartWrapper
        type="area"
        height={260}
        options={options}
        series={[
          { name: 'tokens', data: data.periods.map(d => d.tokens) },
          { name: 'completions', data: data.periods.map(d => d.completions) },
        ]}
      />
    </div>
  )
}
