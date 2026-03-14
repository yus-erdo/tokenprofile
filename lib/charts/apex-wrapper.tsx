'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { chartColors } from './chart-colors'
import type { Props as ApexChartProps } from 'react-apexcharts'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface ChartWrapperProps extends Omit<ApexChartProps, 'options'> {
  options: ApexCharts.ApexOptions
}

export function ChartWrapper({ options, ...props }: ChartWrapperProps) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const colors = isDark ? chartColors.dark : chartColors.light

  const themedOptions: ApexCharts.ApexOptions = {
    ...options,
    theme: { mode: isDark ? 'dark' : 'light' },
    chart: {
      ...options.chart,
      background: 'transparent',
      toolbar: { show: false, ...options.chart?.toolbar },
      foreColor: colors.foreground,
    },
    grid: {
      borderColor: colors.gridLine,
      ...options.grid,
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      ...options.tooltip,
    },
    colors: options.colors || colors.series,
  }

  return <ReactApexChart options={themedOptions} {...props} />
}
