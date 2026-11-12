/**
 * Venture metrics (VENTURE-REGISTRY-SPEC §4, build step 5).
 *
 * The indicator dictionary below holds every Ventures Portfolio metric from the CHII dashboard
 * (HENT), with the definitions agreed with MELA in step 1, plus the extra metrics in the spec.
 * analyse() computes all of them from the registry for a period and filters, so Venture
 * Analytics, the dashboard and reports can all read the same numbers.
 *
 * Portfolio metrics are "as of" the end of the period (each venture's latest accepted update by
 * then). Flow metrics (new ventures, stage moves) count what happened inside the period.
 */
import { REPORTING_DATE, foundersOf, stageHistory, ventureChange, ventureLatest, type VentureRow } from './derive'
import { countryName } from './lists'
import { personById } from './people'
import type { RegistryData, Stage, VentureStatus } from './types'

/* ---------- Indicator dictionary ---------- */

export type VIndicator = {
  code: string
  name: string
  /** Where it appears on the CHII dashboard's Ventures Portfolio (HENT), if it does. */
  dashboard?: string
  definition: string
  unit: 'count' | 'usd' | 'percent' | 'number'
  kind: 'as_of' | 'in_period'
}

export const VENTURE_INDICATORS: VIndicator[] = [
  { code: 'venture.supported', name: 'Ventures supported', dashboard: 'Card · Ventures Supported', definition: 'Ventures in the registry by the end of the period, whatever their status.', unit: 'count', kind: 'as_of' },
  { code: 'venture.active', name: 'Active ventures', dashboard: 'HENT Overview · Active Ventures', definition: 'Ventures whose latest status is Active. Only Active counts as active (MELA).', unit: 'count', kind: 'as_of' },
  { code: 'venture.new', name: 'New ventures', definition: 'Ventures whose intake year falls in the period.', unit: 'count', kind: 'in_period' },
  { code: 'venture.women_led', name: 'Women-led ventures', dashboard: 'Card · Women-Led Ventures Supported; chart · Female-Led', definition: 'Ventures with at least one female founder (lead or co-founder), or set to Yes by hand (MELA).', unit: 'count', kind: 'as_of' },
  { code: 'venture.youth_led', name: 'Youth-led ventures', definition: 'Ventures whose lead founder is 35 or under on the date, or set to Yes by hand.', unit: 'count', kind: 'as_of' },
  { code: 'venture.pwd_led', name: 'PWD-led ventures', dashboard: 'Card · PWD-Led Ventures Supported', definition: 'Ventures with at least one founder who has a disability, or set to Yes by hand.', unit: 'count', kind: 'as_of' },
  { code: 'venture.accelerator', name: 'Ventures in an accelerator', dashboard: 'Chart · In Accelerators', definition: 'Ventures marked as being in an accelerator.', unit: 'count', kind: 'as_of' },
  { code: 'venture.founders', name: 'Founders', definition: 'Founders and co-founders linked to the ventures, counted once by CHII ID.', unit: 'count', kind: 'as_of' },
  { code: 'venture.female_founders_pct', name: 'Female founders', definition: 'Female founders ÷ founders, counted once by CHII ID.', unit: 'percent', kind: 'as_of' },
  { code: 'venture.jobs', name: 'Jobs created', dashboard: 'Card · Jobs Created by Ventures', definition: 'Sum of total jobs in each venture’s latest accepted update by the end of the period.', unit: 'count', kind: 'as_of' },
  { code: 'venture.jobs_women', name: 'Jobs held by women', definition: 'Sum of women jobs in the latest updates.', unit: 'count', kind: 'as_of' },
  { code: 'venture.jobs_pwd', name: 'Jobs held by people with a disability', definition: 'Sum of PWD jobs in the latest updates.', unit: 'count', kind: 'as_of' },
  { code: 'venture.jobs_displaced', name: 'Jobs held by displaced people', definition: 'Sum of displaced-person jobs in the latest updates.', unit: 'count', kind: 'as_of' },
  { code: 'venture.jobs_change', name: 'Jobs added since baseline', definition: 'Latest total jobs minus baseline total jobs, summed over ventures.', unit: 'count', kind: 'as_of' },
  { code: 'venture.jobs_per_venture', name: 'Jobs per venture', definition: 'Jobs created ÷ ventures supported (as on the dashboard).', unit: 'number', kind: 'as_of' },
  { code: 'venture.funding_deployed', name: 'Funding deployed', dashboard: 'Card · Funding Deployed', definition: 'CHII Venture Funding awards made by the end of the period (USD). Never counted as funding raised.', unit: 'usd', kind: 'as_of' },
  { code: 'venture.ventures_funded', name: 'Ventures funded by CHII', dashboard: 'At a Glance · Ventures Funded', definition: 'Ventures with at least one CHII Venture Funding award.', unit: 'count', kind: 'as_of' },
  { code: 'venture.funding_raised', name: 'External funding raised', definition: 'Funding raised from others to date, from the latest updates (USD). Excludes CHII awards.', unit: 'usd', kind: 'as_of' },
  { code: 'venture.funding_raised_median', name: 'Median funding raised', definition: 'Median external funding among ventures that have raised any.', unit: 'usd', kind: 'as_of' },
  { code: 'venture.funding_raised_avg', name: 'Average funding raised', definition: 'Average external funding among ventures that have raised any.', unit: 'usd', kind: 'as_of' },
  { code: 'venture.raised_pct', name: 'Ventures that have raised funding', definition: 'Ventures with external funding above 0 ÷ ventures supported.', unit: 'percent', kind: 'as_of' },
  { code: 'venture.revenue', name: 'Revenue generated', dashboard: 'Card · Revenue Generated', definition: 'Revenue over the last 12 months, from the latest updates of ventures that reported it (USD).', unit: 'usd', kind: 'as_of' },
  { code: 'venture.revenue_median', name: 'Median revenue', dashboard: 'Chart · Revenue Trend', definition: 'Median 12-month revenue of ventures that reported it. The median keeps one large venture from hiding the rest.', unit: 'usd', kind: 'as_of' },
  { code: 'venture.survival', name: 'Still operating', dashboard: 'Chart · Venture Survival by Cohort', definition: 'Share of an intake year’s ventures whose latest status is Active (MELA: only Active counts as operating).', unit: 'percent', kind: 'as_of' },
  { code: 'venture.stage_moves', name: 'Stage progression', dashboard: 'Chart · Stage Progression', definition: 'Ventures that moved up a stage (Expose → Build, Build → Scale), counted in the year of the update that shows it.', unit: 'count', kind: 'in_period' },
]
export const indicator = (code: string) => VENTURE_INDICATORS.find((i) => i.code === code)!

