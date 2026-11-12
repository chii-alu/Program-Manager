/**
 * Venture Registry in reports and the workbook (VENTURE-REGISTRY-SPEC §8 step 7).
 * Report numbers must equal Venture Analytics for the same period, with the same access rules.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { buildVentures } from '../ventures/sheet'
import { analyse } from '../ventures/metrics'
import { resetPeople } from '../ventures/people'
import { getRegistry, resetRegistry } from '../ventures/store'
import { defaultContent, fillPlaceholders, metricsUsed } from './blocks'
import { indicatorByCode } from './indicators'
import { MetricAccessError, MetricPolicyError, getMetric, viewerFor } from './metrics'
import { customPeriod } from './periods'
import { runDataCheck } from './quality'
import { buildVersion } from './snapshot'
import { SYSTEM_TEMPLATES, templateById } from './templates'
import type { MetricRequest, Report } from './types'

beforeEach(() => {
  resetPeople()
  resetRegistry()
})

const hentLead = viewerFor('pillar_lead', ['HENT'])
const hentStaff = viewerFor('pillar_staff', ['HENT'])
const hempStaff = viewerFor('pillar_staff', ['HEMP'])
const reviewer = viewerFor('reviewer', ['HENT'])
const admin = viewerFor('admin', [])
const y2025 = customPeriod('2025-01-01', '2025-12-31')
const y2024 = customPeriod('2024-01-01', '2024-12-31')
const vp = (p: typeof y2025) => ({ key: 'report', label: p.label, start: p.start, end: p.end })

const req = (r: Partial<MetricRequest>): MetricRequest => ({
  code: 'venture.supported',
  scope: { pillars: ['HENT'], interventions: [], cohorts: [], filters: {} },
  period: y2025,
  dateRule: 'session',
  audience: 'internal',
  ...r,
})

function report(r: Partial<Report> = {}): Report {
  return {
    id: 'rep-ven',
    templateId: 'tpl-venture-portfolio',
    templateVersion: 1,
    title: 'HENT venture portfolio · 2025',
    subtitle: '',
    audience: 'internal',
    status: 'draft',
    scope: { pillars: ['HENT'], interventions: [], cohorts: [], filters: {} },
    period: y2025,
    periodPreset: 'custom',
    dateRule: 'session',
    comparison: 'previous',
    ownerId: 'lead@chii.alu.edu',
    preparedBy: 'A Lead',
    reviewers: [],
    cover: { showLogo: true, pillarColour: true },
    createdAt: '',
    updatedAt: '',
    ...defaultContent('tpl-venture-portfolio'),
    ...r,
  }
}

describe('report numbers are Venture Analytics numbers', () => {
  it('every venture indicator in a report equals analyse() for the same period', () => {
    for (const p of [y2025, y2024]) {
      const a = analyse(getRegistry(), vp(p))
      for (const ind of [...indicatorByCode.values()].filter((i) => i.source === 'registry')) {
        const r = getMetric(admin, req({ code: ind.code, period: p }))
        if (r.suppressed) continue
        const want = a.values[ind.code]
        expect(r.value, ind.code).toBe(want == null ? null : ind.unit === 'amount' ? Math.round(want) : want)
      }
    }
  })

  it('a breakdown by stage matches the analytics bars, in stage order', () => {
    const a = analyse(getRegistry(), vp(y2025))
    const r = getMetric(hentLead, req({ breakdown: 'venture_stage' }))
    expect(r.rows!.map((c) => c.key)).toEqual(a.breakdowns.stage.map((s) => s.key))
    r.rows!.filter((c) => !c.suppressed).forEach((c) => expect(c.value).toBe(a.breakdowns.stage.find((s) => s.key === c.key)!.value))
  })

  it('the comparison is the same metric for the previous period', () => {
    const r = getMetric(hentLead, req({ comparison: 'previous' }))
    expect(r.comparison!.value).toBe(analyse(getRegistry(), vp(y2024)).values['venture.supported'])
  })
})

describe('access and privacy', () => {
  it('HEMP staff, reviewers and HEMP-only scopes get no venture numbers', () => {
    expect(() => getMetric(hempStaff, req({ scope: { pillars: ['HEMP'], interventions: [], cohorts: [], filters: {} } }))).toThrow(MetricAccessError)
    expect(() => getMetric(reviewer, req({}))).toThrow(MetricAccessError)
    expect(() => getMetric(admin, req({ scope: { pillars: ['HEMP'], interventions: [], cohorts: [], filters: {} } }))).toThrow(MetricAccessError)
    expect(getMetric(hentStaff, req({})).value).toBeGreaterThan(0)
  })

  it('venture metrics can’t be broken down by people fields', () => {
    expect(() => getMetric(admin, req({ breakdown: 'gender' }))).toThrow(MetricPolicyError)
  })

  it('small venture counts are hidden (<5 internal, <10 external)', () => {
    const r = getMetric(admin, req({ breakdown: 'venture_country' }))
    const small = r.rows!.filter((c) => c.suppressed && !c.secondary)
    expect(small.length).toBeGreaterThan(0)
    small.forEach((c) => expect(c.display).toBe('<5'))
    const pub = getMetric(admin, req({ breakdown: 'venture_stage', audience: 'public' }))
    pub.rows!.filter((c) => !c.suppressed).forEach((c) => expect(c.value!).toBeGreaterThanOrEqual(10))
  })
})

describe('the Venture portfolio report template', () => {
  it('is in the template list, starts on HENT and is only for venture users', () => {
    const t = templateById('tpl-venture-portfolio')!
    expect(SYSTEM_TEMPLATES).toContain(t)
    expect(t.pillars).toEqual(['HENT'])
    expect(t.needsVentures).toBe(true)
  })

  it('its default blocks use venture metrics only, including the dashboard’s headline cards', () => {
    const used = metricsUsed(report().blocks!)
    expect(used.every((c) => c.startsWith('venture.'))).toBe(true)
    for (const c of ['venture.supported', 'venture.active', 'venture.women_led', 'venture.jobs', 'venture.funding_deployed', 'venture.revenue']) expect(used).toContain(c)
  })

  it('the summary fills its venture numbers', () => {
    const html = report().blocks!.find((b) => b.type === 'text')!.settings.html!
    const out = fillPlaceholders(html, report(), hentLead)
    expect(out).not.toContain('{{')
    expect(out).not.toContain('data-unknown')
    expect(out).toContain(getMetric(hentLead, req({ code: 'venture.jobs' })).display)
  })

  it('finalises with every number frozen, and no founder identity in the snapshot', () => {
    const v1 = buildVersion(report(), hentLead, { email: 'lead@chii.alu.edu', name: 'A Lead' }, null)
    const json = JSON.stringify(v1.snapshot)
    expect(json).toContain('venture.jobs')
    expect(json).not.toMatch(/CHII-\d{6}/)
    expect(json).not.toMatch(/@alustudent|@gmail/)
  })

  it('the data check shows registry issues by rule, not attendance or feedback', () => {
    const c = runDataCheck(hentLead, report())
    expect(c.issues.some((i) => i.id.startsWith('ven-VEN-'))).toBe(true)
    expect(c.issues.some((i) => i.id.startsWith('att-') || i.id === 'feedback-rate')).toBe(false)
    expect(c.completeness.map((x) => x.key)).toEqual(['venture-updates', 'venture-revenue'])
    expect(c.ventures).toBeGreaterThan(0)
    // Aggregate only: no venture is named.
    const names = getRegistry().ventures.map((v) => v.name)
    c.issues.forEach((i) => names.forEach((n) => expect(i.title + i.detail).not.toContain(n)))
  })
})

describe('the HENT workbook’s Ventures sheet', () => {
  it('has one row per venture in the registry view, with founder identity in restricted columns only', () => {
    const { cols, rows } = buildVentures(getRegistry())
    expect(rows.length).toBe(analyse(getRegistry(), { key: 'now', label: 'now', start: '2015-01-01', end: '2025-11-10' }).rows.length)
    const restricted = cols.filter((c) => c.restricted).map((c) => c.key)
    expect(restricted).toEqual(['leadId', 'leadName', 'leadEmail'])
    const open = cols.filter((c) => !c.restricted).map((c) => c.key)
    const openText = JSON.stringify(rows.map((r) => open.map((k) => r[k])))
    expect(openText).not.toMatch(/CHII-\d{6}/)
    expect(openText).not.toMatch(/@/)
  })
})
