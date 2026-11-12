/**
 * The indicator dictionary (REPORT-TOOL-SPEC §4: "metrics.indicator").
 *
 * Every number a report shows is one of these indicators, computed over the fact table by
 * getMetric. The definition text is what the methodology appendix prints, so it is written
 * for readers, not developers. Definitions follow the existing dashboard views:
 *   eligible = registered (open) or selected (selective)
 *   attendance rate = attended at least once ÷ eligible
 *   response rate = feedback responses ÷ attended
 */
import { VENTURE_INDICATORS } from '../ventures/metrics'
import { FEEDBACK_ITEMS, type Fact } from './facts'
import type { DateRule, Dimension, Period, Unit, VentureDimension } from './types'

export const VENTURE_DIMS: VentureDimension[] = ['venture_stage', 'venture_status', 'venture_intake_year', 'venture_country', 'venture_region', 'venture_sector', 'venture_track']

export type Computed = { value: number | null; n: number }

export type Indicator = {
  code: string
  name: string
  group: 'Reach' | 'Intake' | 'Participation' | 'Feedback' | 'Outcomes' | 'Ventures'
  /**
   * Where the number comes from. 'registry' indicators are computed by the Venture Registry's
   * analyse() (ventures/metrics.ts), so reports, Venture Analytics and the dashboard share one
   * definition. Their `compute` is never called.
   */
  source?: 'facts' | 'registry'
  definition: string
  unit: Unit
  version: number
  /** Counts of people or things add up across a breakdown; rates and averages don't. */
  additive: boolean
  /** Higher is better (for ▲▼ colouring); false for e.g. drop-outs. */
  higherIsBetter: boolean
  /**
   * Whether the number counts people (and so needs small-number suppression). Counts of
   * cohorts or sessions identify nobody and are always shown. Defaults to true.
   */
  aboutPeople?: boolean
  dateRules: DateRule[]
  defaultDateRule: DateRule
  breakdowns: Dimension[]
  compute: (rows: Fact[], period: Period) => Computed
}

/* ---------- Building blocks ---------- */

const distinct = (rows: Fact[], pred: (f: Fact) => boolean = () => true) => new Set(rows.filter(pred).map((f) => f.pid)).size
const count = (rows: Fact[], pred: (f: Fact) => boolean) => rows.filter(pred).length
const pctOf = (num: number, den: number): Computed => ({ value: den ? Math.round((num / den) * 1000) / 10 : null, n: den })
const mean = (xs: number[]): Computed => ({ value: xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null, n: xs.length })

const ALL_DIMS: Dimension[] = ['pillar', 'intervention', 'cohort', 'gender', 'age_group', 'nationality', 'residence', 'disability', 'humanitarian', 'beneficiary_type', 'month', 'quarter']
const STRUCTURE: Dimension[] = ['pillar', 'intervention', 'cohort', 'month', 'quarter']
const PEOPLE_RULES: DateRule[] = ['session', 'registration']
const ANY_RULE: DateRule[] = ['session', 'registration', 'response']

const people = (code: string, name: string, group: Indicator['group'], definition: string, pred: (f: Fact) => boolean, extra: Partial<Indicator> = {}): Indicator => ({
  code,
  name,
  group,
  definition,
  unit: 'people',
  version: 1,
  additive: true,
  higherIsBetter: true,
  dateRules: PEOPLE_RULES,
  defaultDateRule: 'session',
  breakdowns: ALL_DIMS,
  compute: (rows) => {
    const v = distinct(rows, pred)
    return { value: v, n: v }
  },
  ...extra,
})

/* ---------- The dictionary ---------- */

