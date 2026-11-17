/**
 * Incubation business rules (addendum §5), as pure functions over the data:
 * module status, track completion, attendance, on-time work, skills gain, the funnel, gate
 * eligibility and the data quality checks (§9). Every screen and chart reads from here.
 */
import { REPORTING_DATE } from '../ventures/derive'
import { EXPOSE_MODULES, SESSIONS_PER_MODULE, moduleWork } from './curriculum'
import type { Cohort, Founder, IncubationData, Result, Timepoint } from './types'

/** The prototype's "today" (shared with the Venture Registry). */
export const TODAY = REPORTING_DATE

export type ModuleStatus = 'completed' | 'exempt' | 'in_progress' | 'not_done' | 'not_started'
export const MODULE_STATUS_LABEL: Record<ModuleStatus, string> = { completed: 'Completed', exempt: 'Exempt', in_progress: 'In progress', not_done: 'Not done', not_started: 'Not started' }

export const cohortSessions = (d: IncubationData, cohortId: string) =>
  d.sessions.filter((s) => s.cohortId === cohortId).sort((a, b) => a.moduleCode.localeCompare(b.moduleCode) || a.no - b.no)
export const foundersIn = (d: IncubationData, cohortId: string, withdrawn = false) => d.founders.filter((f) => f.cohortId === cohortId && (withdrawn || f.status === 'enrolled'))
export const held = (date: string | undefined, today = TODAY) => !!date && date <= today

export type CohortPhase = 'upcoming' | 'running' | 'completed'
export function cohortPhase(d: IncubationData, c: Cohort, today = TODAY): CohortPhase {
  const ss = cohortSessions(d, c.id)
  const dates = ss.map((s) => s.date).filter(Boolean) as string[]
  const start = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : c.startsOn
  const end = dates.length === ss.length && dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : c.endsOn
  if (start > today) return 'upcoming'
  if (end && end < today) return 'completed'
  return 'running'
}

export const isExempt = (d: IncubationData, cohortId: string, chiiId: string, moduleCode: string) =>
  d.exemptions.some((e) => e.cohortId === cohortId && e.chiiId === chiiId && e.moduleCode === moduleCode && e.decision === 'approved')

export const resultOf = (d: IncubationData, cohortId: string, code: string, chiiId: string) => d.results.find((r) => r.cohortId === cohortId && r.code === code && r.chiiId === chiiId)

