import React from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { StatTip } from './ui'

export type Stat = { label: string; value: number; display?: string; suffix?: string; prev?: number; hint?: string; primary?: boolean }

export type StatCardItem = {
  label: string
  value: number
  display?: string
  suffix?: string
  prev?: number
  hint?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  tip?: string
}

const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' } as const

/**
 * HEMP header stat cards (CHII-Dashboard components/hemp/header-stats-panel.tsx), without the
 * progress bars and targets: white card, 5px brand left border, centred uppercase label,
 * icon beside a deep-blue figure, small caption.
 */
export function StatCards({ items, columns }: { items: StatCardItem[]; columns?: 2 | 3 | 4 }) {
  const n = columns ?? (Math.min(Math.max(items.length, 2), 4) as 2 | 3 | 4)
  return (
    <dl className={`grid grid-cols-2 gap-3 ${cols[n]}`}>
      {items.map((s) => {
        const Icon = s.icon
        return (
          <div
            key={s.label}
            className="flex min-w-0 flex-col justify-center rounded-[var(--radius-card)] bg-surface px-4 py-3.5 text-center"
            style={{ border: '1px solid var(--stat-border)', borderLeft: '5px solid var(--color-brand)', boxShadow: 'var(--shadow-soft)' }}
          >
            <dt className="mb-2 flex items-center justify-center gap-1">
              <span className="truncate text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--stat-label)]">{s.label}</span>
              {s.tip && <StatTip tip={s.tip} />}
            </dt>
            <dd className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-brand-deep opacity-85" />}
              <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-brand-deep">
                {s.display ?? (
                  <>
                    <CountUp value={s.value} />
                    {s.suffix}
                  </>
                )}
              </span>
              {s.prev != null && <Delta now={s.value} prev={s.prev} />}
            </dd>
            {s.hint && <dd className="mt-1 truncate text-[9.5px] text-[color:var(--stat-hint)]">{s.hint}</dd>}
          </div>
        )
      })}
    </dl>
  )
}

/**
 * Executive KPI tiles: navy fill, light-blue uppercase label, white figure.
 * The primary figure is slightly larger and carries the period delta.
 */
export function StatStrip({ items }: { items: Stat[] }) {
  return (
    <dl className={`grid grid-cols-2 gap-3 ${items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
      {items.map((s, i) => (
        <div
          key={s.label}
          className={`min-w-0 rounded-[var(--radius-card)] bg-brand px-4 py-3.5 text-center sm:col-span-1 ${s.primary || (i === items.length - 1 && (items.length - (items[0]?.primary ? 1 : 0)) % 2 === 1) ? 'col-span-2' : ''}`}
        >
          <dt className="truncate text-[10px] font-extrabold uppercase tracking-[0.06em] text-brand-label">{s.label}</dt>
          <dd className="mt-2 flex flex-wrap items-center justify-center gap-x-2.5">
            <span className={`font-bold leading-none tabular-nums text-white ${s.primary ? 'text-[28px]' : 'text-2xl'}`}>
              {s.display ?? (
                <>
                  <CountUp value={s.value} />
                  {s.suffix}
                </>
              )}
            </span>
            {s.prev != null && <Delta now={s.value} prev={s.prev} />}
          </dd>
          {s.hint && <dd className="mt-1.5 truncate text-[9.5px] tracking-[0.02em] text-brand-label/80">{s.hint}</dd>}
          {s.prev != null && !s.hint && <dd className="mt-1.5 truncate text-[9.5px] tracking-[0.02em] text-brand-label/80">vs previous period</dd>}
        </div>
      ))}
    </dl>
  )
}

export function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return null
  const pct = Math.round(((now - prev) / prev) * 100)
  const up = pct >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${up ? 'text-good' : 'text-bad'}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(pct)}%
    </span>
  )
}

/** Tweens between values when filters change, so the number visibly responds. */
export function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const ref = React.useRef<HTMLSpanElement>(null)
  const last = React.useRef(value)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = value.toLocaleString()
      return
    }
    const c = animate(last.current, value, {
      duration: 0.28,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => (el.textContent = Math.round(v).toLocaleString()),
    })
    last.current = value
    return () => c.stop()
  }, [value, reduce])
  return <span ref={ref}>{value.toLocaleString()}</span>
}