/* ---------- Periods and filters ---------- */

export type VPeriod = { key: string; label: string; start: string; end: string }

const TODAY = REPORTING_DATE
const yearP = (y: number): VPeriod => ({ key: `y${y}`, label: String(y), start: `${y}-01-01`, end: `${y}-12-31` })
const halfP = (y: number, h: 1 | 2): VPeriod => ({ key: `h${h}-${y}`, label: `H${h} ${y}`, start: h === 1 ? `${y}-01-01` : `${y}-07-01`, end: h === 1 ? `${y}-06-30` : `${y}-12-31` })

export const PERIODS: VPeriod[] = [{ key: 'to_date', label: 'To date', start: '2015-01-01', end: TODAY }, yearP(2025), halfP(2025, 2), halfP(2025, 1), yearP(2024), yearP(2023)]

/** The period before: a year earlier for "to date", otherwise the previous year or half-year. */
export function previousPeriod(p: VPeriod): VPeriod {
  if (p.key === 'to_date') return { key: 'to_date_prev', label: '12 months earlier', start: p.start, end: `${Number(TODAY.slice(0, 4)) - 1}${TODAY.slice(4)}` }
  if (p.key.startsWith('y')) return yearP(Number(p.key.slice(1)) - 1)
  const [h, y] = p.key.slice(1).split('-').map(Number)
  return h === 2 ? halfP(y, 1) : halfP(y - 1, 2)
}

