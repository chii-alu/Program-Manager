import React, { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts'
import { CountUp } from './StatStrip'

/**
 * Executive donut (CHII-Dashboard charts/donut-chart.tsx → DonutRing):
 * draws clockwise from 12 o'clock, centre total counts up, hovering a slice pops it out
 * and dims the others, each slice carries a radial pointer label, and the legend
 * buttons are linked to the ring. `onSelect` adds click-to-filter on top.
 */
export type DonutDatum = { key: string; name: string; value: number }

type ActiveShapeProps = { cx: number; cy: number; innerRadius: number; outerRadius: number; startAngle: number; endAngle: number; fill: string }

/* Active slice: the same wedge nudged outward, with a faint outer ring. */
function ActiveShape(props: unknown) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props as ActiveShapeProps
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 7} startAngle={startAngle} endAngle={endAngle} fill={fill} cornerRadius={2} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 9} outerRadius={outerRadius + 11} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.35} />
    </g>
  )
}

type PointerProps = { cx: number; cy: number; midAngle: number; outerRadius: number; name: string }

/* Pointer label: short radial line out of the slice, a small hook, then the name. */
function Pointer(props: unknown) {
  const { cx, cy, midAngle, outerRadius, name } = props as PointerProps
  const RAD = Math.PI / 180
  const cos = Math.cos(-midAngle * RAD)
  const sin = Math.sin(-midAngle * RAD)
  const right = cos >= 0
  const sx = cx + outerRadius * cos
  const sy = cy + outerRadius * sin
  const lx = cx + (outerRadius + 14) * cos
  const ly = cy + (outerRadius + 14) * sin
  const ex = lx + (right ? 8 : -8)
  return (
    <g style={{ pointerEvents: 'none' }}>
      <polyline points={`${sx},${sy} ${lx},${ly} ${ex},${ly}`} stroke="var(--color-faint)" strokeWidth={1} fill="none" />
      <text x={ex + (right ? 4 : -4)} y={ly} textAnchor={right ? 'start' : 'end'} dominantBaseline="central" fontSize={10.5} fontWeight={600} fill="var(--color-body)">
        {name}
      </text>
    </g>
  )
}

type TipProps = { active?: boolean; payload?: { name: string; value: number; payload?: { fill?: string } }[]; total: number }

/* Share tooltip: swatch + name, then value and % of total. */
function ShareTip({ active, payload, total }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const pct = total ? Math.round((p.value / total) * 100) : 0
  return (
    <div className="rounded-md border bg-surface px-[11px] py-2 text-[11px] shadow-[0_2px_10px_rgba(0,0,0,0.12)]" style={{ borderColor: 'var(--chart-tip-border)' }}>
      <p className="flex items-center gap-1.5 text-muted">
        <span className="inline-block h-[9px] w-[9px] rounded-[2px]" style={{ background: p.payload?.fill }} />
        <b className="text-brand dark:text-brand-600">{p.name}</b>
      </p>
      <p className="mt-0.5 text-muted">
        <b className="text-[13px] text-brand dark:text-brand-600">{p.value.toLocaleString()}</b>
        <span className="ml-1.5 text-faint">{pct}% of total</span>
      </p>
    </div>
  )
}

export function DonutRing({
  data,
  colors,
  total,
  totalLabel,
  height = 220,
  selected,
  onSelect,
  labels = true,
  legend = true,
  animate = true,
}: {
  data: DonutDatum[]
  /** One colour per datum key, or an ordered list. */
  colors: Record<string, string> | string[]
  /** Centre figure; defaults to the sum of values. */
  total?: number
  totalLabel: string
  height?: number
  /** Key of the slice a filter is pinned to: the others dim until it is cleared. */
  selected?: string | null
  onSelect?: (d: DonutDatum) => void
  labels?: boolean
  legend?: boolean
  animate?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const sum = total ?? data.reduce((n, d) => n + d.value, 0)
  const colorFor = (d: DonutDatum, i: number) => (Array.isArray(colors) ? colors[i % colors.length] : colors[d.key])
  const selectedIndex = selected ? data.findIndex((d) => d.key === selected) : -1
  const active = hover ?? (selectedIndex >= 0 ? selectedIndex : null)
  const opacityFor = (i: number) => (active == null ? 1 : i === active ? 1 : 0.4)

  if (!data.length || sum === 0) {
    return (
      <div className="grid place-items-center text-sm text-faint" style={{ height }}>
        In coming data
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="70%"
              paddingAngle={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={animate}
              animationBegin={0}
              animationDuration={1000}
              animationEasing="ease-out"
              activeIndex={active ?? undefined}
              activeShape={ActiveShape}
              label={labels ? Pointer : undefined}
              labelLine={false}
              onMouseEnter={(_: unknown, i: number) => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={(d: DonutDatum) => onSelect?.(d)}
              className={`donut-pie ${onSelect ? 'cursor-pointer' : ''}`}
            >
              {data.map((d, i) => (
                <Cell key={d.key} fill={colorFor(d, i)} fillOpacity={opacityFor(i)} />
              ))}
            </Pie>
            <Tooltip content={<ShareTip total={sum} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre total */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
          <p className="text-[22px] font-extrabold leading-none text-brand dark:text-brand-600">
            <CountUp value={sum} />
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.05em] text-faint">{totalLabel}</p>
        </div>
      </div>

      {legend && (
        <div className="mt-2.5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {data.map((d, i) => (
            <button
              key={d.key}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(d)}
              className={`inline-flex items-center gap-1.5 transition-opacity duration-150 ease-out ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
              style={{ opacity: opacityFor(i) === 1 ? 1 : 0.45 }}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colorFor(d, i) }} />
              <span className="text-[11px] font-semibold text-body">{d.name}</span>
              <span className="text-[11px] tabular-nums text-muted">{d.value.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
      <style>{`.donut-pie .recharts-sector { transition: fill-opacity 180ms ease; }`}</style>
    </div>
  )
}
