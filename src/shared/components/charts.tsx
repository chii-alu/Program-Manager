import React from 'react'

export const chartColors = {
  HENT: 'var(--color-brand-600)',
  HEMP: 'var(--color-brand)',
  HECO: 'var(--color-brand-200)',
  primary: 'var(--color-brand)',
  secondary: 'var(--color-brand-600)',
  grid: 'var(--color-line)',
  axis: 'var(--color-faint)',
}

export const axisProps = {
  tick: { fill: 'var(--color-muted)', fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const

type TipProps = { active?: boolean; payload?: { name: string; value: number; color?: string; fill?: string; stroke?: string }[]; label?: string; suffix?: string }

/** Themed tooltip shared by every chart. */
export function ChartTooltip({ active, payload, label, suffix = '' }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]">
      {label && <div className="mb-1 font-semibold text-ink">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-body">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="flex-1">{p.name}</span>
          <span className="font-semibold tabular-nums text-ink">
            {p.value.toLocaleString()}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
