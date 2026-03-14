'use client'

import { useEffect, useState } from 'react'
import { ChartWrapper } from '@/lib/charts/apex-wrapper'

interface PeakHoursData {
  hourly: { hour: number; completions: number; tokens: number; cost: number }[]
  daily: { day: number; completions: number; tokens: number; cost: number }[]
}

export function PeakHoursChart({ year }: { year: number }) {
  const [data, setData] = useState<PeakHoursData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/me/analytics/peak-hours?year=${year}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [year])

  if (loading || !data) return <div className="h-64 animate-pulse bg-muted rounded-lg" />

  const hourLabels = Array.from({ length: 24 }, (_, i) =>
    i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`
  )

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const hourlyOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', height: 280 },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    xaxis: { categories: hourLabels, labels: { rotate: -45, style: { fontSize: '11px' } } },
    yaxis: { title: { text: 'Completions' } },
    dataLabels: { enabled: false },
  }

  const dailyOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', height: 220 },
    plotOptions: { bar: { borderRadius: 4, horizontal: true } },
    xaxis: { categories: dayLabels },
    yaxis: { title: { text: '' } },
    dataLabels: { enabled: false },
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Activity by Hour</h3>
        <ChartWrapper
          type="bar"
          height={280}
          options={hourlyOptions}
          series={[{ name: 'Completions', data: data.hourly.map(h => h.completions) }]}
        />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Activity by Day</h3>
        <ChartWrapper
          type="bar"
          height={220}
          options={dailyOptions}
          series={[{ name: 'Completions', data: data.daily.map(d => d.completions) }]}
        />
      </div>
    </div>
  )
}
