/** HENT Incubation: the build addendum's acceptance tests (§10) and business rules (§5). */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetPeople } from '../ventures/people'
import { getRegistry, resetRegistry } from '../ventures/store'
import { cohortSessions, dqIssues, foundersIn, funnel, isLate, moduleStatus, resultOf, skillsGain, trackComplete } from './progress'
import {
  IncubationError,
  addModuleFeedback,
  canUseIncubation,
  createCohort,
  decideExemption,
  decideGate,
  getIncubation,
  recordSnapshot,
  requestExemption,
  resetIncubation,
  runSync,
  saveResult,
  setAttendance,
} from './store'

beforeEach(() => {
  resetPeople()
  resetRegistry()
  resetIncubation()
})

const d = () => getIncubation()
const A = () => d().cohorts.find((c) => c.id === 'coh-2025a')!
const B = () => d().cohorts.find((c) => c.id === 'coh-2025b')!

describe('cohorts from the template', () => {
  it('creating “Incubation 2027 A: Expose” creates 40 sessions, I1 S01 to I4 S10', () => {
    const c = createCohort({ name: 'Incubation 2027 A: Expose', stage: 'expose', startsOn: '2027-02-01', fillDates: true, threshold: 0.75, canvas: { mode: 'one', courses: {} } }, 'Tendai')
    const ss = cohortSessions(d(), c.id)
    expect(ss).toHaveLength(40)
    expect(`${ss[0].moduleCode} S${ss[0].no}`).toBe('I1 S1')
    expect(`${ss[39].moduleCode} S${ss[39].no}`).toBe('I4 S10')
    expect(ss.every((s) => s.date && s.date >= '2027-02-01')).toBe(true)
  })
  it('a Build cohort has no sessions until Build has a curriculum', () => {
    const c = createCohort({ name: 'Incubation 2026 A: Build', stage: 'build', startsOn: '2026-01-12', fillDates: true, threshold: 0.75, canvas: { mode: 'one', courses: {} } }, 'Tendai')
    expect(cohortSessions(d(), c.id)).toHaveLength(0)
  })
  it('refuses a duplicate name', () => {
    expect(() => createCohort({ name: 'Incubation 2025 B: Expose', stage: 'expose', startsOn: '2027-02-01', fillDates: false, threshold: 0.75, canvas: { mode: 'one', courses: {} } }, 'T')).toThrow(IncubationError)
  })
})

describe('module and track completion', () => {
  it('an approved I1 exemption plus completed I2–I4 is a complete track, with I1 exempt', () => {
    const c = A()
    const f = foundersIn(d(), c.id)[0]
    const e = requestExemption({ cohortId: c.id, chiiId: f.chiiId, moduleCode: 'I1', requestedOn: '2025-02-20', evidence: 'Certificate' }, 'Tendai')
    decideExemption(e.id, 'approved', 'Tendai')
    for (const m of ['I2', 'I3', 'I4']) {
      for (const s of cohortSessions(d(), c.id).filter((x) => x.moduleCode === m)) setAttendance(s.id, [...s.present, f.chiiId])
      saveResult({ cohortId: c.id, code: `${m}-FINAL`, chiiId: f.chiiId, scores: { 0: 3 }, submittedAt: '2025-05-01', dueAt: '2025-05-01' }, 'Tendai')
    }
    expect(moduleStatus(d(), A(), f.chiiId, 'I1')).toBe('exempt')
    expect(trackComplete(d(), A(), f.chiiId)).toBe(true)
  })
  it('a declined or pending exemption doesn’t count', () => {
    const c = B()
    const pending = d().exemptions.find((e) => e.cohortId === c.id && e.decision === 'pending')!
    expect(moduleStatus(d(), c, pending.chiiId, pending.moduleCode)).not.toBe('exempt')
  })
  it('not enough attendance means the module isn’t completed', () => {
    const c = A()
    const f = foundersIn(d(), c.id)[2]
    for (const s of cohortSessions(d(), c.id).filter((x) => x.moduleCode === 'I2')) setAttendance(s.id, s.present.filter((p) => p !== f.chiiId))
    expect(moduleStatus(d(), A(), f.chiiId, 'I2')).toBe('not_done')
  })
})

describe('Canvas sync', () => {
  it('running twice writes nothing new the second time', () => {
    const first = runSync('coh-2025b', 'Tendai')
    const count = d().results.length
    const second = runSync('coh-2025b', 'Tendai')
    expect(second.written).toBe(0)
    expect(d().results.length).toBe(count)
    expect(first.read).toBeGreaterThan(0)
  })
  it('matches Canvas users by email to their existing CHII IDs and lists the rest', () => {
    const before = { ...d().canvas.links }
    for (const k of Object.keys(before)) delete d().canvas.links[k]
    runSync('coh-2025b', 'Tendai')
    const founders = foundersIn(d(), 'coh-2025b').map((f) => f.chiiId)
    const linked = Object.values(d().canvas.links).map((l) => l.chiiId)
    expect(founders.every((id) => linked.includes(id))).toBe(true)
    expect(d().canvas.unmatched['coh-2025b']).toHaveLength(1)
  })
  it('a late Canvas submission is not on time', () => {
    const late = d().results.find((r) => r.source === 'canvas' && isLate(r))
    expect(late).toBeTruthy()
  })
})

