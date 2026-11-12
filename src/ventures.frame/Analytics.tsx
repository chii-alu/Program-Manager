/**
 * Venture Analytics (VENTURE-REGISTRY-SPEC §4, build step 5): every Ventures Portfolio metric from
 * the CHII dashboard, computed live from the registry with the same definitions, plus the extra
 * metrics in the spec. Filters, comparison with the previous period, targets, drill-down to the
 * ventures behind any bar (staff only), and an export that hides counts under 5.
 */
import React, { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend as RLegend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BookOpen, Briefcase, Banknote, Coins, HandCoins, Wallet, Download, Filter, Target, TrendingUp, Users, X } from 'lucide-react'
import { CHART, ChartTooltip, categoryAxisProps, gridProps, lineProps, valueAxisProps } from '../shared/components/charts'
import { Modal } from '../shared/components/Modal'
import { Popover } from '../shared/components/Popover'
import { StatCards } from '../shared/components/StatStrip'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { countryName } from '../shared/ventures/lists'
import { DefinitionsModal, type Definition } from '../shared/components/DefinitionsModal'
import { FILTER_FIELDS, PERIODS, PERIOD_YEARS, VENTURE_INDICATORS, periodStarted, yearPeriod, VENTURE_TARGETS, analyse, previousPeriod, suppressCount, type Slice, type VFilters } from '../shared/ventures/metrics'
import type { RegistryData } from '../shared/ventures/types'
import { Chip, StagePill, VentureStatusPill, money } from './parts'

const NAVY = 'var(--color-navy)'
const SKY = 'var(--color-sky)'
const ORANGE = 'var(--color-orange)'
const TABS = ['Portfolio Composition', 'Portfolio Health', 'Jobs & funding', 'Founders & inclusion'] as const
type Tab = (typeof TABS)[number]

