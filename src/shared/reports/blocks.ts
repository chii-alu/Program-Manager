/**
 * Report blocks (REPORT-TOOL-SPEC §3 step 4, §4): defaults from templates, the block library,
 * each block's effective scope and period, and text placeholders.
 *
 * Nothing here computes a number itself: blocks and placeholders ask getMetric, so they get
 * the same permissions and small-number suppression as everything else.
 */
import { getMetric, DIMENSIONS } from './metrics'
import { indicatorByCode } from './indicators'
import { PRESETS, comparisonPeriod, fmtRange, presetPeriod, type PresetId } from './periods'
import { templateById } from './templates'
import type { BlockKind, BlockSettings, Dimension, MetricRequest, MetricResult, Period, Report, ReportBlock, ReportSection, Scope, TextRole, Viewer } from './types'

let seq = 0
export const blockId = () => `b-${Date.now().toString(36)}-${(seq++).toString(36)}`
export const sectionId = () => `s-${Date.now().toString(36)}-${(seq++).toString(36)}`

/* ---------- Text sections ---------- */

export const TEXT_ROLES: Record<TextRole, { label: string; starter: string }> = {
  executive_summary: {
    label: 'Executive summary',
    starter:
      '<p>In {{period.label}}, CHII reached <strong>{{reach.unique_people}}</strong> people across {{participation.cohorts}} cohorts. Attendance was {{attendance.rate}} and the Net Promoter Score was {{nps}}.</p><p>Summarise the period’s main results here.</p>',
  },
  highlights: { label: 'Highlights', starter: '<ul><li>Write the period’s main achievements here.</li></ul>' },
  challenges: { label: 'Challenges', starter: '<p>Describe what got in the way this period, and what was done about it.</p>' },
  lessons: { label: 'Lessons learned', starter: '<p>What would the team do differently next time?</p>' },
  recommendations: { label: 'Recommendations', starter: '<ol><li>Write a recommendation.</li></ol>' },
  next_steps: { label: 'Next steps', starter: '<p>List what happens next, who owns it and by when.</p>' },
  free: { label: 'Text', starter: '<p>Write here. Type {{ to insert a live number.</p>' },
}

/* ---------- Placeholders ---------- */

/** Tokens authors can type as {{token}}. Metric tokens use getMetric; the rest describe the report. */
export const PLACEHOLDERS: { token: string; label: string; metric?: string }[] = [
  { token: 'period.label', label: 'Period name' },
  { token: 'period.range', label: 'Period dates' },
  { token: 'comparison.label', label: 'Comparison period' },
  { token: 'scope.pillars', label: 'Pillars' },
  { token: 'reach.unique_people', label: 'People reached', metric: 'reach.unique_people' },
  { token: 'reach.new_people', label: 'New people', metric: 'reach.new_people' },
  { token: 'intake.registrations', label: 'Registrations', metric: 'intake.registrations' },
  { token: 'participation.cohorts', label: 'Cohorts run', metric: 'participation.cohorts' },
  { token: 'attendance.rate', label: 'Attendance rate', metric: 'attendance.rate' },
  { token: 'completion.rate', label: 'Completion rate', metric: 'completion.rate' },
  { token: 'feedback.response_rate', label: 'Response rate', metric: 'feedback.response_rate' },
  { token: 'nps', label: 'Net Promoter Score', metric: 'feedback.nps' },
  { token: 'outcomes.placements', label: 'Placements', metric: 'outcomes.placements' },
]

/**
 * Replace {{tokens}} with live values. Unknown tokens stay visible (marked) so the author
 * notices a typo instead of a number silently disappearing.
 */
