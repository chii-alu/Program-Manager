import React from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export type Stat = { label: string; value: number; display?: string; suffix?: string; prev?: number; hint?: string; primary?: boolean }

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