/** Mean of the rubric scores, or the quiz / survey score. */
export function resultScore(r: Result | undefined): number | null {
  if (!r) return null
  if (r.score != null) return r.score
  const v = Object.values(r.scores)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
export const isLate = (r: Result) => !!r.submittedAt && !!r.dueAt && r.submittedAt.slice(0, 10) > r.dueAt.slice(0, 10)
export const onTime = (r: Result) => !!r.submittedAt && !isLate(r)

/** When a piece of module work is due in a cohort: the date of the session it follows. */
export function dueDate(d: IncubationData, cohortId: string, code: string) {
  const a = d.curriculum.assessments.find((x) => x.code === code)
  if (!a?.moduleCode || !a.dueAfter) return undefined
  return d.sessions.find((s) => s.cohortId === cohortId && s.moduleCode === a.moduleCode && s.no === a.dueAfter)?.date
}

/** Rule 3: attended at least the threshold of the module's 10 sessions and submitted the final brief. */
export function moduleStatus(d: IncubationData, cohort: Cohort, chiiId: string, moduleCode: string, today = TODAY): ModuleStatus {
  if (isExempt(d, cohort.id, chiiId, moduleCode)) return 'exempt'
  const ss = d.sessions.filter((s) => s.cohortId === cohort.id && s.moduleCode === moduleCode)
  const past = ss.filter((s) => held(s.date, today))
  const attended = past.filter((s) => s.present.includes(chiiId)).length
  const brief = resultOf(d, cohort.id, `${moduleCode}-FINAL`, chiiId)
  const needed = Math.ceil(cohort.threshold * SESSIONS_PER_MODULE)
  if (attended >= needed && brief?.submittedAt) return 'completed'
  if (!past.length) return 'not_started'
  return past.length < ss.length ? 'in_progress' : 'not_done'
}

export const modulesOf = (_d: IncubationData, c: Cohort) => (c.stage === 'expose' ? [...EXPOSE_MODULES] : [])

/** Rule 4: every module completed or exempt. */
export function trackComplete(d: IncubationData, c: Cohort, chiiId: string, today = TODAY) {
  const ms = modulesOf(d, c)
  return ms.length > 0 && ms.every((m) => ['completed', 'exempt'].includes(moduleStatus(d, c, chiiId, m, today)))
}

/** Attendance over the sessions held so far, leaving out exempt modules. */
export function attendance(d: IncubationData, c: Cohort, chiiId: string, today = TODAY) {
  const past = cohortSessions(d, c.id).filter((s) => held(s.date, today) && !isExempt(d, c.id, chiiId, s.moduleCode))
  return { attended: past.filter((s) => s.present.includes(chiiId)).length, held: past.length, pct: past.length ? past.filter((s) => s.present.includes(chiiId)).length / past.length : null }
}

/** Rule 5: of the work due so far (not exempt), the share submitted on or before its due date. */
export function onTimeShare(d: IncubationData, c: Cohort, chiiId: string, today = TODAY) {
  const due = moduleWork(d.curriculum).filter((a) => !isExempt(d, c.id, chiiId, a.moduleCode!) && held(dueDate(d, c.id, a.code), today))
  const ok = due.filter((a) => {
    const r = resultOf(d, c.id, a.code, chiiId)
    return r && onTime({ ...r, dueAt: r.dueAt ?? dueDate(d, c.id, a.code) })
  }).length
  return { due: due.length, onTime: ok, pct: due.length ? ok / due.length : null }
}

/** Rule 6: end score − intake score, only when both exist. The end is the latest of end of I4, then end of I1. */
export function skillsGain(d: IncubationData, cohortId: string, chiiId: string, kind: 'QUIZ' | 'CONF') {
  const intake = resultScore(resultOf(d, cohortId, `${kind}-intake`, chiiId))
  const ends: Timepoint[] = ['end_i4', 'end_i1']
  const endTp = ends.find((t) => resultScore(resultOf(d, cohortId, `${kind}-${t}`, chiiId)) != null)
  const end = endTp ? resultScore(resultOf(d, cohortId, `${kind}-${endTp}`, chiiId)) : null
  if (intake == null || end == null) return null
  return { intake, end, gain: end - intake, at: endTp! }
}

/** Mean rubric score for a founder in one module. */
export function moduleMean(d: IncubationData, cohortId: string, chiiId: string, moduleCode: string) {
  const v = moduleWork(d.curriculum, moduleCode).map((a) => resultScore(resultOf(d, cohortId, a.code, chiiId))).filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export const gateOf = (d: IncubationData, cohortId: string, f: Pick<Founder, 'chiiId' | 'ventureId'>) =>
  d.gate.find((g) => g.cohortId === cohortId && (f.ventureId ? g.ventureId === f.ventureId : g.chiiId === f.chiiId))

/** Ready for the EBI Evidence Gate: the cohort's last session has passed or the founder handed in the I4 brief. */
export function gateReady(d: IncubationData, c: Cohort, chiiId: string, today = TODAY) {
  if (c.stage !== 'expose') return false
  const last = d.sessions.find((s) => s.cohortId === c.id && s.moduleCode === 'I4' && s.no === SESSIONS_PER_MODULE)
  return held(last?.date, today) || !!resultOf(d, c.id, 'I4-FINAL', chiiId)?.submittedAt
}

/** §8 v_incubation_funnel: enrolled → I1 … I4 complete (cumulative) → gate reviewed → Build. */
export function funnel(d: IncubationData, cohorts: Cohort[], keep: (f: Founder) => boolean = () => true, today = TODAY) {
  const steps = [
    { key: 'enrolled', label: 'Enrolled', n: 0 },
    { key: 'I1', label: 'I1 complete', n: 0 },
    { key: 'I2', label: 'I2 complete', n: 0 },
    { key: 'I3', label: 'I3 complete', n: 0 },
    { key: 'I4', label: 'I4 complete', n: 0 },
    { key: 'gate', label: 'Gate reviewed', n: 0 },
    { key: 'build', label: 'To Build', n: 0 },
  ]
  const seen = new Set<string>()
  for (const c of cohorts.filter((x) => x.stage === 'expose')) {
    for (const f of foundersIn(d, c.id, true).filter(keep)) {
      const key = `${c.id}|${f.chiiId}`
      if (seen.has(key)) continue
      seen.add(key)
      steps[0].n++
      let ok = true
      EXPOSE_MODULES.forEach((m, i) => {
        ok = ok && ['completed', 'exempt'].includes(moduleStatus(d, c, f.chiiId, m, today))
        if (ok) steps[i + 1].n++
      })
      const g = gateOf(d, c.id, f)
      if (g) steps[5].n++
      if (g?.decision === 'build') steps[6].n++
    }
  }
  return steps
}

/* ---------- Data quality (§9) ---------- */

export type DqIssue = { code: string; severity: 'Critical' | 'Warning'; cohortId?: string; chiiId?: string; message: string }

export const DQ_RULES: { code: string; check: string; severity: 'Critical' | 'Warning' }[] = [
  { code: 'INC-01', check: 'Rubric score outside the scale, or quiz score above its maximum', severity: 'Critical' },
  { code: 'INC-02', check: 'Result for a founder who isn’t in that cohort', severity: 'Critical' },
  { code: 'INC-03', check: 'Gate decision for a founder who hasn’t completed or been exempted from all of I1–I4', severity: 'Warning' },
  { code: 'INC-04', check: 'Exemption pending for more than 14 days', severity: 'Warning' },
  { code: 'INC-05', check: 'Approved exemption with no one recorded as deciding it', severity: 'Critical' },
  { code: 'INC-06', check: 'Founder with no linked venture', severity: 'Warning' },
  { code: 'INC-07', check: 'Canvas user not matched to a CHII ID after a sync', severity: 'Warning' },
  { code: 'INC-08', check: 'Past session with no delivery log', severity: 'Warning' },
  { code: 'INC-09', check: 'End quiz but no intake quiz (skills gain can’t be worked out)', severity: 'Warning' },
  { code: 'INC-10', check: 'Reached the gate having spoken to no stakeholders', severity: 'Warning' },
]

const days = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000)

export function dqIssues(d: IncubationData, today = TODAY): DqIssue[] {
  const out: DqIssue[] = []
  const cohort = (id: string) => d.cohorts.find((c) => c.id === id)
  for (const r of d.results) {
    const a = d.curriculum.assessments.find((x) => x.code === r.code)
    if (Object.values(r.scores).some((s) => s < 1 || s > d.curriculum.scaleMax) || (a?.maxScore != null && r.score != null && (r.score > a.maxScore || r.score < 0)))
      out.push({ code: 'INC-01', severity: 'Critical', cohortId: r.cohortId, chiiId: r.chiiId, message: `${r.code}: score out of range` })
    if (!d.founders.some((f) => f.cohortId === r.cohortId && f.chiiId === r.chiiId)) out.push({ code: 'INC-02', severity: 'Critical', cohortId: r.cohortId, chiiId: r.chiiId, message: `${r.code}: not in this cohort` })
  }
  for (const g of d.gate) {
    const c = cohort(g.cohortId)
    if (c && !trackComplete(d, c, g.chiiId, today)) out.push({ code: 'INC-03', severity: 'Warning', cohortId: g.cohortId, chiiId: g.chiiId, message: 'Gate decision before I1–I4 were all completed or exempt' })
  }
  for (const e of d.exemptions) {
    if (e.decision === 'pending' && days(e.requestedOn, today) > 14) out.push({ code: 'INC-04', severity: 'Warning', cohortId: e.cohortId, chiiId: e.chiiId, message: `${e.moduleCode} exemption waiting ${days(e.requestedOn, today)} days` })
    if (e.decision === 'approved' && !e.decidedBy) out.push({ code: 'INC-05', severity: 'Critical', cohortId: e.cohortId, chiiId: e.chiiId, message: `${e.moduleCode} exemption approved with no decider` })
  }
  for (const f of d.founders.filter((x) => x.status === 'enrolled')) {
    if (!f.ventureId) out.push({ code: 'INC-06', severity: 'Warning', cohortId: f.cohortId, chiiId: f.chiiId, message: 'No linked venture' })
    const quizEnd = ['QUIZ-end_i1', 'QUIZ-end_i4'].some((code) => resultOf(d, f.cohortId, code, f.chiiId))
    if (quizEnd && !resultOf(d, f.cohortId, 'QUIZ-intake', f.chiiId)) out.push({ code: 'INC-09', severity: 'Warning', cohortId: f.cohortId, chiiId: f.chiiId, message: 'End quiz with no intake quiz' })
    const c = cohort(f.cohortId)
    if (c && gateReady(d, c, f.chiiId, today) && f.stakeholders === 0) out.push({ code: 'INC-10', severity: 'Warning', cohortId: f.cohortId, chiiId: f.chiiId, message: 'Reached the gate with no stakeholders spoken to' })
  }
  for (const [cohortId, users] of Object.entries(d.canvas.unmatched)) for (const u of users) out.push({ code: 'INC-07', severity: 'Warning', cohortId, message: `Canvas user ${u.canvasId} not matched` })
  for (const s of d.sessions) if (held(s.date, today) && s.date! < today && !s.delivery) out.push({ code: 'INC-08', severity: 'Warning', cohortId: s.cohortId, message: `${s.moduleCode} S${String(s.no).padStart(2, '0')} has no delivery log` })
  return out
}