describe('skills gain', () => {
  it('appears only when both intake and end quiz exist', () => {
    const c = A()
    const withBoth = foundersIn(d(), c.id).find((f) => resultOf(d(), c.id, 'QUIZ-intake', f.chiiId) && resultOf(d(), c.id, 'QUIZ-end_i4', f.chiiId))!
    expect(skillsGain(d(), c.id, withBoth.chiiId, 'QUIZ')).not.toBeNull()
    const noIntake = foundersIn(d(), c.id).find((f) => !resultOf(d(), c.id, 'QUIZ-intake', f.chiiId))!
    expect(skillsGain(d(), c.id, noIntake.chiiId, 'QUIZ')).toBeNull()
    expect(dqIssues(d()).some((x) => x.code === 'INC-09' && x.chiiId === noIntake.chiiId)).toBe(true)
  })
})

describe('module feedback', () => {
  it('rejects a second I1 response from the same founder; I1 and I2 are fine', () => {
    const c = createCohort({ name: 'Feedback test', stage: 'expose', startsOn: '2027-02-01', fillDates: true, threshold: 0.75, canvas: { mode: 'one', courses: {} } }, 'T')
    getIncubation().founders.push({ cohortId: c.id, chiiId: 'CHII-000214', status: 'enrolled', joinedOn: '2027-02-01' })
    addModuleFeedback({ cohortId: c.id, chiiId: 'CHII-000214', moduleCode: 'I1', rating: 4, comment: '' })
    expect(() => addModuleFeedback({ cohortId: c.id, chiiId: 'CHII-000214', moduleCode: 'I1', rating: 5, comment: '' })).toThrow(IncubationError)
    expect(() => addModuleFeedback({ cohortId: c.id, chiiId: 'CHII-000214', moduleCode: 'I2', rating: 5, comment: '' })).not.toThrow()
  })
})

describe('gate', () => {
  it('“build” into a Build cohort moves the venture’s track to Incubation – Build', () => {
    const build = createCohort({ name: 'Incubation 2026 A: Build', stage: 'build', startsOn: '2026-01-12', fillDates: false, threshold: 0.75, canvas: { mode: 'one', courses: {} } }, 'T')
    const f = foundersIn(d(), 'coh-2025a').find((x) => x.ventureId && !d().gate.some((g) => g.ventureId === x.ventureId))!
    expect(() => decideGate({ cohortId: 'coh-2025a', chiiId: f.chiiId, ventureId: f.ventureId, decision: 'build', decidedOn: '2025-06-20', notes: '' }, 'T')).toThrow(/Build cohort/)
    decideGate({ cohortId: 'coh-2025a', chiiId: f.chiiId, ventureId: f.ventureId, decision: 'build', decidedOn: '2025-06-20', nextCohortId: build.id, notes: '' }, 'T')
    expect(getRegistry().ventures.find((v) => v.id === f.ventureId)!.track).toBe('Incubation – Build')
    expect(foundersIn(d(), build.id).some((x) => x.chiiId === f.chiiId)).toBe(true)
    // Participation in the Expose cohort doesn't change.
    expect(foundersIn(d(), 'coh-2025a').some((x) => x.chiiId === f.chiiId)).toBe(true)
  })
  it('one decision per venture: deciding again replaces it', () => {
    const g = d().gate[0]
    decideGate({ cohortId: g.cohortId, chiiId: g.chiiId, ventureId: g.ventureId, decision: 'other_pathway', decidedOn: '2025-07-01', notes: '' }, 'T')
    expect(d().gate.filter((x) => x.ventureId === g.ventureId)).toHaveLength(1)
  })
  it('the I4 snapshot adds a venture update without changing the baseline', () => {
    const f = foundersIn(d(), 'coh-2025a').find((x) => x.ventureId)!
    const before = getRegistry().updates.filter((u) => u.ventureId === f.ventureId)
    recordSnapshot('coh-2025a', f.ventureId!, '2025-05-30', 'T')
    const after = getRegistry().updates.filter((u) => u.ventureId === f.ventureId)
    expect(after).toHaveLength(before.length + 1)
    expect(after.find((u) => u.updateType === 'baseline')).toEqual(before.find((u) => u.updateType === 'baseline'))
    expect(after.slice(-1)[0].source).toBe('incubation_snapshot')
  })
})

describe('funnel and access', () => {
  it('funnel totals match the founders in the cohorts', () => {
    const steps = funnel(d(), d().cohorts)
    expect(steps[0].n).toBe(d().founders.filter((f) => d().cohorts.find((c) => c.id === f.cohortId)?.stage === 'expose').length)
    for (let i = 1; i < steps.length - 1; i++) expect(steps[i].n).toBeLessThanOrEqual(steps[i - 1].n)
  })
  it('HEMP and HECO staff can’t use incubation; HENT and MELA can', () => {
    expect(canUseIncubation({ role: 'pillar_staff', pillars: ['HEMP'] })).toBe(false)
    expect(canUseIncubation({ role: 'pillar_lead', pillars: ['HECO'] })).toBe(false)
    expect(canUseIncubation({ role: 'pillar_staff', pillars: ['HENT'] })).toBe(true)
    expect(canUseIncubation({ role: 'admin', pillars: [] })).toBe(true)
  })
  it('rubric scores outside 1–4 are refused', () => {
    const f = foundersIn(d(), 'coh-2025b')[0]
    expect(() => saveResult({ cohortId: 'coh-2025b', code: 'I1-A1', chiiId: f.chiiId, scores: { 0: 5 } }, 'T')).toThrow(IncubationError)
  })
})
