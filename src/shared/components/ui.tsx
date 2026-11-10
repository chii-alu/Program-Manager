import React from 'react'
import { Lock } from 'lucide-react'
import { Pillar, SessionStatus } from '../data/mela'

export function AdminOnly() {
  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-surface text-muted shadow-[0_0_0_1px_var(--color-line)]">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">MELA admins only</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted">This page holds cross-pillar and identity data. Ask the MELA team if you need a report from it.</p>
      </div>
    </div>
  )
}

const statusStyle: Record<SessionStatus, string> = {
  open: 'bg-good-bg text-good',
  upcoming: 'bg-brand-50 text-brand-600',
  completed: 'bg-canvas text-muted',
  draft: 'bg-warn-bg text-warn',
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium capitalize ${statusStyle[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

export const PillarTag: React.FC<{ pillar: Pillar }> = ({ pillar }) => {
  return (
    <span className="inline-flex h-5 items-center whitespace-nowrap rounded border border-line bg-surface px-1.5 text-[11px] font-semibold tracking-wide text-body">
      {pillar}
    </span>
  )
}

export function HealthDot({ tone }: { tone: 'good' | 'warn' | 'bad' }) {
  const c = tone === 'good' ? 'bg-good' : tone === 'warn' ? 'bg-warn' : 'bg-bad'
  const l = tone === 'good' ? 'On track' : tone === 'warn' ? 'Needs a look' : 'At risk'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={`h-2 w-2 rounded-full ${c}`} />
      {l}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: string
  description?: React.ReactNode
  crumbs?: string[]
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <ol className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {crumbs.map((c, i) => (
              <li key={c} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-faint">/</span>}
                <span className={i === crumbs.length - 1 ? 'font-medium text-ink' : ''}>{c}</span>
              </li>
            ))}
          </ol>
        )}
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Button({
  children,
  variant = 'secondary',
  onClick,
  className = '',
}: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  onClick?: () => void
  className?: string
}) {
  const v =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-hover'
      : 'border border-line-strong bg-surface text-ink hover:bg-canvas'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition-colors duration-150 ease-out ${v} ${className}`}
    >
      {children}
    </button>
  )
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-xl border border-line bg-surface ${className}`}>{children}</section>
}
