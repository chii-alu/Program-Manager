import { describe, expect, it } from 'vitest'
import { blockContext, defaultContent, fillPlaceholders, metricsUsed } from './blocks'
import { getMetric, viewerFor } from './metrics'
import { presetPeriod } from './periods'
import { SYSTEM_TEMPLATES } from './templates'
import type { Report } from './types'

const admin = viewerFor('admin', [])
const hempLead = viewerFor('pillar_lead', ['HEMP'])
const report: Pick<Report, 'scope' | 'period' | 'dateRule' | 'comparison' | 'audience'> = {
  scope: { pillars: ['HEMP'], interventions: [], cohorts: [], filters: {} },
  period: presetPeriod('last_quarter'),
  dateRule: 'session',
  comparison: 'previous',
  audience: 'internal',
}

describe('template defaults (spec §5)', () => {
  it('every system template produces sections and blocks, keeping required and locked flags', () => {
    for (const t of SYSTEM_TEMPLATES) {
      const c = defaultContent(t.id)
      expect(c.sections.length).toBe(t.sections.length)
      expect(c.blocks.length).toBe(t.sections.reduce((n, s) => n + s.blocks.length, 0))
      t.sections.forEach((s, i) => {
        expect(c.sections[i].required).toBe(s.required)
        expect(c.sections[i].locked).toBe(s.locked)
      })
    }
  })
  it('every default block asks for a metric that exists', () => {
    for (const t of SYSTEM_TEMPLATES) {
      const c = defaultContent(t.id)
      for (const code of metricsUsed(c.blocks)) expect(() => getMetric(admin, { ...report, code, scope: { ...report.scope, pillars: ['HENT', 'HEMP', 'HECO'] } })).not.toThrow()
    }
  })
  it('a blank report starts with one text section', () => {
    expect(defaultContent(null).blocks.map((b) => b.type)).toEqual(['text'])
  })
})

describe('placeholders (spec §4)', () => {
  it('fills metric tokens with the same value getMetric gives', () => {
    const reach = getMetric(hempLead, { ...report, code: 'reach.unique_people' }).display
    expect(fillPlaceholders('Reached {{reach.unique_people}} people in {{period.label}}.', report, hempLead)).toBe(`Reached ${reach} people in Q3 2025.`)
  })
  it('accepts the spec’s short {{nps}} form', () => {
    expect(fillPlaceholders('{{nps}}', report, hempLead)).toBe(getMetric(hempLead, { ...report, code: 'feedback.nps' }).display)
  })
  it('flags unknown tokens instead of dropping them', () => {
    expect(fillPlaceholders('{{reach.unicorns}}', report, hempLead)).toContain('data-unknown')
  })
  it('never fills a number the viewer may not see', () => {
    expect(fillPlaceholders('{{reach.unique_people}}', { ...report, scope: { ...report.scope, pillars: ['HENT'] } }, hempLead)).toContain('n/a')
  })
  it('applies suppression to placeholders too', () => {
    // One cohort-sized slice as a Partner report (threshold 10): small values must not leak through text.
    const out = fillPlaceholders('{{outcomes.placements}}', { ...report, audience: 'partner', scope: { ...report.scope, interventions: ['Internships'] } }, hempLead)
    const value = getMetric(hempLead, { ...report, audience: 'partner', code: 'outcomes.placements', scope: { ...report.scope, interventions: ['Internships'] } })
    // The text is HTML, so "<10" is written escaped.
    expect(out).toBe(value.display.replace('<', '&lt;'))
    if (value.suppressed) expect(out).toBe('&lt;10')
  })
  it('escapes values so text blocks cannot be used to inject markup', () => {
    expect(fillPlaceholders('{{scope.pillars}}', { ...report, scope: { ...report.scope, pillars: ['<b>x</b>' as never] } }, admin)).not.toContain('<b>')
  })
})

describe('block overrides (spec §3 step 4)', () => {
  it('a block can use a different period, and says so', () => {
    const c = blockContext(report, { overridePreset: 'last_month' })
    expect(c.period.label).toBe('October 2025')
    expect(c.note).toContain('October 2025')
  })
  it('a block can narrow to fewer interventions, and says so', () => {
    const c = blockContext(report, { overrideInterventions: ['SIE'] })
    expect(c.scope.interventions).toEqual(['SIE'])
    expect(c.note).toContain('SIE only')
  })
  it('an override cannot widen beyond the viewer’s access', () => {
    const c = blockContext(report, { overrideInterventions: ['Masterclass'] })
    expect(() => getMetric(hempLead, { ...report, code: 'reach.unique_people', scope: c.scope, period: c.period })).toThrow()
  })
  it('no override means the report’s own scope and period', () => {
    const c = blockContext(report, {})
    expect(c.overridden).toBe(false)
    expect(c.period).toEqual(report.period)
  })
})
