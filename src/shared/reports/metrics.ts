/**
 * getMetric: the one function every report number goes through (REPORT-TOOL-SPEC §11).
 *
 *   getMetric(viewer, { code, scope, period, dateRule, breakdown, comparison, audience })
 *
 * It does three jobs, in this order, so no caller can skip one:
 *   1. Permissions. The scope must sit inside the viewer's pillars, interventions must belong
 *      to those pillars, and breakdowns must be on the indicator's allowed list. Sensitive
 *      breakdowns and filters are refused in Public reports unless a MELA admin allows them.
 *   2. Calculation, over the fact table (facts.ts), using the indicator dictionary.
 *   3. Small-number suppression (spec §8), including secondary suppression.
 *
 * In this browser prototype the checks run in the app. A server version keeps this signature
 * and moves the same checks behind row-level security.
 */
import type { Pillar, Role } from '../data/mela'
import { cohorts, facts, type Fact } from './facts'
import { indicatorByCode, type Indicator } from './indicators'
import { REPORT_SETTINGS, comparisonPeriod } from './periods'
import type { Audience, DateRule, Dimension, FilterKey, MetricCell, MetricRequest, MetricResult, Period, Scope, Viewer } from './types'

/* ---------- Errors ---------- */

/** The viewer may not see this scope. Shown as "You don't have access", never as zeroes. */
export class MetricAccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MetricAccessError'
  }
}

/** The request breaks a privacy rule (identity field, sensitive breakdown in a public report…). */
export class MetricPolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MetricPolicyError'
  }
}

/* ---------- Dimensions ---------- */

export const DIMENSIONS: Record<Dimension, { label: string; sensitive?: boolean; get: (f: Fact) => string }> = {
  pillar: { label: 'Pillar', get: (f) => f.pillar },
  intervention: { label: 'Intervention', get: (f) => f.intervention },
  cohort: { label: 'Cohort', get: (f) => f.cohortName },
  gender: { label: 'Gender', get: (f) => f.gender },
  age_group: { label: 'Age group', get: (f) => f.ageGroup },
  nationality: { label: 'Nationality', get: (f) => f.nationality },
  residence: { label: 'Country of residence', get: (f) => f.residence },
  disability: { label: 'Disability', sensitive: true, get: (f) => f.disability },
  humanitarian: { label: 'Humanitarian status', sensitive: true, get: (f) => f.humanitarian },
  beneficiary_type: { label: 'Beneficiary type', get: (f) => f.beneficiaryType },
  month: { label: 'Month', get: (f) => f.sessionDate.slice(0, 7) },
  quarter: { label: 'Quarter', get: (f) => `${f.sessionDate.slice(0, 4)} Q${Math.floor((Number(f.sessionDate.slice(5, 7)) - 1) / 3) + 1}` },
}

export const FILTERS: Record<FilterKey, { label: string; sensitive?: boolean; get: (f: Fact) => string }> = {
  gender: DIMENSIONS.gender,
  age_group: DIMENSIONS.age_group,
  nationality: DIMENSIONS.nationality,
  residence: DIMENSIONS.residence,
  disability: DIMENSIONS.disability,
  humanitarian: DIMENSIONS.humanitarian,
  beneficiary_type: DIMENSIONS.beneficiary_type,
  cohort_status: { label: 'Cohort status', get: (f) => f.cohortStatus },
}

/** Values a filter can take, for the scope pickers. Aggregatable categories only. */
export function filterOptions(key: FilterKey): string[] {
  return [...new Set(facts.map(FILTERS[key].get))].sort((a, b) => a.localeCompare(b))
}

/* ---------- Viewer ---------- */

const ALL_PILLARS: Pillar[] = ['HENT', 'HEMP', 'HECO']

/** Who is asking, from the signed-in role and the portal they're in. */
export function viewerFor(role: Role, portalPillars: Pillar[]): Viewer {
  return { role, pillars: role === 'admin' ? ALL_PILLARS : role === 'none' ? [] : portalPillars }
}

/** Interventions and cohorts the viewer may pick, for the scope pickers. */
export function scopeOptions(viewer: Viewer) {
  const ivs = [...new Map(facts.filter((f) => viewer.pillars.includes(f.pillar)).map((f) => [f.intervention, f.pillar])).entries()].map(([name, pillar]) => ({ name, pillar }))
  const chs = cohorts.filter((c) => viewer.pillars.includes(c.pillar))
  return { pillars: viewer.pillars, interventions: ivs.sort((a, b) => a.name.localeCompare(b.name)), cohorts: chs }
}

/* ---------- Permission checks ---------- */

