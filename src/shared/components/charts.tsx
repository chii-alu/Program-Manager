import React from 'react'

/**
 * Chart chrome, ported from the CHII Executive dashboard (theme/tokens.ts → CHART).
 * Every chart in the app uses the same grid, ticks, radii and tooltip.
 */
export const CHART = {
  barRadius: [4, 4, 0, 0] as [number, number, number, number],
  barRadiusH: [0, 4, 4, 0] as [number, number, number, number],
  lineWidth: 2.5,
  dotRadius: 4,
  activeDotRadius: 6,
  grid: 'var(--chart-grid)',
  cursor: { fill: 'var(--chart-cursor)' },
} as const

/** Executive series: navy, light blue, orange. Status colours are never a series. */
export const chartColors = {
  HENT: 'var(--color-navy)',
  HEMP: 'var(--color-sky)',
  HECO: 'var(--color-orange)',
  primary: 'var(--color-navy)',
  secondary: 'var(--color-sky)',
  tertiary: 'var(--color-orange)',
  /** Executive gender split: female red, male light blue. */
  female: 'var(--color-bad)',
  male: 'var(--color-sky)',
  grid: 'var(--chart-grid)',
  axis: 'var(--color-faint)',
}

export const axisProps = {
  tick: { fill: 'var(--color-muted)', fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const

type TipProps = { active?: boolean; payload?: { name: string; value: number; color?: string; fill?: string; stroke?: string }[]; label?: string; suffix?: string }

/** Executive ChartTip: white card, a square swatch per series, figures in brand navy. */
export function ChartTooltip({ active, payload, label, suffix = '' }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-surface px-[11px] py-2 text-[11px] shadow-[0_2px_8px_rgba(0,0,0,0.08)]" style={{ borderColor: 'var(--chart-tip-border)' }}>
      {label && <div className="mb-1 font-bold text-brand-600">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-[5px] text-muted">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: p.color || p.stroke || p.fill }} />
          <span>{p.name}:</span>
          <b className="tabular-nums text-brand-600">
            {p.value.toLocaleString()}
            {suffix}
          </b>
        </div>
      ))}
    </div>
  )
}

/** Executive ChartLegend: small square swatches, 10px muted labels. */
export function Legend({ items, center = false, onDark = false }: { items: { label: string; color: string }[]; center?: boolean; onDark?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[10px] ${onDark ? 'text-white/85' : 'text-muted'} ${center ? 'justify-center' : ''}`}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-[5px]">
          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] ${onDark ? 'ring-1 ring-white/50' : ''}`} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