export type VFilters = {
  sector?: string[]
  country?: string[]
  region?: string[]
  stage?: Stage[]
  status?: VentureStatus[]
  track?: string[]
  source?: string[]
  intakeYear?: number[]
  womenLed?: boolean
  youthLed?: boolean
}

export const FILTER_FIELDS: { key: keyof VFilters; label: string; value: (r: VentureRow) => string | number | boolean | null }[] = [
  { key: 'sector', label: 'Sector', value: (r) => r.sector },
  { key: 'country', label: 'Country', value: (r) => r.country },
  { key: 'region', label: 'Region', value: (r) => r.region },
  { key: 'stage', label: 'Stage', value: (r) => r.stage },
  { key: 'status', label: 'Status', value: (r) => r.status },
  { key: 'track', label: 'Track', value: (r) => r.track },
  { key: 'source', label: 'Source', value: (r) => r.source },
  { key: 'intakeYear', label: 'Intake year', value: (r) => r.intakeYear },
  { key: 'womenLed', label: 'Women-led', value: (r) => r.womenLed },
  { key: 'youthLed', label: 'Youth-led', value: (r) => r.youthLed },
]

export function applyFilters(rows: VentureRow[], f: VFilters): VentureRow[] {
  return rows.filter((r) =>
    FILTER_FIELDS.every(({ key, value }) => {
      const want = f[key]
      if (want == null || (Array.isArray(want) && !want.length)) return true
      const v = value(r)
      return Array.isArray(want) ? (want as (string | number)[]).includes(v as string | number) : v === want
    }),
  )
}

const asOf = (p: VPeriod) => (p.end > TODAY ? TODAY : p.end)

/* ---------- Analysis ---------- */

export type Slice = { key: string; label: string; value: number; ids: string[] }

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)