function checkScope(viewer: Viewer, scope: Scope) {
  if (viewer.role === 'none') throw new MetricAccessError('This account has no staff role, so it can’t report on any data.')
  if (!scope.pillars.length) throw new MetricAccessError('Choose at least one pillar.')
  const outside = scope.pillars.filter((p) => !viewer.pillars.includes(p))
  if (outside.length) throw new MetricAccessError(`You don’t have access to ${outside.join(', ')} data.`)
  const ivPillar = new Map(facts.map((f) => [f.intervention, f.pillar]))
  scope.interventions.forEach((iv) => {
    const p = ivPillar.get(iv)
    if (!p) throw new MetricAccessError(`Unknown intervention “${iv}”.`)
    if (!scope.pillars.includes(p)) throw new MetricAccessError(`${iv} is not in the chosen pillars.`)
  })
  scope.cohorts.forEach((id) => {
    const c = cohorts.find((x) => x.id === id)
    if (!c) throw new MetricAccessError(`Unknown cohort “${id}”.`)
    if (!scope.pillars.includes(c.pillar)) throw new MetricAccessError(`${c.name} is not in the chosen pillars.`)
  })
}

function checkPrivacy(viewer: Viewer, req: MetricRequest, ind: Indicator) {
  const publicReport = req.audience === 'public'
  const sensitiveOk = viewer.role === 'admin' && viewer.allowSensitive === true
  if (req.breakdown) {
    const dim = DIMENSIONS[req.breakdown as Dimension]
    // Anything not in the dimension list (names, emails, CHII IDs…) is refused outright.
    if (!dim) throw new MetricPolicyError(`“${req.breakdown}” can’t be used in a report. Reports contain aggregates only.`)
    if (!ind.breakdowns.includes(req.breakdown)) throw new MetricPolicyError(`${ind.name} can’t be broken down by ${dim.label.toLowerCase()}.`)
    if (dim.sensitive && publicReport && !sensitiveOk) throw new MetricPolicyError(`${dim.label} breakdowns are hidden in Public reports unless a MELA admin turns them on.`)
  }
  Object.keys(req.scope.filters).forEach((k) => {
    const f = FILTERS[k as FilterKey]
    if (!f) throw new MetricPolicyError(`“${k}” can’t be used as a report filter.`)
    if (f.sensitive && publicReport && !sensitiveOk && req.scope.filters[k as FilterKey]?.length)
      throw new MetricPolicyError(`${f.label} filters are hidden in Public reports unless a MELA admin turns them on.`)
  })
}

/* ---------- Selection ---------- */

const dateOf = (f: Fact, rule: DateRule) => (rule === 'session' ? f.sessionDate : rule === 'registration' ? f.registeredOn : f.respondedOn)

/**
 * Interventions are chosen per pillar: a pillar with none ticked contributes all of its
 * interventions ("All interventions in HENT"), one with some ticked contributes only those.
 */
const ivPillarOf = new Map(facts.map((f) => [f.intervention, f.pillar]))
export function pillarsNarrowed(scope: Scope) {
  return new Set(scope.interventions.map((iv) => ivPillarOf.get(iv)))
}

function select(scope: Scope, period: Period, rule: DateRule): Fact[] {
  const narrowed = pillarsNarrowed(scope)
  return facts.filter((f) => {
    if (!scope.pillars.includes(f.pillar)) return false
    if (narrowed.has(f.pillar) && !scope.interventions.includes(f.intervention)) return false
    if (scope.cohorts.length && !scope.cohorts.includes(f.cohortId)) return false
    for (const [k, vals] of Object.entries(scope.filters)) {
      if (vals?.length && !vals.includes(FILTERS[k as FilterKey].get(f))) return false
    }
    const d = dateOf(f, rule)
    return d != null && d >= period.start && d <= period.end
  })
}

/* ---------- Formatting ---------- */

export function formatValue(v: number | null, ind: Pick<Indicator, 'unit'>): string {
  if (v == null) return '—'
  switch (ind.unit) {
    case 'rate':
      return `${v.toFixed(v % 1 ? 1 : 0)}%`
    case 'average':
    case 'score':
      return v.toFixed(1)
    case 'nps':
      return `${v > 0 ? '+' : ''}${v}`
    case 'amount':
      return `$${v.toLocaleString('en-US')}`
    default:
      return v.toLocaleString('en-US')
  }
}

export const thresholdFor = (audience: Audience) => (audience === 'internal' ? REPORT_SETTINGS.thresholdInternal : REPORT_SETTINGS.thresholdExternal)

/* ---------- Suppression (spec §8) ---------- */