export function fillPlaceholders(
  html: string,
  report: Pick<Report, 'scope' | 'period' | 'dateRule' | 'comparison' | 'audience'>,
  viewer: Viewer,
  /** Where numbers come from: live by default; recorded/replayed when finalising (source.tsx). */
  ask: (req: MetricRequest) => MetricResult = (req) => getMetric(viewer, req),
): string {
  return html.replace(/\{\{\s*([a-z_.]+)\s*\}\}/gi, (whole, raw: string) => {
    const token = raw.toLowerCase()
    const p = PLACEHOLDERS.find((x) => x.token === token) ?? PLACEHOLDERS.find((x) => x.metric === token)
    if (!p) return `<mark data-unknown title="Unknown placeholder">${whole}</mark>`
    if (token === 'period.label') return esc(report.period.label)
    if (token === 'period.range') return esc(fmtRange(report.period.start, report.period.end))
    if (token === 'comparison.label') return esc(report.comparison === 'none' ? 'no comparison' : comparisonPeriod(report.period, report.comparison).label)
    if (token === 'scope.pillars') return esc(report.scope.pillars.join(', '))
    try {
      return esc(ask({ code: p.metric!, scope: report.scope, period: report.period, dateRule: report.dateRule, comparison: 'none', audience: report.audience }).display)
    } catch {
      return '<mark data-unknown title="Not available for this scope">n/a</mark>'
    }
  })
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/* ---------- A block's effective scope and period ---------- */

export type BlockContext = { scope: Scope; period: Period; overridden: boolean; note: string | null }

/**
 * Overrides can only narrow the report (spec §3): a different period, or fewer interventions
 * from inside the report's own scope. getMetric still checks permissions either way.
 */
export function blockContext(report: Pick<Report, 'scope' | 'period'>, s: BlockSettings): BlockContext {
  const notes: string[] = []
  let period = report.period
  let scope = report.scope
  if (s.overridePreset) {
    period = presetPeriod(s.overridePreset)
    notes.push(period.label)
  }
  if (s.overrideInterventions?.length) {
    scope = { ...report.scope, interventions: s.overrideInterventions }
    notes.push(`${s.overrideInterventions.join(', ')} only`)
  }
  return { scope, period, overridden: notes.length > 0, note: notes.length ? `This block uses ${notes.join(' · ')}.` : null }
}

/* ---------- The block library (what authors can add) ---------- */

export type LibraryItem = { key: string; group: 'Headline numbers' | 'Charts' | 'Tables' | 'Text'; label: string; body: string; type: BlockKind; settings: BlockSettings }

export const LIBRARY: LibraryItem[] = [
  { key: 'kpi', group: 'Headline numbers', label: 'KPI tile', body: 'One number, with the comparison and an optional target.', type: 'kpi', settings: { metric: 'reach.unique_people', showComparison: true } },
  { key: 'funnel', group: 'Charts', label: 'Funnel', body: 'Registered → attended → completed → gave feedback.', type: 'chart', settings: { chart: 'funnel' } },
  { key: 'bar', group: 'Charts', label: 'Bar chart', body: 'Any metric by intervention, cohort, pillar or a demographic.', type: 'chart', settings: { chart: 'bar', metric: 'reach.unique_people', breakdown: 'intervention', sort: 'value_desc', topN: null } },
  { key: 'trend', group: 'Charts', label: 'Trend over time', body: 'A metric month by month or quarter by quarter.', type: 'chart', settings: { chart: 'trend', metric: 'reach.unique_people', breakdown: 'month' } },
  { key: 'donut', group: 'Charts', label: 'Donut', body: 'Share of people by gender, age group, type…', type: 'chart', settings: { chart: 'donut', metric: 'reach.unique_people', breakdown: 'gender' } },
  { key: 'feedback_items', group: 'Charts', label: 'Feedback ratings', body: 'Average of each core feedback item, 1–5.', type: 'chart', settings: { chart: 'feedback_items' } },
  { key: 'intervention_summary', group: 'Tables', label: 'Intervention summary', body: 'One row per intervention: reach, attendance, completion, feedback, NPS.', type: 'table', settings: { table: 'intervention_summary' } },
  { key: 'cohort_summary', group: 'Tables', label: 'Cohort summary', body: 'One row per cohort, with the same measures.', type: 'table', settings: { table: 'cohort_summary' } },
  { key: 'breakdown', group: 'Tables', label: 'Breakdown table', body: 'Any metric by any breakdown, with the % of total.', type: 'table', settings: { table: 'breakdown', metric: 'reach.unique_people', breakdown: 'age_group', sort: 'value_desc', topN: null } },
  ...(Object.keys(TEXT_ROLES) as TextRole[]).map(
    (role): LibraryItem => ({ key: `text-${role}`, group: 'Text', label: TEXT_ROLES[role].label, body: role === 'free' ? 'A free text section.' : 'Rich text with live numbers.', type: 'text', settings: { textRole: role, html: TEXT_ROLES[role].starter } }),
  ),
]

export function newBlock(item: LibraryItem, sectionIdValue: string): ReportBlock {
  return { id: blockId(), sectionId: sectionIdValue, type: item.type, settings: structuredClone(item.settings), caption: '' }
}

/* ---------- Template defaults ---------- */

const KPI_SETS: Record<string, string[]> = {
  default: ['reach.unique_people', 'attendance.rate', 'completion.rate', 'feedback.nps'],
  response: ['feedback.responded', 'feedback.response_rate'],
  dq: ['reach.unique_people', 'feedback.response_rate', 'attendance.rate'],
}

function textRoleFor(title: string): TextRole {
  const t = title.toLowerCase()
  if (t.includes('summary') || t.includes('about')) return 'executive_summary'
  if (t.includes('highlight') || t.includes('stories')) return 'highlights'
  if (t.includes('challenge')) return 'challenges'
  if (t.includes('lesson')) return 'lessons'
  if (t.includes('recommend')) return 'recommendations'
  if (t.includes('next')) return 'next_steps'
  return 'free'
}

/** Concrete chart/table settings for a template section, so a new report is useful at once. */
function chartFor(title: string, i: number): BlockSettings {
  const t = title.toLowerCase()
  if (t.includes('funnel') || t.includes('intake') || t.includes('progress')) return { chart: 'funnel' }
  if (t.includes('feedback')) return i === 0 ? { chart: 'feedback_items' } : { chart: 'bar', metric: 'feedback.nps', breakdown: 'intervention', sort: 'value_desc', topN: null }
  if (t.includes('who') || t.includes('inclusion')) return i === 0 ? { chart: 'donut', metric: 'reach.unique_people', breakdown: 'gender' } : { chart: 'bar', metric: 'reach.unique_people', breakdown: 'age_group', sort: 'label', topN: null }
  if (t.includes('pillar')) return { chart: 'bar', metric: 'reach.unique_people', breakdown: 'pillar', sort: 'value_desc', topN: null }
  if (t.includes('attendance')) return { chart: 'bar', metric: 'attendance.rate', breakdown: 'cohort', sort: 'label', topN: null }
  if (t.includes('outcome')) return { chart: 'bar', metric: 'outcomes.jobs', breakdown: 'intervention', sort: 'value_desc', topN: null }
  if (t.includes('completeness')) return { chart: 'bar', metric: 'feedback.response_rate', breakdown: 'pillar', sort: 'value_desc', topN: null }
  return { chart: 'bar', metric: 'reach.unique_people', breakdown: 'intervention', sort: 'value_desc', topN: 8 }
}

function tableFor(title: string): BlockSettings {
  const t = title.toLowerCase()
  if (t.includes('attendance')) return { table: 'cohort_summary' }
  if (t.includes('outcome')) return { table: 'breakdown', metric: 'outcomes.placements', breakdown: 'intervention', sort: 'value_desc', topN: null }
  return { table: 'intervention_summary' }
}

/** Sections and blocks for a new report. Blank reports start with one free text section. */
export function defaultContent(templateId: string | null): { sections: ReportSection[]; blocks: ReportBlock[] } {
  const t = templateById(templateId)
  if (!t) {
    const s: ReportSection = { id: sectionId(), title: 'Summary' }
    return { sections: [s], blocks: [{ id: blockId(), sectionId: s.id, type: 'text', settings: { textRole: 'executive_summary', html: TEXT_ROLES.executive_summary.starter }, caption: '' }] }
  }
  const sections: ReportSection[] = []
  const blocks: ReportBlock[] = []
  t.sections.forEach((sec) => {
    const s: ReportSection = { id: sectionId(), title: sec.title, required: sec.required, locked: sec.locked }
    sections.push(s)
    const kpiSet = sec.title === 'Response' ? KPI_SETS.response : t.id === 'tpl-data-quality' ? KPI_SETS.dq : KPI_SETS.default
    let k = 0
    let c = 0
    sec.blocks.forEach((kind) => {
      const settings: BlockSettings =
        kind === 'kpi'
          ? { metric: kpiSet[k++ % kpiSet.length], showComparison: true }
          : kind === 'chart'
            ? chartFor(sec.title, c++)
            : kind === 'table'
              ? tableFor(sec.title)
              : { textRole: textRoleFor(sec.title), html: TEXT_ROLES[textRoleFor(sec.title)].starter }
      blocks.push({ id: blockId(), sectionId: s.id, type: kind, settings, caption: '' })
    })
  })
  return { sections, blocks }
}

/* ---------- Labels ---------- */

export function blockTitle(b: ReportBlock): string {
  const s = b.settings
  const m = s.metric ? indicatorByCode.get(s.metric)?.name ?? s.metric : ''
  const by = s.breakdown ? DIMENSIONS[s.breakdown as Dimension]?.label.toLowerCase() : ''
  if (b.type === 'kpi') return m
  if (b.type === 'text') return TEXT_ROLES[s.textRole ?? 'free'].label
  if (b.type === 'table') return s.table === 'intervention_summary' ? 'Intervention summary' : s.table === 'cohort_summary' ? 'Cohort summary' : `${m} by ${by}`
  if (s.chart === 'funnel') return 'From registration to feedback'
  if (s.chart === 'feedback_items') return 'Feedback ratings'
  if (s.chart === 'trend') return `${m} over time`
  return `${m} by ${by}`
}

export const OVERRIDE_PRESETS = PRESETS.filter((p) => p.id !== 'custom') as { id: Exclude<PresetId, 'custom'>; label: string }[]

/** Indicator codes a report uses, for the methodology appendix. */
export function metricsUsed(blocks: ReportBlock[]): string[] {
  const codes = new Set<string>()
  blocks.forEach((b) => {
    const s = b.settings
    if (s.metric) codes.add(s.metric)
    if (s.chart === 'funnel') ['intake.registrations', 'participation.attended', 'participation.completed', 'feedback.responded'].forEach((c) => codes.add(c))
    if (s.chart === 'feedback_items') [...indicatorByCode.keys()].filter((c) => c.startsWith('feedback.item.')).forEach((c) => codes.add(c))
    if (s.table === 'intervention_summary' || s.table === 'cohort_summary') ['reach.unique_people', 'attendance.rate', 'completion.rate', 'feedback.response_rate', 'feedback.nps'].forEach((c) => codes.add(c))
    if (b.type === 'text' && s.html) PLACEHOLDERS.forEach((p) => p.metric && s.html!.includes(`{{${p.token}}}`) && codes.add(p.metric))
  })
  return [...codes].filter((c) => indicatorByCode.has(c))
}
