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
  upcoming: 'bg-brand-50 text-brand',
  completed: 'bg-canvas text-muted',
  draft: 'bg-warn-bg text-warn',
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-semibold capitalize ${statusStyle[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

/** Executive pill: brand-tinted, uppercase. */
export const PillarTag: React.FC<{ pillar: Pillar }> = ({ pillar }) => {
  return (
    <span className="inline-flex h-5 items-center whitespace-nowrap rounded bg-brand-50 px-1.5 text-[10px] font-bold uppercase tracking-wide text-brand">
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

/**
 * Page hero, after the executive dashboard's navy page header: crumbs as a small
 * tracked label, the title in white, actions on the right. Buttons inside adapt
 * to the navy through the `hero` class.
 */
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
    <div className="hero flex flex-col gap-4 rounded-[var(--radius-card)] bg-brand-hover px-5 py-4 text-white sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
      <div className="min-w-0">
        {crumbs && (
          <ol className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
            {crumbs.map((c, i) => (
              <li key={c} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-white/40">/</span>}
                <span className={i === crumbs.length - 1 ? 'text-white/85' : ''}>{c}</span>
              </li>
            ))}
          </ol>
        )}
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
        {description && (
          <p className="mt-1 text-[13px] leading-5 text-white/75 [&_.text-brand-600]:text-white [&_.text-ink]:text-white [&_.text-muted]:text-white/60">{description}</p>
        )}
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
      ? 'bg-brand text-white hover:bg-brand-hover [.hero_&]:bg-white [.hero_&]:text-brand [.hero_&]:hover:bg-brand-50'
      : 'border border-line bg-surface text-body hover:bg-canvas [.hero_&]:border-white/30 [.hero_&]:bg-white/10 [.hero_&]:text-white [.hero_&]:hover:bg-white/20'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 text-[13px] font-semibold transition-colors duration-150 ease-out ${v} ${className}`}
    >
      {children}
    </button>
  )
}

/** Executive ChartCard header: navy bar, pink pip, uppercase title, optional caption. */
export function PanelHeader({ title, sub, right, className = '' }: { title: string; sub?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-t-[calc(var(--radius-card)_-_1px)] bg-brand px-5 py-[11px] ${className}`}>
      <span className="h-[15px] w-[3px] shrink-0 rounded-full bg-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold uppercase leading-none tracking-[0.04em] text-white">{title}</p>
        {sub && <p className="mt-1 text-[10px] leading-relaxed text-white/75">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/** Executive card: white, 10px radius, hairline navy-tinted border. With a `title` it gets the navy header. */
export function Panel({ children, className = '', title, sub, headerRight }: { children: React.ReactNode; className?: string; title?: string; sub?: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-[var(--radius-card)] bg-surface ${className}`} style={{ border: '1px solid var(--card-border)' }}>
      {title && <PanelHeader title={title} sub={sub} right={headerRight} />}
      {children}
    </section>
  )
}
