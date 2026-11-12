import { afterEach, describe, expect, it } from 'vitest'
import { defaultContent } from './blocks'
import { facts } from './facts'
import { getMetric, viewerFor } from './metrics'
import { presetPeriod } from './periods'
import { runDataCheck } from './quality'
import { FinaliseBlockedError, buildVersion, finaliseAction, whatChanged } from './snapshot'
import { replaySource } from './source'
import type { Report } from './types'

const admin = viewerFor('admin', [])
const hempLead = viewerFor('pillar_lead', ['HEMP'])
const hempStaff = viewerFor('pillar_staff', ['HEMP'])
const hentLead = viewerFor('pillar_lead', ['HENT'])
const me = { email: 'lead@chii.alu.edu', name: 'A Lead' }

function report(r: Partial<Report> = {}): Report {
  const base: Report = {
    id: 'rep-test',
    templateId: 'tpl-pillar-quarterly',
    templateVersion: 1,
    title: 'HEMP · Q3 2025',
    subtitle: '',
    audience: 'internal',
    status: 'draft',
    scope: { pillars: ['HEMP'], interventions: [], cohorts: [], filters: {} },
    period: presetPeriod('last_quarter'),
    periodPreset: 'last_quarter',
    dateRule: 'session',
    comparison: 'previous',
    ownerId: me.email,
    preparedBy: me.name,
    reviewers: [],
    cover: { showLogo: true, pillarColour: true },
    createdAt: '',
    updatedAt: '',
    ...defaultContent('tpl-pillar-quarterly'),
  }
  return { ...base, ...r }
}

const headline = (r: Report) => ({ code: 'attendance.rate', scope: r.scope, period: r.period, dateRule: r.dateRule, comparison: 'none' as const, audience: r.audience })

/* Data corrections in these tests are undone afterwards, so other tests see the original data. */
const undo: (() => void)[] = []
afterEach(() => undo.splice(0).forEach((f) => f()))

describe('finalising freezes the report (spec §6, §12)', () => {
  it('a final version replays exactly what the live report showed', () => {
    const r = report()
    const v1 = buildVersion(r, hempLead, me, null)
    expect(v1.versionNo).toBe(1)
    const live = getMetric(hempLead, headline(r))
    expect(replaySource(v1.snapshot.answers)(headline(r)).display).toBe(live.display)
  })

  it('correcting an attendance record afterwards does not change the final report', () => {
    const r = report()
    const v1 = buildVersion(r, hempLead, me, null)
    const frozen = replaySource(v1.snapshot.answers)(headline(r)).display
    const before = getMetric(hempLead, headline(r)).display

    // Correct the data: mark everyone eligible in one HEMP Q3 cohort as having attended.
    const cohort = facts.find((f) => f.pillar === 'HEMP' && f.sessionDate >= r.period.start && f.sessionDate <= r.period.end && f.eligible && !f.attended)!.cohortId
    const fixed = facts.filter((f) => f.cohortId === cohort && f.eligible && !f.attended)
    fixed.forEach((f) => ((f.attended = true), (f.sessionsAttended = 1)))
    undo.push(() => fixed.forEach((f) => ((f.attended = false), (f.sessionsAttended = 0))))

    expect(getMetric(hempLead, headline(r)).display).not.toBe(before) // live data changed…
    expect(replaySource(v1.snapshot.answers)(headline(r)).display).toBe(frozen) // …the final report did not

    // v2 is regenerated from current data and says what changed.
    const v2 = buildVersion(r, hempLead, me, v1)
    expect(v2.versionNo).toBe(2)
    expect(replaySource(v2.snapshot.answers)(headline(r)).display).toBe(getMetric(hempLead, headline(r)).display)
    const change = whatChanged(v1, v2).find((c) => c.code === 'attendance.rate')
    expect(change).toBeDefined()
    expect(change!.before).toBe(frozen)
  })

  it('the snapshot holds the content as finalised, not as later edited', () => {
    const r = report()
    const v1 = buildVersion(r, hempLead, me, null)
    r.title = 'Edited later'
    r.blocks![0].settings.html = '<p>changed</p>'
    expect(v1.snapshot.report.title).toBe('HEMP · Q3 2025')
    expect(v1.snapshot.report.blocks![0].settings.html).not.toBe('<p>changed</p>')
  })

  it('no snapshot contains a name, email or CHII ID', () => {
    const json = JSON.stringify(buildVersion(report({ scope: { pillars: ['HENT', 'HEMP', 'HECO'], interventions: [], cohorts: [], filters: {} } }), admin, me, null, { overrideReason: 'test' }).snapshot.answers)
    expect(json).not.toMatch(/CHII-\d{6}/)
    expect(json).not.toMatch(/[\w.]+@[\w.]+/)
  })
})

