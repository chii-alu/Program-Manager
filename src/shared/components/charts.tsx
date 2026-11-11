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

/** Executive grid: dashed hairlines, horizontal only unless overridden. */
export const gridProps = { strokeDasharray: '3 3', stroke: 'var(--chart-grid)' } as const

/** Executive category axis (bold 11px body text) and value axis (10px faint). */
export const categoryAxisProps = { tick: { fill: 'var(--color-body)', fontSize: 11, fontWeight: 600 }, axisLine: false, tickLine: false } as const
export const valueAxisProps = { tick: { fill: 'var(--color-faint)', fontSize: 10 }, axisLine: false, tickLine: false } as const

/** A dot filled with its series colour and ringed in the surface colour (recharts' default fill is white). */
function LineDot(props: { cx?: number; cy?: number; stroke?: string; index?: number }): React.ReactElement<SVGElement> {
  const { cx, cy, stroke, index } = props
  if (cx == null || cy == null) return <g key={index} />
  return <circle key={index} cx={cx} cy={cy} r={CHART.dotRadius} fill={stroke} stroke="var(--color-surface)" strokeWidth={2} />
}

/** Executive line: 2.5px, surface-ringed 4px dots, 6px active dot. */
export const lineProps = {
  type: 'monotone',
  strokeWidth: CHART.lineWidth,
  dot: LineDot,
  activeDot: { r: CHART.activeDotRadius, strokeWidth: 0 },
} as const

/** Executive value label on bars: 10px bold body text. */
export const valueLabelProps = { fontSize: 10, fontWeight: 700, fill: 'var(--color-body)' } as const

/** Executive empty state for a chart area. */
export function ChartEmpty({ height = 250, text = 'In coming data' }: { height?: number | string; text?: string }) {
  return (
    <div className="grid place-items-center text-sm text-faint" style={{ height }}>
      {text}
    </div>
  )
}

/**
 * Executive Funnel: steps scaled against the largest, tinted track, bars fading by depth,
 * value and step-conversion on the right.
 */
export function Funnel({ steps, color = 'var(--color-navy)', onSelect, selected }: { steps: { key?: string; label: string; value: number }[]; color?: string; onSelect?: (s: { key?: string; label: string; value: number }) => void; selected?: string | null }) {
  const max = Math.max(...steps.map((s) => s.value), 1)
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const width = Math.max(6, Math.round((s.value / max) * 100))
        const conv = i > 0 && steps[i - 1].value > 0 ? Math.round((s.value / steps[i - 1].value) * 100) : null
        const dim = selected && (s.key ?? s.label) !== selected
        const Row = onSelect ? 'button' : 'div'
        return (
          <li key={s.key ?? s.label}>
            <Row
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(s) } : {})}
              className={`block w-full text-left transition-opacity duration-150 ease-out ${dim ? 'opacity-40' : ''} ${onSelect ? 'cursor-pointer' : ''}`}
            >
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-body">{s.label}</span>
                <span className="font-bold tabular-nums text-brand dark:text-brand-600">
                  {s.value.toLocaleString()}
                  {conv !== null && <span className="font-medium text-faint"> · {conv}%</span>}
                </span>
              </div>
              <div className="h-6 overflow-hidden rounded-sm" style={{ background: 'color-mix(in oklab, ' + color + ' 8%, transparent)' }}>
                <div className="h-full rounded-sm transition-[width] duration-300 ease-out" style={{ width: `${width}%`, background: color, opacity: 1 - i * 0.13 }} />
              </div>
            </Row>
          </li>
        )
      })}
    </ol>
  )
}

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
