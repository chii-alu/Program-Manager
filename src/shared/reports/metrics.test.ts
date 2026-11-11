import { describe, expect, it } from 'vitest'
import { facts } from './facts'
import { INDICATORS } from './indicators'
import { MetricAccessError, MetricPolicyError, getMetric, suppress, viewerFor } from './metrics'
import { comparisonPeriod, customPeriod, presetPeriod } from './periods'
import type { MetricCell, MetricRequest, Scope } from './types'

const admin = viewerFor('admin', [])
const hempLead = viewerFor('pillar_lead', ['HEMP'])
const nobody = viewerFor('none', [])

const scope = (s: Partial<Scope>): Scope => ({ pillars: ['HEMP'], interventions: [], cohorts: [], filters: {}, ...s })
const year = presetPeriod('this_year')
const req = (r: Partial<MetricRequest>): MetricRequest => ({
  code: 'reach.unique_people',
  scope: scope({}),
  period: year,
  dateRule: 'session',
  audience: 'internal',
  ...r,
})
const cell = (key: string, value: number): MetricCell => ({ key, label: key, value, display: String(value), pct: null, n: value, suppressed: false })

describe('permissions (spec §2, §12)', () => {
  it('a HEMP lead cannot report on HENT', () => {
    expect(() => getMetric(hempLead, req({ scope: scope({ pillars: ['HENT'] }) }))).toThrow(MetricAccessError)
  })
  it('a HEMP lead cannot slip a HENT intervention into a HEMP scope', () => {
    expect(() => getMetric(hempLead, req({ scope: scope({ interventions: ['Masterclass'] }) }))).toThrow(MetricAccessError)
  })
  it('a HEMP lead can report on HEMP', () => {
    const r = getMetric(hempLead, req({}))
    expect(r.value).toBeGreaterThan(0)
  })
  it('an account with no staff role gets nothing', () => {
    expect(() => getMetric(nobody, req({}))).toThrow(MetricAccessError)
  })
  it('an admin can report on every pillar', () => {
    expect(getMetric(admin, req({ scope: scope({ pillars: ['HENT', 'HEMP', 'HECO'] }) })).value).toBeGreaterThan(0)
  })
})

describe('privacy (spec §8)', () => {
  it('identity fields can never be requested as a breakdown', () => {
    for (const field of ['name', 'email', 'phone', 'student_id', 'chii_id']) {
      expect(() => getMetric(admin, req({ breakdown: field as never }))).toThrow(MetricPolicyError)
    }
  })
  it('the fact table holds no identity data', () => {
    const banned = ['name', 'email', 'phone', 'studentId', 'student_id', 'chiiId', 'chii_id', 'id']
    for (const f of facts) {
      for (const k of banned) expect(f).not.toHaveProperty(k)
      for (const v of Object.values(f)) {
        if (typeof v === 'string') {
          expect(v).not.toMatch(/CHII-\d{6}/)
          expect(v).not.toContain('@')
        }
      }
    }
  })
  it('sensitive breakdowns are refused in Public reports', () => {
    expect(() => getMetric(admin, req({ audience: 'public', breakdown: 'disability' }))).toThrow(MetricPolicyError)
    expect(() => getMetric(hempLead, req({ audience: 'public', breakdown: 'humanitarian' }))).toThrow(MetricPolicyError)
  })
  it('a MELA admin can switch sensitive breakdowns on for Public reports', () => {
    const r = getMetric({ ...admin, allowSensitive: true }, req({ audience: 'public', breakdown: 'disability' }))
    expect(r.rows?.length).toBeGreaterThan(0)
  })
  it('sensitive breakdowns are allowed in Internal reports', () => {
    expect(getMetric(hempLead, req({ breakdown: 'disability' })).rows?.length).toBeGreaterThan(0)
  })
})

describe('small-number suppression (spec §8, §12)', () => {
  it('a category of 3 people shows "<5" and the total does not reveal it', () => {
    const out = suppress([cell('A', 20), cell('B', 15), cell('C', 3)], 5, true)
    const c = out.find((x) => x.key === 'C')!
    expect(c.display).toBe('<5')
    expect(c.value).toBeNull()
    expect(c.pct).toBeNull()
    // Secondary suppression: total 38 minus the visible cells must not equal any single hidden cell.
    const hidden = out.filter((x) => x.suppressed)
    expect(hidden.length).toBeGreaterThanOrEqual(2)
    const b = out.find((x) => x.key === 'B')!
    expect(b.secondary).toBe(true)
    // A secondary cell never shows a bound: 15 is not "<10", so it shows a dash.
    expect(b.display).toBe('—')
    const visible = out.filter((x) => !x.suppressed).reduce((a, x) => a + (x.value ?? 0), 0)
    expect(38 - visible).not.toBe(3)
  })
  it('two small cells protect each other without hiding a third', () => {
    const out = suppress([cell('A', 20), cell('B', 2), cell('C', 4)], 5, true)
    expect(out.filter((x) => x.suppressed).map((x) => x.key).sort()).toEqual(['B', 'C'])
  })
  it('zero is shown, because an empty category reveals nobody', () => {
    const out = suppress([cell('A', 20), cell('B', 0), cell('C', 12)], 5, true)
    expect(out.every((x) => !x.suppressed)).toBe(true)
  })
  it('Partner/Donor and Public reports use a threshold of 10', () => {
    const internal = getMetric(admin, req({ breakdown: 'cohort' }))
    const external = getMetric(admin, req({ breakdown: 'cohort', audience: 'partner' }))
    expect(internal.threshold).toBe(5)
    expect(external.threshold).toBe(10)
    expect(external.rows!.filter((x) => x.suppressed).length).toBeGreaterThanOrEqual(internal.rows!.filter((x) => x.suppressed).length)
  })
  it('real breakdowns never show a count between 1 and the threshold', () => {
    for (const audience of ['internal', 'partner'] as const) {
      const r = getMetric(admin, req({ scope: scope({ pillars: ['HENT', 'HEMP', 'HECO'] }), breakdown: 'cohort', audience }))
      for (const row of r.rows!) {
        if (!row.suppressed) expect(row.value === 0 || (row.value ?? 0) >= r.threshold).toBe(true)
      }
    }
  })
  it('rates with too few people behind them are hidden', () => {
    const r = getMetric(admin, req({ code: 'attendance.rate', scope: scope({ pillars: ['HENT', 'HEMP', 'HECO'] }), breakdown: 'cohort' }))
    for (const row of r.rows!) if (row.suppressed) expect(row.display).toBe('n<5')
  })
})