describe('data check (spec §3 step 5)', () => {
  it('flags missing attendance as a warning and keeps going', () => {
    const c = runDataCheck(hempLead, report())
    expect(c.issues.find((i) => i.id === 'att-i7-c5')?.severity).toBe('warning')
    expect(c.counts.critical).toBe(0)
  })
  it('flags a cohort with no attendance at all as critical', () => {
    const r = report({ scope: { pillars: ['HENT'], interventions: [], cohorts: [], filters: {} } })
    expect(runDataCheck(hentLead, r).issues.find((i) => i.id === 'att-i2-c5')?.severity).toBe('critical')
  })
  it('flags template text the author has not replaced', () => {
    expect(runDataCheck(hempLead, report()).issues.some((i) => i.id.startsWith('starter-'))).toBe(true)
  })
  it('reports completeness as percentages', () => {
    const c = runDataCheck(hempLead, report())
    const att = c.completeness.find((x) => x.key === 'attendance')!
    expect(att.pct).toBeGreaterThan(0)
    expect(att.pct).toBeLessThan(100)
  })
})

describe('critical issues block finalising (spec §3, §12)', () => {
  const hent = () => report({ scope: { pillars: ['HENT'], interventions: [], cohorts: [], filters: {} } })
  it('a pillar lead cannot finalise past a critical issue', () => {
    expect(() => buildVersion(hent(), hentLead, me, null)).toThrow(FinaliseBlockedError)
  })
  it('a MELA admin must give a reason to override', () => {
    expect(() => buildVersion(hent(), admin, me, null)).toThrow(FinaliseBlockedError)
    const v = buildVersion(hent(), admin, me, null, { overrideReason: 'Attendance sheet lost; numbers agreed with the pillar lead.' })
    expect(v.snapshot.override?.reason).toContain('Attendance sheet lost')
  })
})

describe('who can finalise (spec §2, §6)', () => {
  it('pillar staff submit for review', () => {
    expect(finaliseAction(hempStaff, report(), 1).kind).toBe('submit')
  })
  it('a pillar lead finalises internal reports directly', () => {
    expect(finaliseAction(hempLead, report(), 1).kind).toBe('finalise')
  })
  it('Partner/Donor and Public reports need MELA approval', () => {
    expect(finaliseAction(hempLead, report({ audience: 'partner' }), 1).kind).toBe('submit')
    expect(finaliseAction(admin, report({ audience: 'partner', status: 'in_review' }), 1).kind).toBe('approve')
  })
  it('a report in review: the lead finalises internal ones, MELA approves external ones', () => {
    expect(finaliseAction(hempLead, report({ status: 'in_review' }), 1).kind).toBe('finalise')
    expect(finaliseAction(hempStaff, report({ status: 'in_review' }), 1).kind).toBe('none')
    expect(finaliseAction(hempLead, report({ status: 'in_review', audience: 'partner' }), 1).kind).toBe('none')
    expect(finaliseAction(admin, report({ status: 'in_review' }), 1).kind).toBe('approve')
  })
  it('reviewers and final reports cannot be finalised', () => {
    expect(finaliseAction(viewerFor('reviewer', []), report(), 1).kind).toBe('none')
    expect(finaliseAction(admin, report({ status: 'final' }), 2).kind).toBe('none')
  })
})