function by(rows: VentureRow[], key: (r: VentureRow) => string | number | null, label: (k: string) => string = (k) => k, order?: string[]): Slice[] {
  const m = new Map<string, string[]>()
  for (const r of rows) {
    const k = key(r)
    if (k == null || k === '') continue
    m.set(String(k), [...(m.get(String(k)) ?? []), r.ventureId])
  }
  const out = [...m.entries()].map(([k, ids]) => ({ key: k, label: label(k), value: ids.length, ids }))
  return order ? order.flatMap((k) => out.filter((x) => x.key === k)) : out.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

/** Half-year ends from the first record to the period end, for "over time" charts by update date. */
function halfYearEnds(d: RegistryData, end: string): string[] {
  const first = d.updates.filter((u) => u.acceptedAt).map((u) => u.asOf).sort()[0] ?? end
  const out: string[] = []
  for (let y = Number(first.slice(0, 4)); y <= Number(end.slice(0, 4)); y++)
    for (const e of [`${y}-06-30`, `${y}-12-31`]) {
      if (e < first) continue
      out.push(e > end ? end : e)
      if (e >= end) return out
    }
  return out
}
const halfLabel = (iso: string) => (iso === TODAY ? 'Now' : `${iso.slice(5, 7) <= '06' ? 'H1' : 'H2'} ${iso.slice(0, 4)}`)

export function analyse(d: RegistryData, period: VPeriod, filters: VFilters = {}) {
  const end = asOf(period)
  const rows = applyFilters(ventureLatest(d, end), filters)
  const ids = rows.map((r) => r.ventureId)
  const y0 = Number(period.start.slice(0, 4))
  const y1 = Number(end.slice(0, 4))
  const inYears = (y: number) => period.key === 'to_date' || (y >= y0 && y <= y1)

  // Founders, counted once by CHII ID.
  const founderIds = new Set(ids.flatMap((id) => foundersOf(d, id, end).map((m) => m.chiiId)))
  const femaleFounders = [...founderIds].filter((id) => personById(id)?.gender === 'F').length

  const raisedRows = rows.filter((r) => r.fundingRaisedUsd > 0)
  const revenueRows = rows.filter((r) => r.revenueUsd != null)
  const changes = ids.map((id) => ventureChange(d, id, end))
  const baselineOf = (f: 'jobsTotal' | 'jobsWomen' | 'fundingUsd' | 'revenueUsd') => sum(changes.map((c) => c.find((x) => x.field === f)?.baseline ?? 0))

  const jobs = sum(rows.map((r) => r.jobsTotal))
  const values: Record<string, number | null> = {
    'venture.supported': rows.length,
    'venture.active': rows.filter((r) => r.active).length,
    'venture.new': rows.filter((r) => inYears(r.intakeYear)).length,
    'venture.women_led': rows.filter((r) => r.womenLed).length,
    'venture.youth_led': rows.filter((r) => r.youthLed).length,
    'venture.pwd_led': rows.filter((r) => r.pwdLed).length,
    'venture.accelerator': rows.filter((r) => r.inAccelerator).length,
    'venture.founders': founderIds.size,
    'venture.female_founders_pct': pct(femaleFounders, founderIds.size),
    'venture.jobs': jobs,
    'venture.jobs_women': sum(rows.map((r) => r.jobsWomen)),
    'venture.jobs_pwd': sum(rows.map((r) => r.jobsPwd)),
    'venture.jobs_displaced': sum(rows.map((r) => r.jobsDisplaced)),
    'venture.jobs_change': jobs - baselineOf('jobsTotal'),
    'venture.jobs_per_venture': rows.length ? Math.round(jobs / rows.length) : null,
    'venture.funding_deployed': sum(rows.map((r) => r.chiiFundingUsd)),
    'venture.ventures_funded': rows.filter((r) => r.chiiFundingUsd > 0).length,
    'venture.funding_raised': sum(rows.map((r) => r.fundingRaisedUsd)),
    'venture.funding_raised_median': median(raisedRows.map((r) => r.fundingRaisedUsd)),
    'venture.funding_raised_avg': raisedRows.length ? Math.round(sum(raisedRows.map((r) => r.fundingRaisedUsd)) / raisedRows.length) : null,
    'venture.raised_pct': pct(raisedRows.length, rows.length),
    'venture.revenue': sum(revenueRows.map((r) => r.revenueUsd!)),
    'venture.revenue_median': median(revenueRows.map((r) => r.revenueUsd!)),
    'venture.survival': pct(rows.filter((r) => r.active).length, rows.length),
  }

  // Stage moves inside the period, for the ventures in view.
  const inView = new Set(ids)
  const moves = stageHistory(d, end).filter((m) => inView.has(m.ventureId) && m.asOf >= period.start && STAGE_RANK[m.to] > STAGE_RANK[m.from])
  values['venture.stage_moves'] = moves.length

  const years = [...new Set(rows.map((r) => r.intakeYear))].sort()
  const series = {
    /** Dashboard "Jobs Created Over Time": jobs of the ventures in each intake year. */
    jobsByIntake: years.map((y) => ({ label: String(y), value: sum(rows.filter((r) => r.intakeYear === y).map((r) => r.jobsTotal)), ids: rows.filter((r) => r.intakeYear === y).map((r) => r.ventureId) })),
    /** The same over time by update date: the portfolio's jobs at each half-year end. */
    overTime: halfYearEnds(d, end).map((e) => {
      const at = applyFilters(ventureLatest(d, e), filters)
      const rev = at.filter((r) => r.revenueUsd != null).map((r) => r.revenueUsd!)
      return {
        label: halfLabel(e),
        jobs: sum(at.map((r) => r.jobsTotal)),
        ventures: at.length,
        deployed: sum(at.map((r) => r.chiiFundingUsd)),
        raised: sum(at.map((r) => r.fundingRaisedUsd)),
        revenueMedian: median(rev),
      }
    }),
    /** Dashboard "Venture Survival by Cohort". */
    survival: years.map((y) => {
      const c = rows.filter((r) => r.intakeYear === y)
      return { label: String(y), value: pct(c.filter((r) => r.active).length, c.length) ?? 0, n: c.length, ids: c.filter((r) => r.active).map((r) => r.ventureId) }
    }),
    /** Dashboard "Stage Progression", by the year of the move. */
    progression: [...new Set(moves.map((m) => m.year))].sort().map((y) => ({
      label: String(y),
      toBuild: moves.filter((m) => m.year === y && m.to === 'Build').length,
      toScale: moves.filter((m) => m.year === y && m.to === 'Scale').length,
      ids: moves.filter((m) => m.year === y).map((m) => m.ventureId),
    })),
    /** Dashboard "Revenue Trend": median revenue per intake year. */
    revenueByIntake: years.flatMap((y) => {
      const m = median(rows.filter((r) => r.intakeYear === y && r.revenueUsd != null).map((r) => r.revenueUsd!))
      return m == null ? [] : [{ label: String(y), value: m }]
    }),
    baselineVsLatest: [
      { label: 'Total jobs', baseline: baselineOf('jobsTotal'), latest: jobs },
      { label: 'Women jobs', baseline: baselineOf('jobsWomen'), latest: values['venture.jobs_women']! },
    ],
    fundingBaselineVsLatest: [
      { label: 'External funding raised', baseline: baselineOf('fundingUsd'), latest: values['venture.funding_raised']! },
      { label: 'Revenue (12 months)', baseline: baselineOf('revenueUsd'), latest: values['venture.revenue']! },
    ],
  }

  const breakdowns = {
    country: by(rows, (r) => r.country, countryName),
    region: by(rows, (r) => r.region),
    stage: by(rows, (r) => r.stage, undefined, ['Expose', 'Build', 'Scale']),
    status: by(rows, (r) => r.status, undefined, ['Active', 'Paused', 'Pivoted', 'Acquired', 'Closed']),
    legalStatus: by(rows, (r) => r.legalStatus),
    sector: by(rows, (r) => r.sector),
    source: by(rows, (r) => r.source),
    track: by(rows, (r) => r.track),
    institution: by(rows, (r) => r.institution),
    intakeYear: by(rows, (r) => r.intakeYear, undefined, years.map(String)),
    /** Dashboard "Female-Led and Accelerated Ventures". */
    femaleAccelerated: [
      { key: 'female', label: 'Female-led', value: values['venture.women_led']!, ids: rows.filter((r) => r.womenLed).map((r) => r.ventureId) },
      { key: 'accelerator', label: 'In accelerators', value: values['venture.accelerator']!, ids: rows.filter((r) => r.inAccelerator).map((r) => r.ventureId) },
      { key: 'active_female', label: 'Active & female-led', value: rows.filter((r) => r.active && r.womenLed).length, ids: rows.filter((r) => r.active && r.womenLed).map((r) => r.ventureId) },
    ] as Slice[],
    inclusion: [
      { key: 'women', label: 'Women-led', value: values['venture.women_led']!, ids: rows.filter((r) => r.womenLed).map((r) => r.ventureId) },
      { key: 'youth', label: 'Youth-led', value: values['venture.youth_led']!, ids: rows.filter((r) => r.youthLed).map((r) => r.ventureId) },
      { key: 'pwd', label: 'PWD-led', value: values['venture.pwd_led']!, ids: rows.filter((r) => r.pwdLed).map((r) => r.ventureId) },
    ] as Slice[],
    jobsByType: [
      { key: 'women', label: 'Women', value: values['venture.jobs_women']!, ids },
      { key: 'pwd', label: 'People with a disability', value: values['venture.jobs_pwd']!, ids },
      { key: 'displaced', label: 'Displaced people', value: values['venture.jobs_displaced']!, ids },
    ] as Slice[],
  }

  return { period, asOf: end, rows, values, series, breakdowns, founders: { total: founderIds.size, female: femaleFounders } }
}

export type Analysis = ReturnType<typeof analyse>

const STAGE_RANK: Record<Stage, number> = { Expose: 0, Build: 1, Scale: 2 }

/* ---------- Targets and suppression ---------- */

/**
 * Targets found in the dashboard's Ventures page code (ventures 400, jobs 2,000, funds $910,904).
 * The live targets sit in the dashboard database (v_progress); MELA to confirm these.
 */
export const VENTURE_TARGETS: Record<string, number> = { 'venture.active': 400, 'venture.jobs': 2000, 'venture.funding_deployed': 910_904 }

/** Exports and reports hide counts under 5 (spec §4). Money and percentages aren't counts of people. */
export const suppressCount = (n: number | null) => (n == null ? '' : n > 0 && n < 5 ? '<5' : String(n))