export function VentureAnalytics({ data, onOpen }: { data: RegistryData; onOpen: (id: string) => void }) {
  const [periodKey, setPeriodKey] = useState('to_date')
  const [filters, setFilters] = useState<VFilters>({})
  const [tab, setTab] = useState<Tab>('Portfolio Composition')
  const [drill, setDrill] = useState<{ title: string; ids: string[] } | null>(null)
  const [defs, setDefs] = useState(false)
  const [jobsBy, setJobsBy] = useState<'intake' | 'date'>('intake')
  const [revenueBy, setRevenueBy] = useState<'intake' | 'date'>('intake')

  const period = PERIODS.find((p) => p.key === periodKey)!
  const selYear = periodKey === 'to_date' ? null : Number(periodKey.slice(-4))
  const a = useMemo(() => analyse(data, period, filters), [data, period, filters])
  const prev = useMemo(() => analyse(data, previousPeriod(period), filters), [data, period, filters])
  const v = a.values
  const pick = (title: string) => (s: { ids?: string[] }) => s.ids?.length && setDrill({ title, ids: s.ids })

  // Filter options from the whole registry (so a filter never offers a value with nothing behind it).
  const all = useMemo(() => analyse(data, PERIODS[0]).rows, [data])
  const options = (key: keyof VFilters) => {
    const f = FILTER_FIELDS.find((x) => x.key === key)!
    const used = [...new Set(all.map(f.value).filter((x) => x != null && x !== ''))].sort() as (string | number | boolean)[]
    // Intake year offers the reporting years 2025–2030, plus any earlier year that has ventures.
    if (key === 'intakeYear') return [...new Set([...(used as number[]).filter((y) => y < PERIOD_YEARS[0]), ...PERIOD_YEARS])].sort((a, b) => a - b)
    return used
  }
  const hasVentures = (key: keyof VFilters, o: unknown) => key !== 'intakeYear' || all.some((r) => r.intakeYear === o)
  const active = Object.entries(filters).filter(([, x]) => x != null && (!Array.isArray(x) || x.length)) as [keyof VFilters, unknown][]
  const toggle = (key: keyof VFilters, val: string | number | boolean) =>
    setFilters((f) => {
      if (typeof val === 'boolean') return { ...f, [key]: f[key] === val ? undefined : val }
      const cur = (f[key] as (string | number)[] | undefined) ?? []
      return { ...f, [key]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] }
    })
  const label = (key: keyof VFilters, val: unknown) => (key === 'country' ? countryName(String(val)) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val))

  const target = (code: string, value: number | null) => {
    const t = VENTURE_TARGETS[code]
    return t && value != null ? `${Math.round((value / t) * 100)}% of ${code === 'venture.funding_deployed' ? money(t) : t.toLocaleString()} target` : undefined
  }

  return (
    <>
      <PageHeader
        crumbs={['HENT', 'Ventures', 'Analytics']}
        title="Venture Analytics"
        description={`Live from the Venture Registry, with the same definitions as the CHII dashboard’s Ventures Portfolio. As of ${new Date(a.asOf).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`}
        actions={
          <>
            <Button onClick={() => setDefs(true)}>
              <BookOpen className="h-4 w-4" /> Definitions
            </Button>
            <Button onClick={() => exportCsv(a, period.label)}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface px-3 py-2.5 shadow-[var(--shadow-soft)]">
        <span className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Period</span>
        <Chip on={periodKey === 'to_date'} onClick={() => setPeriodKey('to_date')}>
          To date
        </Chip>
        {PERIOD_YEARS.map((y) => {
          const started = periodStarted(yearPeriod(y))
          return (
            <Chip key={y} on={selYear === y} onClick={() => setPeriodKey(`y${y}`)} disabled={!started} title={started ? undefined : `No data yet: ${y} starts on 1 Jan ${y}`}>
              {y}
            </Chip>
          )
        })}
        {selYear != null && (
          // Full year or one half of the chosen year. A half that hasn't started is greyed out.
          <span className="inline-flex rounded-lg bg-canvas p-0.5" role="group" aria-label={`Part of ${selYear}`}>
            {([
              [`y${selYear}`, 'Full year'],
              [`h1-${selYear}`, 'H1'],
              [`h2-${selYear}`, 'H2'],
            ] as const).map(([k, l]) => {
              const p = PERIODS.find((x) => x.key === k)!
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={periodKey === k}
                  disabled={!periodStarted(p)}
                  title={periodStarted(p) ? p.label : `No data yet: starts ${p.start}`}
                  onClick={() => setPeriodKey(k)}
                  className={`h-7 rounded-md px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${periodKey === k ? 'bg-surface text-brand-600 shadow-sm' : 'text-muted hover:text-ink'}`}
                >
                  {l}
                </button>
              )
            })}
          </span>
        )}
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <Popover
          width="w-[min(92vw,560px)]"
          trigger={({ toggle: t }) => (
            <Button onClick={t}>
              <Filter className="h-4 w-4" /> Filters{active.length ? ` · ${active.length}` : ''}
            </Button>
          )}
        >
          {() => (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
              {FILTER_FIELDS.map((f) => (
                <div key={f.key}>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{f.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {options(f.key).map((o) => {
                      const cur = filters[f.key]
                      const on = Array.isArray(cur) ? (cur as unknown[]).includes(o) : cur === o
                      return (
                        <Chip key={String(o)} on={on} onClick={() => toggle(f.key, o)} disabled={!on && !hasVentures(f.key, o)} title={hasVentures(f.key, o) ? undefined : `No ventures with intake in ${String(o)} yet`}>
                          {label(f.key, o)}
                        </Chip>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Popover>
        {active.flatMap(([k, val]) =>
          (Array.isArray(val) ? val : [val]).map((x) => (
            <button key={`${k}-${String(x)}`} type="button" onClick={() => toggle(k, x as string)} className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-50 px-2.5 text-xs font-semibold text-brand-600">
              {FILTER_FIELDS.find((f) => f.key === k)!.label}: {label(k, x)} <X className="h-3 w-3" />
            </button>
          )),
        )}
        {active.length > 0 && (
          <button type="button" onClick={() => setFilters({})} className="text-xs font-semibold text-muted hover:text-ink">
            Reset
          </button>
        )}
        <span className="ml-auto text-xs text-muted">
          {v['venture.supported']} ventures · compared with {previousPeriod(period).key === 'to_date_prev' ? '12 months earlier' : previousPeriod(period).label}
        </span>
      </div>

      {/* Headline numbers: the dashboard's "Portfolio Overview" cards */}
      <StatCards
        columns={3}
        items={[
          { label: 'Ventures supported', value: v['venture.supported']!, prev: prev.values['venture.supported']!, icon: Briefcase, hint: `${v['venture.active']} active${VENTURE_TARGETS['venture.active'] ? ` · ${Math.round((v['venture.active']! / VENTURE_TARGETS['venture.active']) * 100)}% of the ${VENTURE_TARGETS['venture.active']} active-venture target` : ''}`, tip: indicator('venture.supported') },
          { label: 'Women-led ventures', value: v['venture.women_led']!, prev: prev.values['venture.women_led']!, icon: Users, hint: share(v['venture.women_led'], v['venture.supported']), tip: indicator('venture.women_led') },
          { label: 'PWD-led ventures', value: v['venture.pwd_led']!, prev: prev.values['venture.pwd_led']!, icon: Target, hint: share(v['venture.pwd_led'], v['venture.supported']), tip: indicator('venture.pwd_led') },
          { label: 'Jobs created', value: v['venture.jobs']!, prev: prev.values['venture.jobs']!, icon: TrendingUp, hint: target('venture.jobs', v['venture.jobs']) ?? `${v['venture.jobs_per_venture']} per venture`, tip: indicator('venture.jobs') },
          { label: 'Funding deployed', value: v['venture.funding_deployed']!, display: money(v['venture.funding_deployed']), prev: prev.values['venture.funding_deployed']!, icon: Banknote, hint: target('venture.funding_deployed', v['venture.funding_deployed']), tip: indicator('venture.funding_deployed') },
          { label: 'Revenue generated', value: v['venture.revenue']!, display: money(v['venture.revenue']), prev: prev.values['venture.revenue']!, icon: Wallet, hint: 'last 12 months, as reported', tip: indicator('venture.revenue') },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${tab === t ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-body hover:bg-canvas'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Portfolio Composition' && (
        <Grid>
          <ChartPanel title="Ventures by country" sub="All ventures, by primary country of operation" info="Counts all ventures, whatever their status (MELA). Top 8 countries.">
            <Bars data={a.breakdowns.country.slice(0, 8)} onPick={pick('Ventures by country')} />
          </ChartPanel>
          <ChartPanel title="Ventures by stage" sub="How the portfolio splits across Expose, Build and Scale" info="Latest stage of each venture.">
            <Bars data={a.breakdowns.stage} onPick={pick('Ventures by stage')} />
          </ChartPanel>
          <ChartPanel title="Female-led and accelerated ventures" sub="Female-led, in an accelerator, and both active and female-led" info={indicator('venture.women_led')}>
            <Bars data={a.breakdowns.femaleAccelerated} color={ORANGE} onPick={pick('Female-led and accelerated')} />
          </ChartPanel>
          <ChartPanel
            title="Jobs created over time"
            sub={jobsBy === 'intake' ? 'Jobs of the ventures in each intake year (as on the dashboard)' : 'The portfolio’s jobs at each half-year, from update dates'}
            info="MELA asked for both: by intake year (the dashboard’s view) and over time by update date."
            right={<Toggle value={jobsBy} onChange={setJobsBy} />}
          >
            {jobsBy === 'intake' ? <Bars data={a.series.jobsByIntake.map((x) => ({ key: x.label, ...x }))} onPick={pick('Jobs by intake year')} /> : <Lines data={a.series.overTime} lines={[{ key: 'jobs', name: 'Jobs', color: NAVY }]} />}
          </ChartPanel>
        </Grid>
      )}

      {tab === 'Portfolio Health' && (
        <Grid>
          <ChartPanel title="Venture survival by cohort" sub="Share of each intake year still operating" info={indicator('venture.survival')}>
            <Bars data={a.series.survival.map((x) => ({ key: x.label, label: x.label, value: x.value, ids: x.ids }))} suffix="%" max={100} color={SKY} onPick={pick('Still operating')} />
          </ChartPanel>
          <ChartPanel title="Ventures by status" sub="Active, paused, pivoted, acquired or closed, right now">
            <Bars data={a.breakdowns.status} color={SKY} onPick={pick('Ventures by status')} />
          </ChartPanel>
          <ChartPanel title="Stage progression" sub="Ventures that moved up a stage, by year" info={indicator('venture.stage_moves')}>
            {a.series.progression.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={a.series.progression} margin={{ top: 16, right: 10, bottom: 0, left: -16 }} barGap={2}>
                  <CartesianGrid {...gridProps} vertical={false} />
                  <XAxis dataKey="label" {...categoryAxisProps} />
                  <YAxis allowDecimals={false} {...valueAxisProps} />
                  <Tooltip content={<ChartTooltip />} cursor={CHART.cursor} />
                  <RLegend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="toBuild" name="Expose → Build" fill={SKY} radius={CHART.barRadius} barSize={24} isAnimationActive={false} onClick={(p: { payload?: { ids: string[] } }) => p.payload && setDrill({ title: 'Stage progression', ids: p.payload.ids })} className="cursor-pointer" />
                  <Bar dataKey="toScale" name="Build → Scale" fill={NAVY} radius={CHART.barRadius} barSize={24} isAnimationActive={false} onClick={(p: { payload?: { ids: string[] } }) => p.payload && setDrill({ title: 'Stage progression', ids: p.payload.ids })} className="cursor-pointer" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="No ventures moved up a stage in this period." />
            )}
          </ChartPanel>
          <ChartPanel
            title="Revenue trend"
            sub={revenueBy === 'intake' ? 'Median 12-month revenue per intake year (USD)' : 'Median 12-month revenue at each half-year (USD)'}
            info={indicator('venture.revenue_median')}
            right={<Toggle value={revenueBy} onChange={setRevenueBy} />}
          >
            {revenueBy === 'intake' ? (
              <Lines data={a.series.revenueByIntake.map((x) => ({ label: x.label, revenueMedian: x.value }))} lines={[{ key: 'revenueMedian', name: 'Median revenue', color: NAVY }]} money />
            ) : (
              <Lines data={a.series.overTime} lines={[{ key: 'revenueMedian', name: 'Median revenue', color: NAVY }]} money />
            )}
          </ChartPanel>
        </Grid>
      )}

      {tab === 'Jobs & funding' && (
        <>
          <StatCards
            columns={4}
            items={[
              { label: 'Jobs added since baseline', value: v['venture.jobs_change']!, icon: TrendingUp, hint: `${v['venture.jobs_per_venture']} jobs per venture`, tip: indicator('venture.jobs_change') },
              { label: 'External funding raised', value: v['venture.funding_raised']!, display: money(v['venture.funding_raised']), icon: HandCoins, hint: `${v['venture.raised_pct'] ?? 0}% of ventures have raised`, tip: indicator('venture.funding_raised') },
              { label: 'Median raised', value: v['venture.funding_raised_median'] ?? 0, display: money(v['venture.funding_raised_median']), icon: Coins, hint: `average ${money(v['venture.funding_raised_avg'])}`, tip: indicator('venture.funding_raised_median') },
              { label: 'Ventures funded by CHII', value: v['venture.ventures_funded']!, icon: Briefcase, hint: `${money(v['venture.funding_deployed'])} deployed`, tip: indicator('venture.ventures_funded') },
            ]}
          />
          <Grid>
            <ChartPanel title="Jobs by who holds them" sub={`Out of ${v['venture.jobs']} jobs. A job can count in more than one group.`}>
              <Bars data={a.breakdowns.jobsByType} horizontal color={NAVY} />
            </ChartPanel>
            <ChartPanel title="Baseline vs latest" sub="Totals when ventures joined the registry, and now" info="Baseline = each venture’s first update; latest = its latest accepted update by the end of the period.">
              <Grouped data={a.series.baselineVsLatest} />
            </ChartPanel>
            <ChartPanel title="Funding over time" sub="CHII funding deployed and external funding raised, at each half-year (USD)">
              <Lines data={a.series.overTime} lines={[{ key: 'deployed', name: 'CHII funding deployed', color: NAVY }, { key: 'raised', name: 'External funding raised', color: ORANGE }]} money />
            </ChartPanel>
            <ChartPanel title="Funding and revenue: baseline vs latest" sub="USD">
              <Grouped data={a.series.fundingBaselineVsLatest} money />
            </ChartPanel>
          </Grid>
        </>
      )}

      {tab === 'Founders & inclusion' && (
        <>
          <StatCards
            columns={4}
            items={[
              { label: 'Founders', value: a.founders.total, icon: Users, hint: 'counted once by CHII ID', tip: indicator('venture.founders') },
              { label: 'Female founders', value: v['venture.female_founders_pct'] ?? 0, suffix: '%', icon: Users, hint: `${a.founders.female} of ${a.founders.total}`, tip: indicator('venture.female_founders_pct') },
              { label: 'Youth-led ventures', value: v['venture.youth_led']!, icon: Users, hint: share(v['venture.youth_led'], v['venture.supported']), tip: indicator('venture.youth_led') },
              { label: 'New ventures', value: v['venture.new']!, icon: Briefcase, hint: period.key === 'to_date' ? 'all intake years' : `intake in ${period.label}`, tip: indicator('venture.new') },
            ]}
          />
          <Grid>
            <ChartPanel title="Women-, youth- and PWD-led share" sub={`Out of ${v['venture.supported']} ventures`}>
              <Bars data={a.breakdowns.inclusion} horizontal color={ORANGE} total={v['venture.supported']!} onPick={pick('Inclusion')} />
            </ChartPanel>
            <ChartPanel title="Ventures by sector">
              <Bars data={a.breakdowns.sector} horizontal onPick={pick('Ventures by sector')} />
            </ChartPanel>
            <ChartPanel title="How ventures came to CHII" sub="Source">
              <Bars data={a.breakdowns.source} horizontal color={SKY} onPick={pick('Ventures by source')} />
            </ChartPanel>
            <ChartPanel title="Ventures by region and track">
              <div className="grid gap-4 sm:grid-cols-2">
                <Bars data={a.breakdowns.region} horizontal height={200} onPick={pick('Ventures by region')} />
                <Bars data={a.breakdowns.track} horizontal height={200} color={SKY} onPick={pick('Ventures by track')} />
              </div>
            </ChartPanel>
          </Grid>
        </>
      )}

      <p className="text-xs text-muted">Click a bar to see the ventures behind it. Exports hide counts under 5. Founder names and emails never appear in analytics.</p>

      {drill && <DrillDown title={drill.title} ids={drill.ids} data={data} rows={a.rows} onClose={() => setDrill(null)} onOpen={onOpen} />}
      {defs && <Definitions values={v} onClose={() => setDefs(false)} />}
    </>
  )
}

/* ---------- Pieces ---------- */

const indicator = (code: string) => VENTURE_INDICATORS.find((i) => i.code === code)!.definition
const share = (n: number | null, of: number | null) => (n != null && of ? `${Math.round((n / of) * 100)}% of ventures` : undefined)

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>
}

function ChartPanel({ title, sub, info, right, children }: { title: string; sub?: string; info?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Panel title={title} sub={sub} info={info} headerRight={right}>
      <div className="px-3 pb-3 pt-4">{children}</div>
    </Panel>
  )
}

function Toggle({ value, onChange }: { value: 'intake' | 'date'; onChange: (v: 'intake' | 'date') => void }) {
  return (
    <div className="flex rounded-md bg-white/10 p-0.5 text-[11px] font-semibold">
      {(['intake', 'date'] as const).map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={`rounded px-2 py-1 ${value === k ? 'bg-white text-brand' : 'text-white/80 hover:text-white'}`}>
          {k === 'intake' ? 'Intake year' : 'Over time'}
        </button>
      ))}
    </div>
  )
}

function Empty({ text = 'No ventures in this view.' }: { text?: string }) {
  return <div className="grid h-[200px] place-items-center text-sm text-muted">{text}</div>
}

function Bars({
  data,
  onPick,
  color = NAVY,
  horizontal,
  height,
  suffix = '',
  max,
  total,
}: {
  data: (Slice | { key: string; label: string; value: number; ids?: string[] })[]
  onPick?: (s: { ids?: string[] }) => void
  color?: string
  horizontal?: boolean
  height?: number
  suffix?: string
  max?: number
  total?: number
}) {
  if (!data.length || data.every((d) => !d.value)) return <Empty />
  const rows = data.map((d) => ({ ...d, display: `${d.value}${suffix}${total ? ` · ${Math.round((d.value / total) * 100)}%` : ''}` }))
  const h = height ?? (horizontal ? Math.max(160, rows.length * 34 + 30) : 250)
  const click = (p: { payload?: { ids?: string[] } }) => onPick && p.payload && onPick(p.payload)
  return (
    <ResponsiveContainer width="100%" height={h}>
      {horizontal ? (
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} horizontal={false} />
          <XAxis type="number" allowDecimals={false} domain={[0, max ?? 'auto']} {...valueAxisProps} />
          <YAxis type="category" dataKey="label" width={150} {...categoryAxisProps} />
          <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={CHART.cursor} />
          <Bar dataKey="value" name="Ventures" fill={color} radius={CHART.barRadiusH} barSize={18} isAnimationActive={false} onClick={click} className={onPick ? 'cursor-pointer' : ''}>
            <LabelList dataKey="display" position="right" fontSize={11} fontWeight={700} fill="var(--color-brand-deep)" />
          </Bar>
        </BarChart>
      ) : (
        <BarChart data={rows} margin={{ top: 18, right: 10, bottom: 0, left: -16 }} barCategoryGap="28%">
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="label" {...categoryAxisProps} interval={0} />
          <YAxis allowDecimals={false} domain={[0, max ?? 'auto']} {...valueAxisProps} />
          <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={CHART.cursor} />
          <Bar dataKey="value" name="Ventures" fill={color} radius={CHART.barRadius} barSize={46} isAnimationActive={false} onClick={click} className={onPick ? 'cursor-pointer' : ''}>
            {rows.map((r) => (
              <Cell key={r.key} fill={color} />
            ))}
            <LabelList dataKey="display" position="top" fontSize={11} fontWeight={700} fill="var(--color-brand-deep)" />
          </Bar>
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}

function Lines({ data, lines, money: isMoney }: { data: Record<string, unknown>[]; lines: { key: string; name: string; color: string }[]; money?: boolean }) {
  if (!data.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: isMoney ? 0 : -16 }}>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey="label" {...categoryAxisProps} />
        <YAxis allowDecimals={false} {...valueAxisProps} tickFormatter={isMoney ? (x: number) => money(x) : undefined} />
        <Tooltip content={<ChartTooltip />} />
        {lines.length > 1 && <RLegend wrapperStyle={{ fontSize: 11 }} />}
        {lines.map((l) => (
          <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} {...lineProps} isAnimationActive={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function Grouped({ data, money: isMoney }: { data: { label: string; baseline: number; latest: number }[]; money?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 18, right: 10, bottom: 0, left: isMoney ? 0 : -16 }} barGap={4}>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey="label" {...categoryAxisProps} />
        <YAxis {...valueAxisProps} tickFormatter={isMoney ? (x: number) => money(x) : undefined} />
        <Tooltip content={<ChartTooltip />} cursor={CHART.cursor} />
        <RLegend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="baseline" name="Baseline" fill={SKY} radius={CHART.barRadius} barSize={34} isAnimationActive={false}>
          <LabelList dataKey="baseline" position="top" fontSize={10} fontWeight={700} fill="var(--color-brand-deep)" formatter={isMoney ? (x: number) => money(x) : undefined} />
        </Bar>
        <Bar dataKey="latest" name="Latest" fill={NAVY} radius={CHART.barRadius} barSize={34} isAnimationActive={false}>
          <LabelList dataKey="latest" position="top" fontSize={10} fontWeight={700} fill="var(--color-brand-deep)" formatter={isMoney ? (x: number) => money(x) : undefined} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DrillDown({ title, ids, data, rows, onClose, onOpen }: { title: string; ids: string[]; data: RegistryData; rows: ReturnType<typeof analyse>['rows']; onClose: () => void; onOpen: (id: string) => void }) {
  const list = [...new Set(ids)].map((id) => rows.find((r) => r.ventureId === id) ?? null).filter(Boolean) as ReturnType<typeof analyse>['rows']
  void data
  return (
    <Modal open onClose={onClose} size="lg" title={`${title} · ${list.length} venture${list.length === 1 ? '' : 's'}`} description="The ventures behind this number. Staff only.">
      <ul className="divide-y divide-line rounded-lg border border-line">
        {list.map((r) => (
          <li key={r.ventureId}>
            <button type="button" onClick={() => (onClose(), onOpen(r.ventureId))} className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-canvas">
              <span className="font-mono text-xs text-brand-600">{r.code}</span>
              <span className="min-w-0 flex-1 font-semibold text-ink">{r.name}</span>
              <StagePill stage={r.stage} />
              <VentureStatusPill status={r.status} />
              <span className="w-16 text-right text-xs tabular-nums text-muted">{r.jobsTotal} jobs</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

/** Sections for the definitions list, so it can be browsed as well as searched. */
const V_GROUP = (code: string) =>
  /jobs/.test(code) ? 'Jobs' : /funding|funded|raised|revenue/.test(code) ? 'Funding & revenue' : /founders|led$/.test(code) ? 'Founders & inclusion' : /survival|stage_moves/.test(code) ? 'Portfolio health' : 'Portfolio'

function Definitions({ values, onClose }: { values: Record<string, number | null>; onClose: () => void }) {
  const fmt = (code: string) => {
    const i = VENTURE_INDICATORS.find((x) => x.code === code)!
    const n = values[code]
    return n == null ? '—' : i.unit === 'usd' ? money(n) : i.unit === 'percent' ? `${n}%` : n.toLocaleString()
  }
  const order = ['Portfolio', 'Portfolio health', 'Founders & inclusion', 'Jobs', 'Funding & revenue']
  const items: Definition[] = VENTURE_INDICATORS.map((i) => ({ name: i.name, code: i.code, definition: i.definition, where: i.dashboard ? `Dashboard: ${i.dashboard}` : undefined, value: fmt(i.code), group: V_GROUP(i.code) })).sort(
    (a, b) => order.indexOf(a.group) - order.indexOf(b.group),
  )
  return <DefinitionsModal open onClose={onClose} description="Each metric is defined once and computed from the registry. The CHII dashboard and reports read the same values." items={items} />
}

/** CSV of the headline metrics and breakdowns. Counts under 5 are hidden (spec §4). */
function exportCsv(a: ReturnType<typeof analyse>, periodLabel: string) {
  const out: string[][] = [['Section', 'Item', 'Value', 'Definition']]
  for (const i of VENTURE_INDICATORS) {
    const n = a.values[i.code]
    out.push(['Headline', i.name, i.unit === 'count' ? suppressCount(n) : n == null ? '' : String(n), i.definition])
  }
  const sections: [string, Slice[]][] = [
    ['By country', a.breakdowns.country],
    ['By region', a.breakdowns.region],
    ['By stage', a.breakdowns.stage],
    ['By status', a.breakdowns.status],
    ['By sector', a.breakdowns.sector],
    ['By source', a.breakdowns.source],
    ['By track', a.breakdowns.track],
    ['By intake year', a.breakdowns.intakeYear],
  ]
  for (const [name, list] of sections) for (const s of list) out.push([name, s.label, suppressCount(s.value), ''])
  const csv = out.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  link.download = `venture-analytics-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
