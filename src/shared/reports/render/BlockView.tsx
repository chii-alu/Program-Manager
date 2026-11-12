/**
 * Renders one report block from live data. The same component draws the block in the
 * editing canvas and in the document preview (and later the PDF), so they always agree.
 * Every number comes from getMetric, already permission-checked and suppressed.
 */
import React, { useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, Info, ShieldAlert } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip, axisProps, gridProps, lineProps, valueAxisProps } from '../../components/charts'
import { DonutRing } from '../../components/DonutRing'
import { blockContext, blockTitle, fillPlaceholders } from '../blocks'
import { FEEDBACK_ITEMS } from '../facts'
import { indicatorByCode } from '../indicators'
import { DIMENSIONS, MetricAccessError, MetricPolicyError, formatValue } from '../metrics'
import { NotInSnapshotError, useAsk as useSource } from '../source'
import type { BlockSettings, Dimension, MetricCell, MetricResult, Report, ReportBlock, Viewer } from '../types'

type Ctx = { report: Report; viewer: Viewer }

/* ---------- Data ---------- */

type Ask = (code: string, breakdown?: Dimension, comparison?: boolean) => MetricResult

function useAsk(block: ReportBlock, { report, viewer }: Ctx) {
  const ctx = blockContext(report, block.settings)
  // Live for drafts, recording while finalising, replaying for final versions (source.tsx).
  const source = useSource(viewer)
  const ask: Ask = (code, breakdown, comparison) =>
    source({ code, scope: ctx.scope, period: ctx.period, dateRule: report.dateRule, breakdown, comparison: comparison ? report.comparison : 'none', audience: report.audience })
  return { ask, ctx }
}

/** Run a block's queries; turn permission and privacy refusals into a message, not a crash. */
function safely<T>(fn: () => T): { data: T } | { error: string } {
  try {
    return { data: fn() }
  } catch (e) {
    if (e instanceof MetricAccessError || e instanceof MetricPolicyError || e instanceof NotInSnapshotError) return { error: e.message }
    throw e
  }
}

function sortCells(cells: MetricCell[], s: BlockSettings) {
  const out = [...cells]
  if (s.sort === 'label' || s.breakdown === 'month' || s.breakdown === 'quarter') out.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
  else if (s.sort === 'value_asc') out.sort((a, b) => (a.value ?? -Infinity) - (b.value ?? -Infinity))
  else out.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
  return s.topN ? out.slice(0, s.topN) : out
}