/**
 * Hide small numbers so no individual can be singled out.
 *
 * Primary: any cell whose people count is between 1 and threshold−1 shows as "<threshold",
 * with its % hidden. Zero is shown: an empty category reveals nobody.
 * Secondary (additive metrics only, where a total is shown): if exactly one cell is hidden,
 * the next-smallest visible non-zero cell is hidden too, so the hidden number can't be
 * worked out as total minus the rest.
 * Rates and averages are hidden when fewer than `threshold` people sit behind them.
 */
export function suppress(cells: MetricCell[], threshold: number, additive: boolean): MetricCell[] {
  const out = cells.map((c) => {
    const small = c.n != null && c.n > 0 && c.n < threshold
    return small ? { ...c, value: null, pct: null, n: null, display: additive ? `<${threshold}` : `n<${threshold}`, suppressed: true } : c
  })
  if (additive) {
    const hidden = out.filter((c) => c.suppressed).length
    if (hidden === 1) {
      const candidates = out.filter((c) => !c.suppressed && (c.value ?? 0) > 0).sort((a, b) => (a.value ?? 0) - (b.value ?? 0))
      const next = candidates[0]
      if (next) {
        const i = out.indexOf(next)
        // Shown as a dash, not "<n": the hidden value can be any size, so any bound would be false.
        out[i] = { ...next, value: null, pct: null, n: null, display: '—', suppressed: true, secondary: true }
      }
    }
  }
  return out
}

/* ---------- getMetric ---------- */

export function getMetric(viewer: Viewer, req: MetricRequest): MetricResult {
  const ind = indicatorByCode.get(req.code)
  if (!ind) throw new MetricPolicyError(`Unknown indicator “${req.code}”.`)
  checkScope(viewer, req.scope)
  checkPrivacy(viewer, req, ind)

  const threshold = thresholdFor(req.audience)
  // A date rule the indicator can't use falls back to its default; the result says which was used.
  const dateRule = ind.dateRules.includes(req.dateRule) ? req.dateRule : ind.defaultDateRule

  const headline = (period: Period) => {
    const rows = select(req.scope, period, dateRule)
    const c = ind.compute(rows, period)
    return { rows, ...c }
  }

  const main = headline(req.period)
  // Only numbers about people are suppressed; cohort and session counts identify nobody.
  const protects = ind.aboutPeople !== false
  const smallHeadline = protects && main.n > 0 && main.n < threshold
  const result: MetricResult = {
    code: ind.code,
    label: ind.name,
    unit: ind.unit,
    value: smallHeadline ? null : main.value,
    display: main.n === 0 && main.value == null ? 'No data' : smallHeadline ? (ind.additive ? `<${threshold}` : `n<${threshold}`) : formatValue(main.value, ind),
    n: smallHeadline ? 0 : main.n,
    suppressed: smallHeadline,
    threshold,
    definition: ind.definition,
    definitionVersion: ind.version,
    dateRule,
    asOf: new Date().toISOString(),
  }

  if (req.breakdown) {
    const dim = DIMENSIONS[req.breakdown]
    const groups = new Map<string, Fact[]>()
    main.rows.forEach((f) => {
      const k = dim.get(f)
      groups.set(k, [...(groups.get(k) ?? []), f])
    })
    const total = ind.additive ? main.value ?? 0 : 0
    const cells: MetricCell[] = [...groups.entries()].map(([key, rows]) => {
      const c = ind.compute(rows, req.period)
      // For amounts, the people behind the cell are the awards, not the dollars.
      const n = ind.unit === 'amount' ? c.n : ind.additive ? c.value ?? 0 : c.n
      return {
        key,
        label: key,
        value: c.value,
        display: formatValue(c.value, ind),
        pct: ind.additive && total ? Math.round(((c.value ?? 0) / total) * 1000) / 10 : null,
        n,
        suppressed: false,
      }
    })
    cells.sort((a, b) => (req.breakdown === 'month' || req.breakdown === 'quarter' ? a.key.localeCompare(b.key) : (b.value ?? 0) - (a.value ?? 0)))
    result.rows = protects ? suppress(cells, threshold, ind.additive) : cells
  }

  if (req.comparison && req.comparison !== 'none') {
    const cp = comparisonPeriod(req.period, req.comparison)
    const prev = headline(cp)
    const prevSmall = protects && prev.n > 0 && prev.n < threshold
    const pv = prevSmall ? null : prev.value
    const delta = pv != null && result.value != null ? Math.round((result.value - pv) * 10) / 10 : null
    result.comparison = {
      label: cp.label,
      period: cp,
      value: pv,
      display: prev.n === 0 && prev.value == null ? 'No data' : prevSmall ? `<${threshold}` : formatValue(pv, ind),
      delta,
      deltaPct: delta != null && pv ? Math.round((delta / Math.abs(pv)) * 1000) / 10 : null,
    }
  }

  return result
}