describe('calculation', () => {
  it('every indicator computes for an all-pillar scope', () => {
    for (const ind of INDICATORS) {
      const r = getMetric(admin, req({ code: ind.code, scope: scope({ pillars: ['HENT', 'HEMP', 'HECO'] }), dateRule: ind.defaultDateRule, comparison: 'previous' }))
      expect(r.code).toBe(ind.code)
      expect(r.definition.length).toBeGreaterThan(20)
    }
  })
  it('new + returning people add up to people reached', () => {
    const all = scope({ pillars: ['HENT', 'HEMP', 'HECO'] })
    const reach = getMetric(admin, req({ scope: all })).value!
    const fresh = getMetric(admin, req({ scope: all, code: 'reach.new_people' })).value!
    const back = getMetric(admin, req({ scope: all, code: 'reach.returning_people' })).value!
    expect(fresh + back).toBe(reach)
  })
  it('a date rule the indicator cannot use falls back to its default, and says so', () => {
    const r = getMetric(admin, req({ code: 'participation.cohorts', dateRule: 'response' }))
    expect(r.dateRule).toBe('session')
  })
  it('a pillar with no interventions ticked keeps all of its interventions', () => {
    const both = scope({ pillars: ['HENT', 'HEMP'] })
    const hentOnly = getMetric(admin, req({ scope: scope({ pillars: ['HENT'] }) })).value!
    const sieOnly = getMetric(admin, req({ scope: scope({ interventions: ['SIE'] }) })).value!
    const mixed = getMetric(admin, req({ scope: { ...both, interventions: ['SIE'] } })).value!
    // HENT (all of it) plus SIE: more than either part, and never more than their sum.
    expect(mixed).toBeGreaterThan(hentOnly)
    expect(mixed).toBeGreaterThan(sieOnly)
    expect(mixed).toBeLessThanOrEqual(hentOnly + sieOnly)
  })
  it('narrowing the scope never increases reach', () => {
    const wide = getMetric(admin, req({})).value!
    const narrow = getMetric(admin, req({ scope: scope({ interventions: ['SIE'] }) })).value!
    expect(narrow).toBeLessThanOrEqual(wide)
  })
})

describe('periods (spec §3 step 2)', () => {
  // The prototype's "today" is 10 Nov 2025.
  it('resolves presets relative to today', () => {
    expect(presetPeriod('last_quarter')).toMatchObject({ start: '2025-07-01', end: '2025-09-30', label: 'Q3 2025' })
    expect(presetPeriod('this_month')).toMatchObject({ start: '2025-11-01', end: '2025-11-30' })
    expect(presetPeriod('last_month')).toMatchObject({ start: '2025-10-01', end: '2025-10-31' })
    expect(presetPeriod('h1')).toMatchObject({ start: '2025-01-01', end: '2025-06-30' })
  })
  it('supports a financial year starting in any month', () => {
    expect(presetPeriod('this_fy', '2025-11-10', 7)).toMatchObject({ start: '2025-07-01', end: '2026-06-30', label: 'FY 2025/26' })
    expect(presetPeriod('last_fy', '2025-03-10', 7)).toMatchObject({ start: '2023-07-01', end: '2024-06-30' })
  })
  it('compares whole months, quarters and years with the previous whole unit', () => {
    const q3 = presetPeriod('last_quarter')
    expect(comparisonPeriod(q3, 'previous')).toMatchObject({ start: '2025-04-01', end: '2025-06-30' })
    expect(comparisonPeriod(q3, 'last_year')).toMatchObject({ start: '2024-07-01', end: '2024-09-30' })
    expect(comparisonPeriod(customPeriod('2025-02-01', '2025-02-28'), 'previous')).toMatchObject({ start: '2025-01-01', end: '2025-01-31' })
    expect(comparisonPeriod(presetPeriod('last_year'), 'previous')).toMatchObject({ start: '2023-01-01', end: '2023-12-31' })
  })
  it('compares other custom ranges with the same number of days just before', () => {
    expect(comparisonPeriod(customPeriod('2025-03-10', '2025-03-19'), 'previous')).toMatchObject({ start: '2025-02-28', end: '2025-03-09' })
  })
})
