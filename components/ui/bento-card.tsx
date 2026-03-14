interface BentoCardProps {
  children: React.ReactNode
  className?: string
  span?: 1 | 2
}

export function BentoCard({ children, className = '', span = 1 }: BentoCardProps) {
  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl p-4
        bg-white/70 dark:bg-gray-900/70
        backdrop-blur-md
        border border-gray-200/60 dark:border-gray-700/60
        shadow-sm
        transition-all duration-200 ease-out
        hover:shadow-md hover:-translate-y-0.5
        ${span === 2 ? 'col-span-1 md:col-span-2' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
