/**
 * The report's data check (REPORT-TOOL-SPEC §3 step 5).
 *
 * Completeness for the report's scope and period, plus the data quality issues that affect
 * it. Warnings don't block finalising, but they're listed in the report's data notes.
 * Critical issues block finalising unless a MELA admin overrides them with a reason.
 *
 * Findings are aggregate only (counts and percentages); the facts carry no identity data.
 */
import { PLACEHOLDERS, TEXT_ROLES, metricsUsed } from './blocks'
import { cohorts, type Fact } from './facts'
import { indicatorByCode } from './indicators'
import { MetricAccessError, factsInScope } from './metrics'
import { REPORTING_DATE, ventureLatest } from '../ventures/derive'
import { DQ_RULES, runVentureChecks } from '../ventures/quality'
import { getRegistry } from '../ventures/store'
import type { Recorded } from './source'
import type { Report, Viewer } from './types'

export type Severity = 'critical' | 'warning' | 'info'

/** Where "Fix" goes: an app page, or a wizard step. */
export type FixTarget = { label: string; page?: 'interventions' | 'feedback' | 'participants' | 'import' | 'ventures'; step?: 4 }

export type Issue = { id: string; severity: Severity; title: string; detail: string; fix?: FixTarget }

export type Completeness = { key: string; label: string; pct: number | null; detail: string }

export type DataCheck = {
  completeness: Completeness[]
  issues: Issue[]
  counts: Record<Severity, number>
  /** Values hidden by small-number suppression across the report's blocks. */
  suppressed: number
  people: number
  /** Ventures behind the report's venture numbers, when it has any. */
  ventures?: number
  checkedAt: string
}

const RESPONSE_RATE_FLOOR = 40
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null)

/** Placeholders fillPlaceholders understands (by token, or by full metric code). */
const KNOWN_TOKENS = new Set(PLACEHOLDERS.flatMap((p) => [p.token, ...(p.metric ? [p.metric] : [])]))

/** Starter sentences from the text templates: if they survive, the author hasn't written that section. */
const STARTER_LINES = Object.values(TEXT_ROLES)
  .flatMap((r) => r.starter.replace(/<[^>]+>/g, '\n').split('\n'))
  .map((s) => s.trim())
  .filter((s) => s.length > 20 && !s.includes('{{'))

