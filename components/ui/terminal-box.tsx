interface TerminalBoxProps {
  label?: string
  children: React.ReactNode
  className?: string
}

export function TerminalBox({ label, children, className = '' }: TerminalBoxProps) {
  return (
    <div className={`relative border border-gray-300 dark:border-[#30363d] ${className}`}>
      {label && (
        <span className="absolute -top-2 left-2 px-1.5 text-sm font-mono-accent text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-950 leading-none">
          {label}
        </span>
      )}
      <div className="px-3 pt-3 pb-2">
        {children}
      </div>
    </div>
  )
}
