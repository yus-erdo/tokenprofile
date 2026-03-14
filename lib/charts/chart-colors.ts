export const chartColors = {
  light: {
    primary: '#2563eb',
    secondary: '#7c3aed',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    muted: '#9ca3af',
    background: '#ffffff',
    foreground: '#111827',
    gridLine: '#e5e7eb',
    series: ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d'],
  },
  dark: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    muted: '#6b7280',
    background: '#0a0a0a',
    foreground: '#f9fafb',
    gridLine: '#1f2937',
    series: ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'],
  },
} as const

export type ThemeColors = typeof chartColors.light