export function runDataCheck(viewer: Viewer, report: Report, answers?: Record<string, Recorded>): DataCheck {
  const issues: Issue[] = []
  let rows: Fact[] = []
  try {
    rows = factsInScope(viewer, report.scope, report.period, report.dateRule)
  } catch (e) {
    if (!(e instanceof MetricAccessError)) throw e
    issues.push({ id: 'access', severity: 'critical', title: 'You can’t report on this scope', detail: e.message })
  }

  // A report built only from Venture Registry metrics: attendance and feedback don't apply to it.
  const used = metricsUsed(report.blocks ?? [])
  const ventureCodes = used.filter((c) => indicatorByCode.get(c)?.source === 'registry')
  const ventureOnly = ventureCodes.length > 0 && ventureCodes.length === used.length
  if (ventureOnly) rows = []

  /* ---- Attendance completeness, per cohort in scope ---- */
  const cohortIds = [...new Set(rows.map((f) => f.cohortId))]
  const inScope = cohorts.filter((c) => cohortIds.includes(c.id))
  const held = inScope.reduce((n, c) => n + c.sessionsHeld, 0)
  const missing = inScope.reduce((n, c) => n + c.sessionsMissingAttendance, 0)
  inScope
    .filter((c) => c.sessionsMissingAttendance > 0)
    .forEach((c) => {
      const all = c.sessionsMissingAttendance >= c.sessionsHeld
      issues.push({
        id: `att-${c.id}`,
        severity: all ? 'critical' : 'warning',
        title: all ? `No attendance recorded for ${c.name}` : `Attendance missing for ${c.sessionsMissingAttendance} of ${c.sessionsHeld} sessions in ${c.name}`,
        detail: all
          ? `${c.sessionsHeld} sessions were held but none were marked, so this cohort’s attendance, completion and feedback read as zero.`
          : 'People in these sessions count as absent, so attendance and completion are understated.',
        fix: { label: 'Take attendance', page: 'interventions' },
      })
    })

  /* ---- Feedback response rate ---- */
  const attended = rows.filter((f) => f.attended).length
  const responded = rows.filter((f) => f.responded).length
  const rate = pct(responded, attended)
  if (attended > 0 && rate != null && rate < RESPONSE_RATE_FLOOR) {
    issues.push({
      id: 'feedback-rate',
      severity: 'warning',
      title: `Feedback response rate is ${rate}%`,
      detail: `Below the ${RESPONSE_RATE_FLOOR}% the dashboard treats as reliable, so feedback results may not represent everyone who attended.`,
      fix: { label: 'Chase feedback', page: 'feedback' },
    })
  }

  /* ---- Demographic completeness (people counted once) ---- */
  const byPerson = new Map<number, Fact>()
  rows.forEach((f) => byPerson.set(f.pid, f))
  const people = [...byPerson.values()]
  const blank = (get: (f: Fact) => string) => people.filter((f) => get(f) === 'Not given').length
  const demo: { key: string; label: string; get: (f: Fact) => string }[] = [
    { key: 'gender', label: 'Gender', get: (f) => f.gender },
    { key: 'disability', label: 'Disability', get: (f) => f.disability },
    { key: 'humanitarian', label: 'Humanitarian status', get: (f) => f.humanitarian },
  ]
  demo.forEach((d) => {
    const n = blank(d.get)
    const share = pct(n, people.length)
    if (n && share != null) {
      issues.push({
        id: `demo-${d.key}`,
        severity: share > 10 ? 'warning' : 'info',
        title: `${d.label} not recorded for ${share}% of people`,
        detail: `${d.label} breakdowns leave these people out, so they may not add up to the total.`,
        fix: { label: 'Review records', page: 'participants' },
      })
    }
  })

  /* ---- Cohorts still running ---- */
  const live = inScope.filter((c) => c.status !== 'completed')
  if (live.length) {
    issues.push({
      id: 'live-cohorts',
      severity: 'info',
      title: `${live.length} ${live.length === 1 ? 'cohort is' : 'cohorts are'} still running`,
      detail: `${live.map((c) => c.name).join(', ')}. Their numbers will change until they finish; finalising freezes them as they are today.`,
    })
  }

  /* ---- Venture Registry (VEN-01..11), counted per rule: no venture or founder is named ---- */
  const ventureCompleteness: Completeness[] = []
  let ventureCount: number | undefined
  if (ventureCodes.length) {
    const asOf = report.period.end > REPORTING_DATE ? REPORTING_DATE : report.period.end
    const d = getRegistry()
    const found = runVentureChecks(d, asOf)
    DQ_RULES.forEach((r) => {
      const n = new Set(found.filter((f) => f.rule === r.rule).map((f) => f.ventureId)).size
      if (!n) return
      issues.push({
        id: `ven-${r.rule}`,
        severity: r.severity,
        title: `${r.rule} · ${n} ${n === 1 ? 'venture' : 'ventures'}: ${r.check.charAt(0).toLowerCase()}${r.check.slice(1)}`,
        detail:
          r.severity === 'critical'
            ? 'These records make the venture numbers wrong. Fix them in the Venture Registry before finalising.'
            : 'The venture numbers may be off. Check these records in the Venture Registry; the issue goes in the data notes.',
        fix: { label: 'Open Venture Registry', page: 'ventures' },
      })
    })
    const vrows = ventureLatest(d, asOf)
    const yearAgo = `${Number(asOf.slice(0, 4)) - 1}${asOf.slice(4)}`
    const active = vrows.filter((v) => v.active)
    const current = active.filter((v) => v.latestAsOf >= yearAgo).length
    ventureCount = vrows.length
    ventureCompleteness.push(
      { key: 'venture-updates', label: 'Venture updates (last 12 months)', pct: pct(current, active.length), detail: `${current} of ${active.length} active ventures` },
      { key: 'venture-revenue', label: 'Revenue reported', pct: pct(vrows.filter((v) => v.revenueUsd != null).length, vrows.length), detail: `${vrows.filter((v) => v.revenueUsd != null).length} of ${vrows.length} ventures` },
    )
  }

  if (!ventureOnly && !rows.length && !issues.some((i) => i.id === 'access')) {
    issues.push({ id: 'empty', severity: 'warning', title: 'No data for this scope and period', detail: 'Every number in the report will be empty. Check the pillars, interventions and dates in step 2.' })
  }

  /* ---- Content ---- */
  const blocks = report.blocks ?? []
  const sections = report.sections ?? []
  blocks
    .filter((b) => b.type === 'text')
    .forEach((b) => {
      const html = b.settings.html ?? ''
      const sec = sections.find((s) => s.id === b.sectionId)?.title ?? 'A text block'
      if (STARTER_LINES.some((line) => html.includes(line))) {
        issues.push({ id: `starter-${b.id}`, severity: 'warning', title: `“${sec}” still has template text`, detail: 'Replace the starter sentence with your own words before finalising.', fix: { label: 'Edit content', step: 4 } })
      }
      const unknown = html.match(/\{\{\s*[a-z_.]+\s*\}\}/gi)?.filter((t) => !KNOWN_TOKENS.has(t.replace(/[{}\s]/g, '').toLowerCase()))
      if (unknown?.length) {
        issues.push({ id: `unknown-${b.id}`, severity: 'warning', title: `Unknown placeholder in “${sec}”`, detail: `${unknown.join(', ')} isn’t a number the report can fill. Use “Insert number” to pick one.`, fix: { label: 'Edit content', step: 4 } })
      }
    })
  sections
    .filter((s) => !blocks.some((b) => b.sectionId === s.id))
    .forEach((s) => issues.push({ id: `empty-${s.id}`, severity: 'info', title: `“${s.title}” is empty`, detail: 'It will print as a heading with no content.', fix: { label: 'Edit content', step: 4 } }))

  /* ---- Suppression, from the report's own answers ---- */
  let suppressed = 0
  if (answers) {
    Object.values(answers).forEach((a) => {
      if ('result' in a) suppressed += (a.result.suppressed ? 1 : 0) + (a.result.rows?.filter((r) => r.suppressed).length ?? 0)
    })
    if (suppressed) {
      issues.push({
        id: 'suppressed',
        severity: 'info',
        title: `${suppressed} ${suppressed === 1 ? 'value is' : 'values are'} hidden to protect small groups`,
        detail: `Counts under ${report.audience === 'internal' ? 5 : 10} ${ventureOnly ? 'ventures' : 'people'} are shown as “<${report.audience === 'internal' ? 5 : 10}”. This is expected and is explained in the methodology.`,
      })
    }
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }
  issues.sort((a, b) => order[a.severity] - order[b.severity])

  const completeness: Completeness[] = ventureOnly ? ventureCompleteness : [
    ...ventureCompleteness,
    { key: 'attendance', label: 'Attendance records', pct: pct(held - missing, held), detail: held ? `${held - missing} of ${held} sessions marked` : 'No sessions held' },
    { key: 'feedback', label: 'Feedback', pct: rate, detail: attended ? `${responded} of ${attended} who attended` : 'Nobody attended yet' },
    ...demo.map((d) => ({ key: d.key, label: d.label, pct: pct(people.length - blank(d.get), people.length), detail: `${people.length - blank(d.get)} of ${people.length} people` })),
  ]

  return {
    completeness,
    issues,
    counts: { critical: issues.filter((i) => i.severity === 'critical').length, warning: issues.filter((i) => i.severity === 'warning').length, info: issues.filter((i) => i.severity === 'info').length },
    suppressed,
    people: people.length,
    ventures: ventureCount,
    checkedAt: new Date().toISOString(),
  }
}
