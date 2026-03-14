interface BentoCardProps {
  children: React.ReactNode
  className?: string
  span?: 1 | 2
}

export function BentoCard({ children, className = '', span = 1 }: BentoCardProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-lg p-4
        bg-gray-50 dark:bg-gray-900
        border border-gray-200 dark:border-gray-800
        transition-colors duration-200
        ${span === 2 ? 'col-span-1 md:col-span-2' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