const monthLabel = (k: string) => {
  const [y, m] = k.split('-')
  return m ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${y.slice(2)}` : k
}

/* ---------- Frame: title, body, caption ---------- */

export function BlockView({ block, report, viewer, bare }: { block: ReportBlock; report: Report; viewer: Viewer; bare?: boolean }) {
  const ctx = { report, viewer }
  const { ctx: bc } = useAsk(block, ctx)
  const body =
    block.type === 'kpi' ? <KpiBlock block={block} ctx={ctx} /> : block.type === 'text' ? <TextBlock block={block} ctx={ctx} /> : block.type === 'table' ? <TableBlock block={block} ctx={ctx} /> : <ChartBlock block={block} ctx={ctx} />
  if (bare || block.type === 'kpi' || block.type === 'text') return <>{body}{(block.caption || bc.note) && <Caption block={block} note={bc.note} />}</>
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-[13px] font-semibold text-ink">{blockTitle(block)}</figcaption>
      {body}
      <Caption block={block} note={bc.note} />
    </figure>
  )
}

function Caption({ block, note }: { block: ReportBlock; note: string | null }) {
  if (!block.caption && !note) return null
  return (
    <p className="mt-2 text-[11px] leading-5 text-muted">
      {block.caption}
      {block.caption && note && ' '}
      {note && <span className="font-medium text-brand-600">{note}</span>}
    </p>
  )
}

function Refused({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-bad-bg px-3 py-2.5 text-xs text-bad">
      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </div>
  )
}

function SuppressionNote({ cells, threshold }: { cells: MetricCell[]; threshold: number }) {
  const hidden = cells.filter((c) => c.suppressed).length
  if (!hidden) return null
  return (
    <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-faint">
      <Info className="h-3 w-3" />
      {hidden} {hidden === 1 ? 'value is' : 'values are'} hidden to protect small groups (under {threshold} people).
    </p>
  )
}

/* ---------- KPI tile ---------- */

function KpiBlock({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const { ask } = useAsk(block, ctx)
  const s = block.settings
  const ind = indicatorByCode.get(s.metric ?? '')
  const r = useMemo(() => safely(() => ask(s.metric!, undefined, s.showComparison)), [ctx.report, ctx.viewer, block])
  if ('error' in r) return <Refused message={r.error} />
  const m = r.data
  const cmp = m.comparison
  const up = cmp?.delta != null && cmp.delta >= 0
  const good = cmp?.delta != null && (up === (ind?.higherIsBetter ?? true))
  const target = s.target
  const progress = target && m.value != null ? Math.min(100, Math.round((m.value / target) * 100)) : null
  return (
    <div className="flex h-full flex-col justify-center rounded-[var(--radius-card)] bg-surface px-4 py-3.5 text-center" style={{ border: '1px solid var(--stat-border)', borderLeft: '5px solid var(--color-brand)' }}>
      <p className="mb-2 truncate text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--stat-label)]">{m.label}</p>
      <p className={`font-display text-[26px] font-semibold leading-none tabular-nums ${m.suppressed ? 'text-bad' : 'text-brand-deep'}`}>{m.display}</p>
      {cmp && (
        <p className="mt-1.5 flex items-center justify-center gap-1 text-[10.5px] text-[color:var(--stat-hint)]">
          {cmp.delta != null && (
            <span className={`inline-flex items-center font-semibold ${good ? 'text-good' : 'text-bad'}`}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {/* Rates, NPS and scores change in points; counts change in % */}
              {m.unit === 'rate' || m.unit === 'nps' || m.unit === 'score' || m.unit === 'average'
                ? `${Math.abs(cmp.delta)} pts`
                : cmp.deltaPct != null
                  ? `${Math.abs(cmp.deltaPct)}%`
                  : Math.abs(cmp.delta)}
            </span>
          )}
          vs {cmp.display}
        </p>
      )}
      {target != null && (
        <div className="mt-2">
          <div className="h-1 overflow-hidden rounded-full bg-[color:var(--stat-border)]">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress ?? 0}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-[color:var(--stat-hint)]">
            Target {formatValue(target, { unit: m.unit })}
            {progress != null && ` · ${progress}% of target`}
          </p>
        </div>
      )}
    </div>
  )
}

/* ---------- Text ---------- */

function TextBlock({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const source = useSource(ctx.viewer)
  const html = useMemo(() => fillPlaceholders(block.settings.html ?? '', ctx.report, ctx.viewer, source), [block.settings.html, ctx.report, ctx.viewer, source])
  return <div className="report-prose" dangerouslySetInnerHTML={{ __html: html }} />
}

/* ---------- Charts ---------- */

function ChartBlock({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const s = block.settings
  if (s.chart === 'funnel') return <FunnelChart block={block} ctx={ctx} />
  if (s.chart === 'feedback_items') return <FeedbackItemsChart block={block} ctx={ctx} />
  if (s.chart === 'trend') return <TrendChart block={block} ctx={ctx} />
  if (s.chart === 'donut') return <DonutChart block={block} ctx={ctx} />
  return <BarRanked block={block} ctx={ctx} />
}

function BarRanked({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const { ask } = useAsk(block, ctx)
  const s = block.settings
  const r = useMemo(() => safely(() => ask(s.metric!, s.breakdown ?? 'intervention')), [ctx.report, ctx.viewer, block])
  if ('error' in r) return <Refused message={r.error} />
  const cells = sortCells(r.data.rows ?? [], s)
  if (!cells.length) return <Empty />
  const unit = r.data.unit
  const data = cells.map((c) => ({ name: s.breakdown === 'month' ? monthLabel(c.key) : c.label, value: c.value ?? 0, display: c.display }))
  const domainMax = unit === 'rate' ? 100 : unit === 'score' ? 5 : 'auto'
  return (
    <>
      <div style={{ height: Math.max(140, data.length * 30 + 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(16, 44, 94, 0.12)" horizontal={false} />
            <XAxis type="number" domain={[unit === 'nps' && cells.some((c) => (c.value ?? 0) < 0) ? -100 : 0, domainMax]} tick={{ fontSize: 10, fill: 'var(--color-faint)' }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" width={170} tick={{ fontSize: 10, fill: 'var(--color-body)', fontWeight: 500 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
            <Bar dataKey="value" name={r.data.label} fill="var(--color-sky)" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="display" position="right" fontSize={10} fontWeight={700} fill="var(--color-brand-deep)" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SuppressionNote cells={cells} threshold={r.data.threshold} />
    </>
  )
}

function TrendChart({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const { ask } = useAsk(block, ctx)
  const s = block.settings
  const r = useMemo(() => safely(() => ask(s.metric!, s.breakdown === 'quarter' ? 'quarter' : 'month')), [ctx.report, ctx.viewer, block])
  if ('error' in r) return <Refused message={r.error} />
  const cells = sortCells(r.data.rows ?? [], { ...s, breakdown: s.breakdown === 'quarter' ? 'quarter' : 'month' })
  if (!cells.length) return <Empty />
  const data = cells.map((c) => ({ label: s.breakdown === 'quarter' ? c.key : monthLabel(c.key), value: c.value }))
  return (
    <>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...valueAxisProps} width={40} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-line-strong)', strokeDasharray: '3 3' }} />
            <Line dataKey="value" name={r.data.label} stroke="var(--color-navy)" {...lineProps} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SuppressionNote cells={cells} threshold={r.data.threshold} />
    </>
  )
}

function DonutChart({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const { ask } = useAsk(block, ctx)
  const s = block.settings
  const r = useMemo(() => safely(() => ask(s.metric ?? 'reach.unique_people', s.breakdown ?? 'gender')), [ctx.report, ctx.viewer, block])
  if ('error' in r) return <Refused message={r.error} />
  const cells = r.data.rows ?? []
  const shown = cells.filter((c) => !c.suppressed && (c.value ?? 0) > 0)
  if (!shown.length) return <Empty />
  const palette = ['var(--color-navy)', 'var(--color-sky)', 'var(--color-orange)', 'var(--color-accent)', '#A8C5E6', 'var(--color-brand-600)']
  // Hidden groups still take their share of the ring, as one grey slice, so the visible slices
  // aren't drawn larger than they are. Their combined size is already total − visible, so this
  // reveals nothing new.
  const slices = shown.map((c) => ({ key: c.key, name: c.label, value: c.value ?? 0 }))
  const hidden = (r.data.value ?? 0) - slices.reduce((t, c) => t + c.value, 0)
  if (cells.some((c) => c.suppressed) && hidden > 0 && r.data.unit === 'people') slices.push({ key: '__hidden', name: 'Hidden (small groups)', value: hidden })
  return (
    <>
      <DonutRing data={slices} colors={[...palette.slice(0, shown.length), 'var(--color-line-strong)']} totalLabel={r.data.label} total={r.data.value ?? undefined} height={260} animate={false} />
      <SuppressionNote cells={cells} threshold={r.data.threshold} />
    </>
  )
}

const FUNNEL = [
  { code: 'intake.registrations', label: 'Registered', color: '#A8C5E6' },
  { code: 'participation.attended', label: 'Attended', color: 'var(--color-sky)' },
  { code: 'participation.completed', label: 'Completed', color: 'var(--color-navy)' },
  { code: 'feedback.responded', label: 'Gave feedback', color: 'var(--color-accent)' },
]

function FunnelChart({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const { ask } = useAsk(block, ctx)
  const r = useMemo(() => safely(() => FUNNEL.map((f) => ({ ...f, m: ask(f.code) }))), [ctx.report, ctx.viewer, block])
  if ('error' in r) return <Refused message={r.error} />
  const data = r.data.map((f, i) => {
    const prev = i > 0 ? r.data[i - 1].m.value : null
    return { stage: f.label, value: f.m.value ?? 0, display: f.m.display, step: prev && f.m.value != null ? Math.round((f.m.value / prev) * 100) : null, color: f.color }
  })
  return (
    <>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 30, right: 12, bottom: 0, left: -12 }} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,33,71,0.06)" vertical={false} />
            <XAxis dataKey="stage" tick={{ fontSize: 11, fill: 'var(--color-body)', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-faint)' }} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
            <Bar dataKey="value" name="People" barSize={46} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.stage} fill={d.color} />
              ))}
              <LabelList
                dataKey="display"
                content={(p: object) => {
                  const { x, y, width, index } = p as { x: number; y: number; width: number; index: number }
                  const d = data[index]
                  return (
                    <g>
                      <text x={x + width / 2} y={y - (d.step != null ? 16 : 6)} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="var(--color-brand-deep)">
                        {d.display}
                      </text>
                      {d.step != null && (
                        <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={d.step < 50 ? 'var(--color-bad)' : 'var(--color-faint)'}>
                          {d.step}%
                        </text>
                      )}
                    </g>
                  )
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-[10px] text-muted">
        {FUNNEL.map((f) => (
          <span key={f.code} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: f.color }} />
            {f.label}
          </span>
        ))}
      </div>
    </>
  )
}

function FeedbackItemsChart({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const { ask } = useAsk(block, ctx)
  const r = useMemo(() => safely(() => FEEDBACK_ITEMS.map((it) => ({ name: it.label, m: ask(`feedback.item.${it.key}`) }))), [ctx.report, ctx.viewer, block])
  if ('error' in r) return <Refused message={r.error} />
  if (r.data.every((d) => d.m.value == null && !d.m.suppressed)) return <Empty />
  const data = r.data.map((d) => ({ name: d.name, value: d.m.value ?? 0, display: d.m.display }))
  return (
    <>
      <div style={{ height: data.length * 26 + 30 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,33,71,0.06)" horizontal={false} />
            <XAxis type="number" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: 'var(--color-faint)' }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" width={190} tick={{ fontSize: 10, fill: 'var(--color-body)', fontWeight: 500 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
            <Bar dataKey="value" name="Average (1–5)" fill="var(--color-navy)" radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={false}>
              <LabelList dataKey="display" position="right" fontSize={10} fontWeight={700} fill="var(--color-brand-deep)" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10.5px] text-faint">Average of each core feedback item on a 1–5 scale.</p>
    </>
  )
}

/* ---------- Tables ---------- */

const SUMMARY = [
  { code: 'reach.unique_people', label: 'People' },
  { code: 'attendance.rate', label: 'Attendance' },
  { code: 'completion.rate', label: 'Completion' },
  { code: 'feedback.response_rate', label: 'Feedback rate' },
  { code: 'feedback.nps', label: 'NPS' },
]

function TableBlock({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const s = block.settings
  if (s.table === 'breakdown') return <BreakdownTable block={block} ctx={ctx} />
  return <SummaryTable block={block} ctx={ctx} by={s.table === 'cohort_summary' ? 'cohort' : 'intervention'} />
}

function SummaryTable({ block, ctx, by }: { block: ReportBlock; ctx: Ctx; by: 'intervention' | 'cohort' }) {
  const { ask } = useAsk(block, ctx)
  const r = useMemo(() => safely(() => SUMMARY.map((c) => ask(c.code, by))), [ctx.report, ctx.viewer, block, by])
  if ('error' in r) return <Refused message={r.error} />
  const [reach, ...rest] = r.data
  const rows = (reach.rows ?? []).map((row) => ({ key: row.key, cells: [row, ...rest.map((m) => m.rows?.find((x) => x.key === row.key))] }))
  rows.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
  if (!rows.length) return <Empty />
  return (
    <>
      <Table head={[by === 'cohort' ? 'Cohort' : 'Intervention', ...SUMMARY.map((c) => c.label)]}>
        {rows.map((row) => (
          <tr key={row.key}>
            <Td first>{row.key}</Td>
            {row.cells.map((c, i) => (
              <Td key={i} num suppressed={c?.suppressed}>
                {c ? c.display : '—'}
              </Td>
            ))}
          </tr>
        ))}
      </Table>
      <SuppressionNote cells={r.data.flatMap((m) => m.rows ?? [])} threshold={reach.threshold} />
    </>
  )
}

function BreakdownTable({ block, ctx }: { block: ReportBlock; ctx: Ctx }) {
  const { ask } = useAsk(block, ctx)
  const s = block.settings
  const r = useMemo(() => safely(() => ask(s.metric!, s.breakdown ?? 'age_group')), [ctx.report, ctx.viewer, block])
  if ('error' in r) return <Refused message={r.error} />
  const cells = sortCells(r.data.rows ?? [], s)
  if (!cells.length) return <Empty />
  const additive = cells.some((c) => c.pct != null)
  return (
    <>
      <Table head={[DIMENSIONS[s.breakdown ?? 'age_group'].label, r.data.label, ...(additive ? ['% of total'] : [])]}>
        {cells.map((c) => (
          <tr key={c.key}>
            <Td first>{s.breakdown === 'month' ? monthLabel(c.key) : c.label}</Td>
            <Td num suppressed={c.suppressed}>
              {c.display}
            </Td>
            {additive && <Td num>{c.pct != null ? `${c.pct}%` : '—'}</Td>}
          </tr>
        ))}
        <tr className="font-semibold">
          <Td first total>
            Total
          </Td>
          <Td num total suppressed={r.data.suppressed}>
            {r.data.display}
          </Td>
          {additive && <Td num total>100%</Td>}
        </tr>
      </Table>
      <SuppressionNote cells={cells} threshold={r.data.threshold} />
    </>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`whitespace-nowrap border-b-2 border-brand-200 bg-brand-50 px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.05em] text-brand dark:text-brand-600 ${i ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-canvas/60">{children}</tbody>
      </table>
    </div>
  )
}

function Td({ children, num, first, total, suppressed }: { children: React.ReactNode; num?: boolean; first?: boolean; total?: boolean; suppressed?: boolean }) {
  return (
    <td
      className={`border-b border-line px-3 py-1.5 ${num ? 'text-right tabular-nums' : ''} ${first ? 'font-medium text-ink' : 'text-body'} ${total ? 'border-t-2 border-t-line-strong bg-canvas' : ''} ${suppressed ? 'font-semibold text-bad' : ''}`}
    >
      {children}
    </td>
  )
}

function Empty() {
  return <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">No data for this scope and period.</p>
}