export const INDICATORS: Indicator[] = [
  // Reach
  people('reach.unique_people', 'People reached', 'Reach', 'Unique people (counted once by CHII ID) with at least one registration, application or attendance in the scope and period.', () => true),
  {
    ...people('reach.new_people', 'New people', 'Reach', 'People reached in the period whose first-ever CHII registration falls inside the period.', () => true),
    compute: (rows, p) => {
      const v = distinct(rows, (f) => f.firstRegisteredOn >= p.start && f.firstRegisteredOn <= p.end)
      return { value: v, n: v }
    },
  },
  {
    ...people('reach.returning_people', 'Returning people', 'Reach', 'People reached in the period who had registered for a CHII intervention before the period started.', () => true),
    compute: (rows, p) => {
      const v = distinct(rows, (f) => f.firstRegisteredOn < p.start)
      return { value: v, n: v }
    },
  },

  // Intake
  people('intake.registrations', 'Registrations', 'Intake', 'Unique people who registered for, or were accepted onto, an intervention in scope.', (f) => f.eligible || f.applied, { defaultDateRule: 'registration' }),
  people('intake.applications', 'Applications', 'Intake', 'Unique people who applied to a selective intervention (SIE, Internships, Fellowships…).', (f) => f.applied, { defaultDateRule: 'registration' }),
  people('intake.selected', 'Selected', 'Intake', 'Unique applicants selected onto a selective intervention.', (f) => f.selected, { defaultDateRule: 'registration' }),
  people('intake.waitlisted', 'Waitlisted', 'Intake', 'Unique applicants placed on a waitlist and not selected.', (f) => f.waitlisted, { defaultDateRule: 'registration' }),
  {
    code: 'intake.selection_rate',
    name: 'Selection rate',
    group: 'Intake',
    definition: 'Selected applications ÷ all applications, for selective interventions.',
    unit: 'rate',
    version: 1,
    additive: false,
    higherIsBetter: true,
    dateRules: PEOPLE_RULES,
    defaultDateRule: 'registration',
    breakdowns: ALL_DIMS,
    compute: (rows) => pctOf(count(rows, (f) => f.selected), count(rows, (f) => f.applied)),
  },

  // Participation
  {
    code: 'participation.cohorts',
    name: 'Cohorts run',
    group: 'Participation',
    definition: 'Cohorts (or one-off session groups) with at least one participant, that started in the period.',
    unit: 'count',
    version: 1,
    additive: true,
    higherIsBetter: true,
    aboutPeople: false,
    dateRules: ['session'],
    defaultDateRule: 'session',
    breakdowns: STRUCTURE,
    compute: (rows) => {
      const v = new Set(rows.map((f) => f.cohortId)).size
      return { value: v, n: v }
    },
  },
  {
    code: 'participation.sessions_held',
    name: 'Sessions held',
    group: 'Participation',
    definition: 'Meetings that have taken place across the cohorts in scope (each cohort counted once).',
    unit: 'count',
    version: 1,
    additive: true,
    higherIsBetter: true,
    aboutPeople: false,
    dateRules: ['session'],
    defaultDateRule: 'session',
    breakdowns: STRUCTURE,
    compute: (rows) => {
      const by = new Map<string, number>()
      rows.forEach((f) => by.set(f.cohortId, f.sessionsHeld))
      const v = [...by.values()].reduce((a, b) => a + b, 0)
      return { value: v, n: by.size }
    },
  },
  people('participation.attended', 'Attended', 'Participation', 'Unique people who attended at least one session.', (f) => f.attended),
  people('participation.completed', 'Completed', 'Participation', 'Unique people who attended at least 75% of a finished cohort’s sessions.', (f) => f.completed),
  people('feedback.responded', 'Gave feedback', 'Feedback', 'Unique people who submitted a feedback form.', (f) => f.responded),
  {
    code: 'attendance.rate',
    name: 'Attendance rate',
    group: 'Participation',
    definition: 'People who attended at least one session ÷ people eligible to attend (registered for open interventions, selected for selective ones).',
    unit: 'rate',
    version: 1,
    additive: false,
    higherIsBetter: true,
    dateRules: PEOPLE_RULES,
    defaultDateRule: 'session',
    breakdowns: ALL_DIMS,
    compute: (rows) => pctOf(count(rows, (f) => f.attended), count(rows, (f) => f.eligible && f.sessionsHeld > 0)),
  },
  {
    code: 'completion.rate',
    name: 'Completion rate',
    group: 'Participation',
    definition: 'People who attended at least 75% of a finished cohort’s sessions ÷ people who attended that cohort.',
    unit: 'rate',
    version: 1,
    additive: false,
    higherIsBetter: true,
    dateRules: PEOPLE_RULES,
    defaultDateRule: 'session',
    breakdowns: ALL_DIMS,
    compute: (rows) => pctOf(count(rows, (f) => f.completed), count(rows, (f) => f.attended && f.cohortStatus === 'completed')),
  },
  {
    code: 'participation.avg_sessions',
    name: 'Average sessions attended',
    group: 'Participation',
    definition: 'Mean number of sessions attended per participant, among people who attended at least once.',
    unit: 'average',
    version: 1,
    additive: false,
    higherIsBetter: true,
    dateRules: PEOPLE_RULES,
    defaultDateRule: 'session',
    breakdowns: ALL_DIMS,
    compute: (rows) => mean(rows.filter((f) => f.attended).map((f) => f.sessionsAttended)),
  },

  // Feedback
  {
    code: 'feedback.response_rate',
    name: 'Feedback response rate',
    group: 'Feedback',
    definition: 'Feedback responses ÷ people who attended. One response per person per cohort.',
    unit: 'rate',
    version: 1,
    additive: false,
    higherIsBetter: true,
    dateRules: PEOPLE_RULES,
    defaultDateRule: 'session',
    breakdowns: ALL_DIMS,
    compute: (rows) => pctOf(count(rows, (f) => f.responded), count(rows, (f) => f.attended)),
  },
  {
    code: 'feedback.nps',
    name: 'Net Promoter Score',
    group: 'Feedback',
    definition: '% of respondents scoring 9–10 minus % scoring 0–6 on “How likely are you to recommend this?”. Ranges from −100 to +100.',
    unit: 'nps',
    version: 1,
    additive: false,
    higherIsBetter: true,
    dateRules: ANY_RULE,
    defaultDateRule: 'response',
    breakdowns: ALL_DIMS,
    compute: (rows) => {
      const r = rows.filter((f) => f.nps != null)
      if (!r.length) return { value: null, n: 0 }
      const pro = r.filter((f) => f.nps! >= 9).length
      const det = r.filter((f) => f.nps! <= 6).length
      return { value: Math.round(((pro - det) / r.length) * 100), n: r.length }
    },
  },
  ...FEEDBACK_ITEMS.map(
    (it): Indicator => ({
      code: `feedback.item.${it.key}`,
      name: `${it.label} (average)`,
      group: 'Feedback',
      definition: `Average answer to the core feedback item “${it.label}”, on a 1–5 scale.`,
      unit: 'score',
      version: 1,
      additive: false,
      higherIsBetter: true,
      dateRules: ANY_RULE,
      defaultDateRule: 'response',
      breakdowns: ALL_DIMS,
      compute: (rows) => mean(rows.filter((f) => f.items).map((f) => f.items![it.key])),
    }),
  ),

  // Outcomes
  people('outcomes.placements', 'Placements', 'Outcomes', 'People who completed an internship cohort and were placed with a host organisation.', (f) => f.placed),
  people('outcomes.jobs', 'Jobs', 'Outcomes', 'People who reported a job after completing an employment-pathway intervention.', (f) => f.job),
  people('outcomes.further_study', 'Further study', 'Outcomes', 'People who reported enrolling in further study after completing an intervention.', (f) => f.furtherStudy),
  people('outcomes.ventures_started', 'Ventures started', 'Outcomes', 'People who reported starting a venture after a Hackathon or Mentorship cohort.', (f) => f.ventureStarted),
  people('outcomes.funding_awards', 'Funding awards', 'Outcomes', 'Ventures awarded funding through Venture Funding (one per founder).', (f) => f.fundingAmount != null),
  {
    code: 'outcomes.funding_amount',
    name: 'Funding awarded (USD)',
    group: 'Outcomes',
    definition: 'Total value of Venture Funding awards, in US dollars.',
    unit: 'amount',
    version: 1,
    additive: true,
    higherIsBetter: true,
    dateRules: PEOPLE_RULES,
    defaultDateRule: 'session',
    breakdowns: STRUCTURE,
    compute: (rows) => {
      const awards = rows.filter((f) => f.fundingAmount != null)
      return { value: awards.reduce((a, f) => a + f.fundingAmount!, 0), n: awards.length }
    },
  },

  // Ventures (HENT Venture Registry). Same codes and definitions as Venture Analytics.
  ...VENTURE_INDICATORS.map((v): Indicator => {
    const unit = ({ count: 'count', usd: 'amount', percent: 'rate', number: 'average' } as const)[v.unit]
    const isTotal = (v.unit === 'count' || v.unit === 'usd') && !/median|avg/.test(v.code)
    return {
      code: v.code,
      name: v.name,
      group: 'Ventures',
      definition: v.definition,
      unit,
      version: 1,
      additive: isTotal,
      higherIsBetter: true,
      dateRules: ['session', 'registration', 'response'],
      defaultDateRule: 'session',
      breakdowns: VENTURE_DIMS,
      source: 'registry',
      compute: () => ({ value: null, n: 0 }),
    }
  }),
]

export const indicatorByCode = new Map(INDICATORS.map((i) => [i.code, i]))
