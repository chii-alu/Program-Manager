import React from 'react'
import { Inbox } from 'lucide-react'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  compact,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  body?: React.ReactNode
  action?: { label: string; onClick: () => void }
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col items-center px-6 text-center ${compact ? 'py-8' : 'py-14'}`}>
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-canvas text-muted">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{body}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex h-9 items-center rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-semibold text-ink transition-colors duration-150 ease-out hover:bg-canvas"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
