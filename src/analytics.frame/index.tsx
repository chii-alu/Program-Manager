import React, { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AreaChart as AreaIcon, BarChart3, Download, Info, Layers, LineChart as LineIcon, X } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel, PillarTag, PanelHeader } from '../shared/components/ui'
import { ChartTooltip, Funnel, axisProps, categoryAxisProps, chartColors, gridProps, lineProps, valueAxisProps, valueLabelProps } from '../shared/components/charts'
import { DonutRing } from '../shared/components/DonutRing'
import { Column, DataTable } from '../shared/components/DataTable'
import { CountUp, Delta } from '../shared/components/StatStrip'
import { ExportModal } from '../shared/components/ExportModal'
import { EmptyState } from '../shared/components/EmptyState'
import { Pillar, Portal, Role, feedbackRows, participants, pillarsFor, portalMeta } from '../shared/data/mela'
import { inRange, previous, seriesFor, totals, useTimeRange } from '../shared/lib/time'

export const args = {
  role: 'admin',
  portal: 'admin',
  chart: 'area',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

type Metric = 'reach' | 'pipeline'
type Cross = { intervention?: string; gender?: 'F' | 'M'; age?: string }
const DUR = 280

export default function Analytics(props: Props) {
  const { role: r, portal: p, chart: initialChart, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const reduce = useReducedMotion()
  const scope = pillarsFor(portal)
  const { range, label } = useTimeRange()
  const [chart, setChart] = useState(initialChart)
  const [metric, setMetric] = useState<Metric>('reach')
  const [off, setOff] = useState<Pillar[]>([])
  const [cross, setCross] = useState<Cross>({})
  const [hover, setHover] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const pillars = scope.filter((pl) => !off.includes(pl))
  const togglePillar = (pl: Pillar) => setOff((o) => (o.includes(pl) ? o.filter((x) => x !== pl) : pillars.length > 1 ? [...o, pl] : o))

  /* Activity series for the hero chart */
  const series = useMemo(() => seriesFor(range), [range])
  const share = (pls: Pillar[]) => {
    const t = totals(range)
    const all = t.HENT + t.HEMP + t.HECO || 1
    return pls.reduce((n, pl) => n + t[pl], 0) / all
  }
  const s = share(pillars)
  const shaped = series.map((d) => ({ ...d, registered: Math.round(d.registered * s), attended: Math.round(d.attended * s), completed: Math.round(d.completed * s) }))
  const now = totals(range)
  const before = totals(previous(range))
  const heroNow = metric === 'reach' ? pillars.reduce((n, pl) => n + now[pl], 0) : Math.round(now.registered * s)
  const heroPrev = metric === 'reach' ? pillars.reduce((n, pl) => n + before[pl], 0) : Math.round(before.registered * share(pillars))
  const funnel = [
    { stage: 'Registered', value: Math.round(now.registered * s) },
    { stage: 'Attended', value: Math.round(now.attended * s) },
    { stage: 'Completed', value: Math.round(now.completed * s) },
    { stage: 'Gave feedback', value: Math.round(now.feedback * s) },
  ]

  /* People and feedback in range, cross-filtered by the charts */
  const basePeople = useMemo(() => participants.filter((x) => x.pillars.some((pl) => pillars.includes(pl)) && inRange(range, x.lastActive)), [range, pillars.join()])
  const baseFeedback = useMemo(() => feedbackRows.filter((f) => pillars.includes(f.pillar) && inRange(range, f.date)), [range, pillars.join()])
  const people = basePeople.filter((x) => (!cross.intervention || x.interventions.includes(cross.intervention)) && (!cross.gender || x.gender === cross.gender) && (!cross.age || ageBucket(x.age) === cross.age))
  const feedback = baseFeedback.filter((f) => !cross.intervention || f.intervention === cross.intervention)

  const ints = useMemo(() => interventionStats(basePeople.filter((x) => (!cross.gender || x.gender === cross.gender) && (!cross.age || ageBucket(x.age) === cross.age)), baseFeedback, pillars), [basePeople, baseFeedback, cross.gender, cross.age])
  const npsData = ints.filter((i) => i.responses > 0).sort((a, b) => b.nps - a.nps)
  const genderData = (['F', 'M'] as const).map((g) => ({ key: g, name: g === 'F' ? 'Female' : 'Male', value: people.filter((x) => x.gender === g).length }))
  const ageData = ['19–21', '22–24', '25–27', '28+'].map((b) => ({ bucket: b, people: basePeople.filter((x) => ageBucket(x.age) === b && (!cross.intervention || x.interventions.includes(cross.intervention)) && (!cross.gender || x.gender === cross.gender)).length }))
  const rate = series.map((d) => ({ label: d.label, rate: d.registered ? Math.round((d.attended / d.registered) * 100) : 0 }))
  const countries = countryStats(people)
  const activeCross = (Object.entries(cross) as [keyof Cross, string][]).filter(([, v]) => v)

  const intCols: Column<ReturnType<typeof interventionStats>[number]>[] = [
    { key: 'name', label: 'Intervention', render: (i) => <span className="font-medium">{i.name}</span> },
    { key: 'pillar', label: 'Pillar', render: (i) => <PillarTag pillar={i.pillar} /> },
    { key: 'people', label: 'People', numeric: true },
    { key: 'attendance', label: 'Avg. attendance', numeric: true, render: (i) => <Meter v={i.attendance} /> },
    { key: 'completion', label: 'Completion', numeric: true, value: (i) => i.completion, render: (i) => `${i.completion}%` },
    { key: 'responses', label: 'Responses', numeric: true, hideBelow: 'lg' },
    { key: 'satisfaction', label: 'Sat.', numeric: true, hideBelow: 'xl', render: (i) => (i.responses ? i.satisfaction.toFixed(1) : '—') },
    { key: 'nps', label: 'NPS', numeric: true, render: (i) => (i.responses ? <NpsValue v={i.nps} /> : <span className="text-faint">—</span>) },
  ]
  const countryCols: Column<ReturnType<typeof countryStats>[number]>[] = [
    { key: 'country', label: 'Country', render: (c) => <span className="font-medium">{c.country}</span> },
    { key: 'people', label: 'People', numeric: true },
    { key: 'female', label: 'Female', numeric: true, render: (c) => `${c.female}%` },
    { key: 'attendance', label: 'Avg. attendance', numeric: true, render: (c) => `${c.attendance}%` },
    { key: 'cross', label: 'Cross-pillar', numeric: true, hideBelow: 'lg' },
  ]

  const anim = { isAnimationActive: !reduce, animationDuration: DUR, animationEasing: 'ease-out' as const }
  const keys = metric === 'reach' ? pillars.map((pl) => ({ key: pl, color: chartColors[pl] })) : [
    { key: 'registered', color: 'var(--color-sky)' },
    { key: 'attended', color: 'var(--color-navy)' },
    { key: 'completed', color: 'var(--color-orange)' },
  ]

  return (
    <AppShell role={role} portal={portal} active="analytics" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <ExportModal
        open={exporting}
        onClose={() => setExporting(false)}
        title={`Analytics · ${portalMeta[portal].label} · ${label}`}
        columns={[{ key: 'label', label: 'Period' }, ...scope.map((pl) => ({ key: pl, label: `${pl} reach` })), { key: 'registered', label: 'Registered' }, { key: 'attended', label: 'Attended' }, { key: 'completed', label: 'Completed' }, { key: 'feedback', label: 'Feedback' }]}
        rows={series}
        canSeeRestricted={false}
        filters={`${label} · ${pillars.join(', ')}`}
      />
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
        <PageHeader
          crumbs={[portalMeta[portal].label, 'Analytics']}
          title="Platform analytics"
          description={<>{portal === 'admin' ? 'Reach, completion and satisfaction across CHII' : `How ${portalMeta[portal].label} is reaching young people`} · <span className="font-medium text-ink">{label}</span></>}
          actions={
            <Button className="w-full sm:w-auto" onClick={() => setExporting(true)}>
              <Download className="h-4 w-4" /> Export report
            </Button>
          }
        />

        {/* Hero: reach over time, with its own chart controls */}
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm text-muted">
                {metric === 'reach' ? 'People reached' : 'Registrations'}
                <span title={metric === 'reach' ? 'Participations per day, across the pillars shown' : 'Form registrations in the period'}>
                  <Info className="h-3.5 w-3.5 text-faint" />
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                  <CountUp value={heroNow} />
                </span>
                <Delta now={heroNow} prev={heroPrev} />
                <span className="text-xs text-muted">vs previous period</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                value={metric}
                onChange={(v) => setMetric(v as Metric)}
                items={[
                  { id: 'reach', label: 'Reach' },
                  { id: 'pipeline', label: 'Pipeline' },
                ]}
              />
              <Segmented
                value={chart}
                onChange={setChart}
                items={[
                  { id: 'area', label: 'Area', icon: AreaIcon },
                  { id: 'bar', label: 'Bar', icon: BarChart3 },
                  { id: 'line', label: 'Line', icon: LineIcon },
                ]}
                iconOnly
              />
            </div>
          </div>

          {scope.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Layers className="mr-1 h-3.5 w-3.5 text-faint" />
              {scope.map((pl) => {
                const on = pillars.includes(pl)
                return (
                  <button
                    key={pl}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePillar(pl)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors duration-150 ease-out ${on ? 'border-line-strong bg-surface text-ink' : 'border-dashed border-line text-faint'}`}
                  >
                    <span className="h-2 w-2 rounded-sm" style={{ background: on ? chartColors[pl] : 'var(--color-line-strong)' }} />
                    {pl}
                  </button>
                )
              })}
              <span className="ml-1 text-[11px] text-faint">Click to show or hide a pillar</span>
            </div>
          )}

          <div className="-ml-3 mt-4 h-60 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chart === 'bar' ? (
                <BarChart data={shaped} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                  <YAxis {...valueAxisProps} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
                  {keys.map((k) => (
                    <Bar key={k.key} dataKey={k.key} name={cap(k.key)} stackId={metric === 'reach' ? '1' : undefined} fill={k.color} radius={metric === 'reach' ? 0 : [3, 3, 0, 0]} {...anim} />
                  ))}
                </BarChart>
              ) : chart === 'line' ? (
                <LineChart data={shaped} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                  <YAxis {...valueAxisProps} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-line-strong)', strokeDasharray: '3 3' }} />
                  {keys.map((k) => (
                    <Line key={k.key} dataKey={k.key} name={cap(k.key)} stroke={k.color} {...lineProps} {...anim} />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={shaped} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                  <YAxis {...valueAxisProps} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-line-strong)', strokeDasharray: '3 3' }} />
                  {keys.map((k) => (
                    <Area key={k.key} dataKey={k.key} name={cap(k.key)} type="monotone" stackId={metric === 'reach' ? '1' : undefined} stroke={k.color} fill={k.color} fillOpacity={metric === 'reach' ? 0.85 : 0.18} strokeWidth={metric === 'reach' ? 0 : 2} {...anim} />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Cross-filter chips */}
        {activeCross.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Filtered by chart:</span>
            {activeCross.map(([k, v]) => (
              <button key={k} type="button" onClick={() => setCross((c) => ({ ...c, [k]: undefined }))} className="inline-flex h-7 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 pl-2.5 pr-1.5 text-xs font-medium text-brand-600">
                {k === 'gender' ? (v === 'F' ? 'Female' : 'Male') : k === 'age' ? `Age ${v}` : v}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button type="button" onClick={() => setCross({})} className="text-xs font-semibold text-brand-600 hover:underline">
              Clear all
            </button>
          </motion.div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* NPS by intervention: click to cross-filter, linked to the table below */}
          <Panel className="p-4 sm:p-5">
            <ChartHead title="NPS by intervention" sub="Click a bar to filter the page" />
            {npsData.length === 0 ? (
              <EmptyState compact title="No feedback in this period" body="NPS appears once attendees submit feedback." />
            ) : (
              <div className="-ml-2 mt-3" style={{ height: Math.max(180, npsData.length * 30) }}>
                <ResponsiveContainer width="100%" height="100%">
                  {/* Executive ranked bars: label column, hidden value axis, figure at the end of each bar */}
                  <BarChart data={npsData} layout="vertical" margin={{ top: 0, right: 44, left: 4, bottom: 0 }} barCategoryGap={10}>
                    <XAxis type="number" domain={[-100, 100]} hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-body)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} width={120} />
                    <ReferenceLine x={0} stroke="var(--color-line-strong)" />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
                    <Bar
                      dataKey="nps"
                      name="NPS"
                      radius={[0, 4, 4, 0]}
                      barSize={18}
                      className="cursor-pointer"
                      onClick={(d: { name?: string }) => setCross((c) => ({ ...c, intervention: c.intervention === d.name ? undefined : d.name }))}
                      onMouseEnter={(d: { name?: string }) => setHover(d.name ?? null)}
                      onMouseLeave={() => setHover(null)}
                      {...anim}
                    >
                      {npsData.map((d) => {
                        const dim = (cross.intervention && cross.intervention !== d.name) || (hover && hover !== d.name)
                        return <Cell key={d.name} fill={d.nps >= 30 ? 'var(--color-navy)' : d.nps >= 0 ? 'var(--color-brand-200)' : 'var(--color-bad)'} fillOpacity={dim ? 0.4 : 1} />
                      })}
                      <LabelList dataKey="nps" position="right" {...valueLabelProps} fill="var(--color-brand-600)" formatter={(v: number) => (v > 0 ? `+${v}` : String(v))} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            {/* Funnel */}
            <Panel className="p-4 sm:p-5">
              <ChartHead title="Registration to feedback" sub="Where people drop out" />
              <div className="mt-4">
                <Funnel steps={funnel.map((f) => ({ label: f.stage, value: f.value }))} />
              </div>
            </Panel>

            {/* Gender: click a slice to filter */}
            <Panel className="p-4 sm:p-5">
              <ChartHead title="Gender" sub={`${people.length} people · click to filter`} />
              <div className="mt-3">
                <DonutRing
                  data={genderData}
                  colors={{ F: chartColors.female, M: chartColors.male }}
                  totalLabel="people"
                  selected={cross.gender ?? null}
                  onSelect={(d) => setCross((c) => ({ ...c, gender: c.gender === d.key ? undefined : (d.key as 'F' | 'M') }))}
                  animate={!reduce}
                />
              </div>
            </Panel>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Panel className="p-4 sm:p-5">
            <ChartHead title="Attendance rate" sub="Attended ÷ registered" />
            <div className="-ml-3 mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rate} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={18} />
                  <YAxis {...valueAxisProps} width={40} domain={[50, 100]} unit="%" />
                  <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ stroke: 'var(--color-line-strong)', strokeDasharray: '3 3' }} />
                  <Line dataKey="rate" name="Attendance" stroke="var(--color-navy)" {...lineProps} {...anim} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel className="p-4 sm:p-5">
            <ChartHead title="Age" sub="Click a bar to filter" />
            <div className="-ml-3 mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...gridProps} />
                  <XAxis dataKey="bucket" {...categoryAxisProps} />
                  <YAxis {...valueAxisProps} width={40} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
                  <Bar dataKey="people" name="People" radius={[4, 4, 0, 0]} barSize={30} className="cursor-pointer" onClick={(d: { bucket?: string }) => setCross((c) => ({ ...c, age: c.age === d.bucket ? undefined : d.bucket }))} {...anim}>
                    {ageData.map((a) => (
                      <Cell key={a.bucket} fill="var(--color-navy)" fillOpacity={cross.age && cross.age !== a.bucket ? 0.4 : 1} />
                    ))}
                    <LabelList dataKey="people" position="top" {...valueLabelProps} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* Analytical tables */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Intervention performance</h2>
            <p className="text-sm text-muted">Hover a row to find it in the NPS chart. Click a row to filter the page by it.</p>
          </div>
          <DataTable
            title={`Intervention performance · ${label}`}
            rows={ints}
            columns={intCols}
            rowKey={(i) => i.name}
            compact
            initialPageSize={10}
            highlight={cross.intervention ?? hover}
            onRowHover={(i) => setHover(i?.name ?? null)}
            onRowClick={(i) => setCross((c) => ({ ...c, intervention: c.intervention === i.name ? undefined : i.name }))}
            rowActions={[
              { label: 'Filter page by this', icon: Layers, onClick: (i) => setCross((c) => ({ ...c, intervention: i.name })) },
              { label: 'Open interventions', icon: BarChart3, onClick: () => onNavigate?.('interventions') },
            ]}
            searchPlaceholder="Search interventions"
            empty={{ title: 'No intervention activity in this period' }}
            mobileRow={(i) => (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{i.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {i.pillar} · {i.people} people · {i.completion}% complete
                  </div>
                </div>
                {i.responses > 0 && <NpsValue v={i.nps} />}
              </div>
            )}
          />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Reach by country</h2>
            <p className="text-sm text-muted">{countries.length} countries among the people shown.</p>
          </div>
          <DataTable
            title={`Reach by country · ${label}`}
            rows={countries}
            columns={countryCols}
            rowKey={(c) => c.country}
            compact
            initialPageSize={10}
            initialSort={{ key: 'people', dir: -1 }}
            searchPlaceholder="Search countries"
            empty={{ title: 'No one reached in this period' }}
            mobileRow={(c) => (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium">{c.country}</span>
                <span className="shrink-0 text-xs text-muted">
                  <span className="font-semibold text-ink">{c.people}</span> · {c.female}% F · {c.attendance}% att.
                </span>
              </div>
            )}
          />
        </section>
      </div>
    </AppShell>
  )
}

/** Executive card header, bled to the edges of the padded panel it sits in. */
function ChartHead({ title, sub }: { title: string; sub: string }) {
  return <PanelHeader title={title} sub={sub} className="-mx-4 -mt-4 sm:-mx-5 sm:-mt-5" />
}

function Segmented({ value, onChange, items, iconOnly }: { value: string; onChange: (v: string) => void; items: { id: string; label: string; icon?: React.ComponentType<{ className?: string }> }[]; iconOnly?: boolean }) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-canvas p-0.5">
      {items.map((x) => (
        <button
          key={x.id}
          type="button"
          title={x.label}
          aria-label={x.label}
          aria-pressed={value === x.id}
          onClick={() => onChange(x.id)}
          className={`relative inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-colors duration-150 ease-out ${iconOnly ? 'w-8' : 'px-3'} ${value === x.id ? 'text-brand-600' : 'text-muted hover:text-ink'}`}
        >
          {value === x.id && <motion.span layoutId={`seg-${items[0].id}`} className="absolute inset-0 rounded-md bg-surface shadow-[0_0_0_1px_var(--color-line)]" transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} />}
          {x.icon && <x.icon className="relative h-4 w-4" />}
          {!iconOnly && <span className="relative">{x.label}</span>}
        </button>
      ))}
    </div>
  )
}

function Meter({ v }: { v: number }) {
  return (
    <div className="ml-auto flex w-24 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
        <div className={`h-full rounded-full ${v >= 75 ? 'bg-good' : v >= 50 ? 'bg-warn' : 'bg-bad'}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-8 text-right text-xs tabular-nums">{v}%</span>
    </div>
  )
}

function NpsValue({ v }: { v: number }) {
  return <span className={`font-semibold tabular-nums ${v >= 30 ? 'text-good' : v >= 0 ? 'text-body' : 'text-bad'}`}>{v > 0 ? `+${v}` : v}</span>
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const ageBucket = (a: number) => (a <= 21 ? '19–21' : a <= 24 ? '22–24' : a <= 27 ? '25–27' : '28+')

const pillarOf: Record<string, Pillar> = {
  Masterclass: 'HENT', Hackathon: 'HENT', Mentorship: 'HENT', 'Venture Funding': 'HENT',
  SIE: 'HEMP', 'Career Exposure': 'HEMP', Internships: 'HEMP', 'Career Workshops': 'HEMP',
  'Public Sector Fellowship': 'HECO', 'Health Expert in Residence': 'HECO', 'Executive Courses': 'HECO',
}

function interventionStats(people: typeof participants, feedback: typeof feedbackRows, pillars: Pillar[]) {
  return Object.keys(pillarOf)
    .filter((name) => pillars.includes(pillarOf[name]))
    .map((name) => {
      const ps = people.filter((x) => x.interventions.includes(name))
      const fs = feedback.filter((f) => f.intervention === name)
      const promoters = fs.filter((f) => f.nps >= 9).length
      const detractors = fs.filter((f) => f.nps <= 6).length
      return {
        name,
        pillar: pillarOf[name],
        people: ps.length,
        attendance: ps.length ? Math.round(ps.reduce((n, x) => n + x.attendance, 0) / ps.length) : 0,
        completion: ps.length ? Math.round((ps.filter((x) => x.attendance >= 75).length / ps.length) * 100) : 0,
        responses: fs.length,
        satisfaction: fs.length ? fs.reduce((n, f) => n + f.satisfaction, 0) / fs.length : 0,
        nps: fs.length ? Math.round(((promoters - detractors) / fs.length) * 100) : 0,
      }
    })
    .filter((i) => i.people > 0 || i.responses > 0)
    .sort((a, b) => b.people - a.people)
}

function countryStats(people: typeof participants) {
  const by = new Map<string, typeof participants>()
  people.forEach((x) => by.set(x.country, [...(by.get(x.country) ?? []), x]))
  return Array.from(by.entries()).map(([country, ps]) => ({
    country,
    people: ps.length,
    female: Math.round((ps.filter((x) => x.gender === 'F').length / ps.length) * 100),
    attendance: Math.round(ps.reduce((n, x) => n + x.attendance, 0) / ps.length),
    cross: ps.filter((x) => x.pillars.length > 1).length,
  }))
}
