'use client'

interface StreakData {
  currentStreak: number
  longestStreak: number
  totalActiveDays: number
}

export function StreakDisplay({ data }: { data: StreakData }) {
  const items = [
    { label: 'current streak', value: `${data.currentStreak}d` },
    { label: 'longest streak', value: `${data.longestStreak}d` },
    { label: 'active days', value: String(data.totalActiveDays) },
  ]

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex items-center justify-between px-4 py-2.5 ${i !== 0 ? 'border-t border-gray-100 dark:border-gray-800/50' : ''}`}
        >
          <span className="text-xs font-mono-accent text-gray-500 dark:text-gray-500">{item.label}</span>
          <span className="text-sm font-mono-accent font-bold text-gray-900 dark:text-gray-100">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
