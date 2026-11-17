/**
 * Incubation storage and write operations (browser-only, like the Venture Registry).
 *
 * The seed has two Expose cohorts built from the registry's ventures and their founders:
 *  - Incubator 2025 A: Expose (finished in May; some gate decisions still to make)
 *  - Incubator 2025 B: Expose (running; in I4 on the prototype's "today", 10 Nov 2025)
 *
 * Canvas isn't connected: `canvasFeed` stands in for the Canvas API with a fixed, repeatable set
 * of enrolments and submissions, so "Run sync now" behaves like the real sync (matching by
 * email, no duplicates on re-run, unmatched users listed). The CHII ID is never sent to Canvas.
 */
import { useSyncExternalStore } from 'react'
import { participants, type Pillar, type Role } from '../data/mela'
import { acceptedUpdates, foundersOf } from '../ventures/derive'
import { personById, allPeople } from '../ventures/people'
import { addUpdate, editVenture, getRegistry } from '../ventures/store'
import { EXPOSE_MODULES, SESSIONS_PER_MODULE, defaultCurriculum, moduleWork } from './curriculum'
import { TODAY, cohortSessions, dueDate, foundersIn, held, isExempt } from './progress'
import type {
  CanvasUser,
  ClassSession,
  Cohort,
  Curriculum,
  DeliveryLog,
  Exemption,
  Founder,
  GateDecision,
  IncLog,
  IncStage,
  IncubationData,
  ModuleFeedback,
  Pathway,
  Result,
  ResultSource,
  SyncRun,
} from './types'

const KEY = 'mela-incubation-v1'

/** HENT staff and the MELA admin only (same as the Venture Registry). HEMP and HECO can't open it. */
export function canUseIncubation(viewer: { role: Role; pillars: Pillar[] }) {
  if (viewer.role === 'admin') return true
  if (viewer.role === 'pillar_lead' || viewer.role === 'pillar_staff') return viewer.pillars.includes('HENT')
  return false
}

/* ---------- Small helpers ---------- */

export function hash01(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
let n = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(n++).toString(36)}`
const nowIso = () => new Date().toISOString()
const addDays = (iso: string, k: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + k)
  return d.toISOString().slice(0, 10)
}

/** Class dates: Monday, Wednesday and Friday from the start date. */
export function scheduleDates(start: string, count: number) {
  const out: string[] = []
  for (let d = start; out.length < count; d = addDays(d, 1)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay()
    if (wd === 1 || wd === 3 || wd === 5) out.push(d)
  }
  return out
}

/* ---------- Canvas stand-in ---------- */

export type CanvasAssignment = { id: string; name: string; dueAt?: string }

const QUIZ_DUE: Record<string, (d: IncubationData, c: Cohort) => string | undefined> = {
  intake: (_d, c) => c.startsOn,
  end_i1: (d, c) => d.sessions.find((s) => s.cohortId === c.id && s.moduleCode === 'I1' && s.no === SESSIONS_PER_MODULE)?.date,
  end_i4: (d, c) => d.sessions.find((s) => s.cohortId === c.id && s.moduleCode === 'I4' && s.no === SESSIONS_PER_MODULE)?.date,
}
export function assessmentDue(d: IncubationData, c: Cohort, code: string) {
  const a = d.curriculum.assessments.find((x) => x.code === code)
  if (a?.timepoint && QUIZ_DUE[a.timepoint]) return QUIZ_DUE[a.timepoint](d, c)
  return dueDate(d, c.id, code)
}

/** The Canvas course's assignments and quizzes, as the API would list them. */
export function canvasAssignments(d: IncubationData, c: Cohort): CanvasAssignment[] {
  if (c.stage !== 'expose') return []
  return d.curriculum.assessments
    .filter((a) => a.kind !== 'gate_portfolio')
    .map((a) => {
      const id = String(40000 + Math.floor(hash01(`${c.id}|${a.code}`) * 59999))
      const name = a.moduleCode
        ? `${a.moduleCode} ${a.kind === 'final_brief' ? 'Final brief' : `Assignment ${a.code.slice(-1)}`}${a.title ? `: ${a.title}` : ''}`
        : `${a.kind === 'skills_quiz' ? 'Skills quiz' : 'Confidence survey'} (${a.timepoint === 'intake' ? 'intake' : a.timepoint === 'end_i1' ? 'end of I1' : 'end of I4'})`
      return { id, name, dueAt: assessmentDue(d, c, a.code) }
    })
}

/** Suggest a mapping by name: "I2 Assignment 3" → I2-A3, "Skills quiz (intake)" → QUIZ-intake. */
export function suggestMapping(d: IncubationData, c: Cohort): Record<string, string> {
  const out: Record<string, string> = {}
  for (const x of canvasAssignments(d, c)) {
    const m = x.name.match(/^(I[1-4]) (Final brief|Assignment ([1-3]))/)
    if (m) out[x.id] = `${m[1]}-${m[3] ? `A${m[3]}` : 'FINAL'}`
    else if (/^Skills quiz/.test(x.name)) out[x.id] = `QUIZ-${/intake/.test(x.name) ? 'intake' : /I1/.test(x.name) ? 'end_i1' : 'end_i4'}`
    else if (/^Confidence/.test(x.name)) out[x.id] = `CONF-${/intake/.test(x.name) ? 'intake' : 'end_i4'}`
  }
  return out
}

const canvasIdOf = (chiiId: string) => String(100000 + Math.floor(hash01(`canvas|${chiiId}`) * 899999))

/** Enrolled Canvas users: the cohort's founders, plus people Canvas has that CHII can't match. */
export function canvasUsers(d: IncubationData, c: Cohort): CanvasUser[] {
  const founders = foundersIn(d, c.id).map((f) => {
    const p = personById(f.chiiId)
    return { canvasId: canvasIdOf(f.chiiId), name: p?.name ?? f.chiiId, email: p?.email ?? '' }
  })
  // One enrolment per cohort under a personal email CHII doesn't have (sample).
  const extra = { canvasId: canvasIdOf(`${c.id}-guest`), name: 'Ama Boateng (sample)', email: `ama.b${c.id.slice(-2)}@gmail.com` }
  return [...founders, extra]
}

/** What Canvas would return for one founder and one assignment: fixed, so re-running changes nothing. */
function canvasSubmission(d: IncubationData, c: Cohort, chiiId: string, code: string, due: string) {
  const r = (k: string) => hash01(`${c.id}|${chiiId}|${code}|${k}`)
  const diligence = 0.86 + hash01(`${chiiId}|diligence`) * 0.13
  if (r('submitted') > diligence) return null
  const late = r('late') < 0.13
  const submittedAt = late ? addDays(due, 1 + Math.floor(r('days') * 4)) : addDays(due, -Math.floor(r('early') * 2))
  if (submittedAt > TODAY) return null
  const a = d.curriculum.assessments.find((x) => x.code === code)!
  const skill = hash01(`${chiiId}|skill`)
  if (a.kind === 'skills_quiz') {
    const base = 8 + skill * 6
    const gain = a.timepoint === 'intake' ? 0 : a.timepoint === 'end_i1' ? 2 + r('g') * 2 : 4 + r('g') * 3
    return { submittedAt, dueAt: due, scores: {}, score: Math.min(a.maxScore ?? 20, Math.round(base + gain)) }
  }
  if (a.kind === 'confidence_survey') {
    const base = 2.2 + skill * 1.2
    return { submittedAt, dueAt: due, scores: {}, score: Math.min(5, Math.round((base + (a.timepoint === 'intake' ? 0 : 0.6 + r('g') * 0.8)) * 10) / 10) }
  }
  const crit = d.curriculum.criteria[a.moduleCode!] ?? []
  const scores = Object.fromEntries(crit.map((_, i) => [i, Math.max(1, Math.min(d.curriculum.scaleMax, Math.round(1.6 + skill * 1.6 + r(`c${i}`) * 1.2)))]))
  return { submittedAt, dueAt: due, scores, reviewer: 'Canvas grader' }
}

/* ---------- Seed ---------- */

function seedCohort(d: IncubationData, spec: { id: string; name: string; start: string; ventures: string[]; createdAt: string }) {
  const reg = getRegistry()
  const cohort: Cohort = { id: spec.id, name: spec.name, stage: 'expose', startsOn: spec.start, canvas: { mode: 'one', courses: { all: String(8800 + Math.floor(hash01(spec.id) * 999)) } }, threshold: 0.75, curriculumVersion: d.curriculum.version, createdBy: 'Tendai Moyo', createdAt: spec.createdAt }
  const dates = scheduleDates(spec.start, EXPOSE_MODULES.length * SESSIONS_PER_MODULE)
  cohort.endsOn = dates[dates.length - 1]
  d.cohorts.push(cohort)
  const pathways: Pathway[] = ['health_saas', 'service_delivery', 'diagnostics_samd', 'medical_device', 'integrated', 'therapeutics']
  spec.ventures.forEach((vid, vi) => {
    const fs = foundersOf(reg, vid).slice(0, 2)
    fs.forEach((m) => {
      if (d.founders.some((f) => f.chiiId === m.chiiId)) return
      const r = (k: string) => hash01(`${spec.id}|${m.chiiId}|${k}`)
      d.founders.push({
        cohortId: spec.id,
        chiiId: m.chiiId,
        ventureId: vid,
        pathway: pathways[vi % pathways.length],
        status: 'enrolled',
        ideaChanged: r('changed') < 0.45,
        stakeholders: Math.floor(r('stake') * 14) + 2,
        observationType: r('obs') < 0.6 ? 'real' : r('obs') < 0.85 ? 'simulated' : 'anonymised case',
        permissionsRecorded: r('perm') < 0.8,
        joinedOn: spec.start,
      })
    })
  })
  const founders = foundersIn(d, spec.id)
  let k = 0
  for (const mod of EXPOSE_MODULES) {
    for (let no = 1; no <= SESSIONS_PER_MODULE; no++) {
      const date = dates[k++]
      const id = `${spec.id}-${mod}-${no}`
      const past = held(date) && date < TODAY
      const present = past ? founders.filter((f) => hash01(`${id}|${f.chiiId}`) < 0.8 + hash01(`${f.chiiId}|diligence`) * 0.19).map((f) => f.chiiId) : []
      const t = hash01(`${id}|delivery`)
      const unlogged = spec.id === 'coh-2025b' && (no === 6 || no === 7) && mod === 'I4'
      const delivery: DeliveryLog | undefined =
        past && !unlogged
          ? {
              delivered: t < 0.8 ? 'as_planned' : t < 0.93 ? 'changed' : t < 0.97 ? 'rescheduled' : 'skipped',
              facilitator: hash01(`${id}|f`) < 0.6 ? 'Tendai Moyo' : 'Guest facilitator',
              durationMin: 60 + Math.round(hash01(`${id}|dur`) * 15),
              readingAssigned: hash01(`${id}|read`) < 0.85,
              activityDone: t < 0.93,
              changes: t >= 0.8 && t < 0.93 ? 'Shortened the activity to make room for questions on the assignment.' : '',
              issues: hash01(`${id}|iss`) < 0.15 ? 'Internet dropped for ten minutes; recording shared on Canvas.' : '',
              loggedBy: 'Tendai Moyo',
              loggedAt: `${date}T18:00:00.000Z`,
            }
          : undefined
      d.sessions.push({ id, cohortId: spec.id, moduleCode: mod, no, title: d.curriculum.sessions.find((s) => s.moduleCode === mod && s.no === no)?.title ?? '', date, present, delivery })
    }
  }
  return cohort
}

/** Fill a cohort's results from the Canvas stand-in, as a sync would. */
function fillFromCanvas(d: IncubationData, c: Cohort) {
  const mapping = d.canvas.mapping[c.id] ?? {}
  for (const x of canvasAssignments(d, c)) {
    const code = mapping[x.id]
    if (!code || !x.dueAt || x.dueAt > TODAY) continue
    for (const f of foundersIn(d, c.id)) {
      const a = d.curriculum.assessments.find((y) => y.code === code)
      if (a?.moduleCode && isExempt(d, c.id, f.chiiId, a.moduleCode)) continue
      const s = canvasSubmission(d, c, f.chiiId, code, x.dueAt)
      if (s) d.results.push({ id: `res-${c.id}-${code}-${f.chiiId}`, cohortId: c.id, code, chiiId: f.chiiId, source: 'canvas', canvasSubmissionId: `sub-${x.id}-${canvasIdOf(f.chiiId)}`, ...s })
    }
  }
}

export function seedIncubation(): IncubationData {
  const d: IncubationData = { curriculum: defaultCurriculum(), cohorts: [], sessions: [], founders: [], results: [], exemptions: [], gate: [], feedback: [], canvas: { mapping: {}, links: {}, unmatched: {}, runs: [] }, log: [] }
  const reg = getRegistry()
  const expose = reg.ventures.filter((v) => foundersOf(reg, v.id).length > 0).sort((a, b) => a.code.localeCompare(b.code))
  const a = seedCohort(d, { id: 'coh-2025a', name: 'Incubator 2025 A: Expose', start: '2025-03-03', ventures: expose.slice(2, 7).map((v) => v.id), createdAt: '2025-02-10T09:00:00.000Z' })
  const b = seedCohort(d, { id: 'coh-2025b', name: 'Incubator 2025 B: Expose', start: '2025-08-18', ventures: expose.slice(7, 13).map((v) => v.id), createdAt: '2025-07-21T09:00:00.000Z' })

  // Recognition of prior learning: one approved and one declined in A; one approved and one waiting in B.
  const fa = foundersIn(d, a.id)
  const fb = foundersIn(d, b.id)
  const ex = (c: Cohort, f: Founder | undefined, mod: string, on: string, evidence: string, decision: Exemption['decision'], decidedOn?: string) =>
    f && d.exemptions.push({ id: `ex-${c.id}-${f.chiiId}-${mod}`, cohortId: c.id, chiiId: f.chiiId, moduleCode: mod, requestedOn: on, evidence, decision, decidedBy: decision === 'pending' ? undefined : 'Tendai Moyo', decidedOn })
  ex(a, fa[1], 'I1', '2025-02-24', 'Completed a public health problem-framing course; shared the certificate and the problem brief written for it.', 'approved', '2025-02-28')
  ex(a, fa[4], 'I2', '2025-03-20', 'Says they have done user interviews before; no written work shared.', 'declined', '2025-03-24')
  ex(b, fb[2], 'I1', '2025-08-11', 'Earlier brief from the 2024 Hackathon covers problem definition and evidence; reviewed against the I1 criteria.', 'approved', '2025-08-15')
  ex(b, fb[5], 'I3', '2025-10-13', 'Has a prototype tested with 12 users at a clinic; asked to skip I3 and shared the test notes.', 'pending')

  for (const c of [a, b]) {
    d.canvas.mapping[c.id] = suggestMapping(d, c)
    for (const f of foundersIn(d, c.id)) d.canvas.links[canvasIdOf(f.chiiId)] = { chiiId: f.chiiId, matchedBy: 'email', at: `${c.startsOn}T06:00:00.000Z` }
    fillFromCanvas(d, c)
  }
  // Data quality cases: one founder in A has no intake quiz; one in A reached the gate having spoken to no one.
  const noIntake = fa[3]
  if (noIntake) d.results = d.results.filter((r) => !(r.cohortId === a.id && r.chiiId === noIntake.chiiId && r.code === 'QUIZ-intake'))
  if (fa[5]) fa[5].stakeholders = 0
  d.canvas.unmatched[b.id] = [canvasUsers(d, b).slice(-1)[0]]
  d.canvas.runs.push({ id: 'run-1', cohortId: b.id, startedAt: '2025-11-10T02:00:00.000Z', finishedAt: '2025-11-10T02:00:41.000Z', status: 'ok', read: 180, written: 6, unmatched: 1, by: 'Nightly sync' })

  // Gate for cohort A: three ventures decided, the rest waiting.
  const leads = [...new Map(fa.map((f) => [f.ventureId, f])).values()]
  const choices: GateDecision['decision'][] = ['build', 'more_ideation', 'build']
  leads.slice(0, 3).forEach((f, i) =>
    d.gate.push({ id: `gate-${i}`, cohortId: a.id, ventureId: f.ventureId, chiiId: f.chiiId, gate: 'ebi_evidence', decision: choices[i], score: [3.4, 2.4, 3.1][i], decidedBy: 'Tendai Moyo', decidedOn: '2025-06-12', notes: ['Clear problem and evidence; ready to build a first version.', 'Problem still broad. Repeat I2 field work before the next gate.', 'Strong stakeholder evidence; pathway confirmed.'][i] }),
  )

  // Per-module feedback (one per founder per module).
  for (const c of [a, b])
    for (const f of foundersIn(d, c.id))
      for (const m of EXPOSE_MODULES) {
        const last = d.sessions.find((s) => s.cohortId === c.id && s.moduleCode === m && s.no === SESSIONS_PER_MODULE)
        if (!held(last?.date) || hash01(`${c.id}|${f.chiiId}|${m}|fb`) > 0.7) continue
        d.feedback.push({ id: `fb-${c.id}-${f.chiiId}-${m}`, cohortId: c.id, chiiId: f.chiiId, moduleCode: m, rating: 3 + Math.round(hash01(`${f.chiiId}|${m}|r`) * 2), comment: '', at: `${last!.date}T17:00:00.000Z` })
      }

  d.log.push(
    { id: 'l1', at: a.createdAt, by: 'Tendai Moyo', cohortId: a.id, action: 'cohort_created', detail: `${a.name}: 40 sessions from the Expose template` },
    { id: 'l2', at: b.createdAt, by: 'Tendai Moyo', cohortId: b.id, action: 'cohort_created', detail: `${b.name}: 40 sessions from the Expose template` },
  )
  for (const e of d.exemptions.filter((x) => x.decidedOn)) d.log.push({ id: `l-${e.id}`, at: `${e.decidedOn}T10:00:00.000Z`, by: e.decidedBy!, cohortId: e.cohortId, action: `exemption_${e.decision}`, detail: `${e.chiiId} · ${e.moduleCode} exemption ${e.decision}` })
  for (const g of d.gate) d.log.push({ id: `l-${g.id}`, at: `${g.decidedOn}T10:00:00.000Z`, by: g.decidedBy, cohortId: g.cohortId, action: 'gate_decision', detail: `${g.chiiId} · EBI Evidence Gate: ${g.decision}` })
  return d
}

/* ---------- Persistence ---------- */

let cache: IncubationData | null = null
const listeners = new Set<() => void>()
/** "Incubation" was renamed "Incubator": rename cohorts saved before. */
const renamed = (d: IncubationData): IncubationData => ({ ...d, cohorts: d.cohorts.map((c) => (/^Incubation /.test(c.name) ? { ...c, name: c.name.replace(/^Incubation /, 'Incubator ') } : c)) })
function load(): IncubationData {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? renamed(JSON.parse(raw) as IncubationData) : seedIncubation()
  } catch {
    cache = seedIncubation()
  }
  return cache
}
function persist(next: IncubationData) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* keep in memory */
  }
  listeners.forEach((l) => l())
}
export const getIncubation = load
export const useIncubation = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), load, load)
export function resetIncubation() {
  persist(seedIncubation())
}

const logged = (d: IncubationData, by: string, action: string, detail: string, cohortId?: string): IncLog[] => [{ id: uid('l'), at: nowIso(), by, cohortId, action, detail }, ...d.log]

export class IncubationError extends Error {}

/* ---------- Cohorts ---------- */

export type CohortInput = { name: string; stage: IncStage; startsOn: string; fillDates: boolean; threshold: number; canvas: Cohort['canvas'] }

/** Rule 1: an Expose cohort gets its 40 sessions from the curriculum template. */
export function createCohort(x: CohortInput, by: string): Cohort {
  const d = load()
  const name = x.name.trim()
  if (!name) throw new IncubationError('Give the cohort a name, e.g. “Incubator 2027 A: Expose”.')
  if (d.cohorts.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new IncubationError(`There’s already a cohort called “${name}”.`)
  if (!x.startsOn) throw new IncubationError('Choose the start date.')
  if (!(x.threshold > 0 && x.threshold <= 1)) throw new IncubationError('The completion threshold should be between 1% and 100%.')
  const id = uid('coh')
  const tmpl = x.stage === 'expose' ? d.curriculum.sessions : []
  const dates = x.fillDates ? scheduleDates(x.startsOn, tmpl.length) : []
  const sessions: ClassSession[] = tmpl.map((s, i) => ({ id: `${id}-${s.moduleCode}-${s.no}`, cohortId: id, moduleCode: s.moduleCode, no: s.no, title: s.title, date: dates[i], present: [] }))
  const cohort: Cohort = { id, name, stage: x.stage, startsOn: x.startsOn, endsOn: dates[dates.length - 1], canvas: x.canvas, threshold: x.threshold, curriculumVersion: x.stage === 'expose' ? d.curriculum.version : undefined, createdBy: by, createdAt: nowIso() }
  persist({
    ...d,
    cohorts: [...d.cohorts, cohort],
    sessions: [...d.sessions, ...sessions],
    canvas: { ...d.canvas, mapping: { ...d.canvas.mapping, [id]: {} } },
    log: logged(d, by, 'cohort_created', `${name}: ${sessions.length ? `${sessions.length} sessions from the ${x.stage === 'expose' ? 'Expose' : ''} template` : 'no curriculum yet'}`, id),
  })
  return cohort
}

export function updateCohort(id: string, patch: Partial<Pick<Cohort, 'name' | 'threshold' | 'canvas'>>, by: string) {
  const d = load()
  persist({ ...d, cohorts: d.cohorts.map((c) => (c.id === id ? { ...c, ...patch } : c)), log: logged(d, by, 'cohort_edited', `Changed ${Object.keys(patch).join(', ')}`, id) })
}

export function deleteCohort(id: string, by: string) {
  const d = load()
  const c = d.cohorts.find((x) => x.id === id)
  if (!c) return
  if (d.founders.some((f) => f.cohortId === id)) throw new IncubationError('This cohort has founders. Remove them first, or keep the cohort.')
  persist({ ...d, cohorts: d.cohorts.filter((x) => x.id !== id), sessions: d.sessions.filter((s) => s.cohortId !== id), log: logged(d, by, 'cohort_deleted', c.name) })
}

/* ---------- Sessions: dates, attendance, delivery log ---------- */

export function setSessionDate(sessionId: string, date: string | undefined) {
  const d = load()
  const sessions = d.sessions.map((s) => (s.id === sessionId ? { ...s, date: date || undefined } : s))
  const s = sessions.find((x) => x.id === sessionId)
  const dates = s ? sessions.filter((x) => x.cohortId === s.cohortId).map((x) => x.date).filter(Boolean) as string[] : []
  persist({ ...d, sessions, cohorts: d.cohorts.map((c) => (s && c.id === s.cohortId && dates.length ? { ...c, startsOn: dates.reduce((a, b) => (a < b ? a : b)), endsOn: dates.reduce((a, b) => (a > b ? a : b)) } : c)) })
}

/** Shift every date from a session on by the same number of days (for a rescheduled week). */
export function shiftDates(cohortId: string, fromSessionId: string, byDays: number) {
  const d = load()
  const ss = cohortSessions(d, cohortId)
  const from = ss.findIndex((s) => s.id === fromSessionId)
  const ids = new Set(ss.slice(from).map((s) => s.id))
  persist({ ...d, sessions: d.sessions.map((s) => (ids.has(s.id) && s.date ? { ...s, date: addDays(s.date, byDays) } : s)) })
}

export function setAttendance(sessionId: string, present: string[]) {
  const d = load()
  persist({ ...d, sessions: d.sessions.map((s) => (s.id === sessionId ? { ...s, present: [...new Set(present)] } : s)) })
}

export function logDelivery(sessionId: string, log: Omit<DeliveryLog, 'loggedBy' | 'loggedAt'>, by: string) {
  const d = load()
  if (log.durationMin != null && (log.durationMin < 0 || log.durationMin > 480)) throw new IncubationError('Duration should be in minutes, up to 480.')
  if ((log.delivered === 'changed' || log.delivered === 'skipped') && !log.changes.trim()) throw new IncubationError('Say what changed and why.')
  persist({ ...d, sessions: d.sessions.map((s) => (s.id === sessionId ? { ...s, delivery: { ...log, loggedBy: by, loggedAt: nowIso() } } : s)) })
}

/* ---------- Founders ---------- */

export function addFounders(cohortId: string, rows: { chiiId: string; ventureId?: string; pathway?: Pathway }[], by: string) {
  const d = load()
  const fresh = rows.filter((r) => !d.founders.some((f) => f.cohortId === cohortId && f.chiiId === r.chiiId))
  if (!fresh.length) throw new IncubationError('They’re already in this cohort.')
  const c = d.cohorts.find((x) => x.id === cohortId)!
  persist({
    ...d,
    founders: [...d.founders, ...fresh.map((r): Founder => ({ cohortId, chiiId: r.chiiId, ventureId: r.ventureId, pathway: r.pathway, status: 'enrolled', joinedOn: c.startsOn > TODAY ? c.startsOn : TODAY }))],
    log: logged(d, by, 'founders_added', `${fresh.length} founder${fresh.length === 1 ? '' : 's'} added`, cohortId),
  })
}

export function updateFounder(cohortId: string, chiiId: string, patch: Partial<Omit<Founder, 'cohortId' | 'chiiId'>>, by: string) {
  const d = load()
  if (patch.stakeholders != null && (patch.stakeholders < 0 || !Number.isInteger(patch.stakeholders))) throw new IncubationError('Stakeholders spoken to should be a whole number, 0 or more.')
  persist({ ...d, founders: d.founders.map((f) => (f.cohortId === cohortId && f.chiiId === chiiId ? { ...f, ...patch } : f)), log: patch.status ? logged(d, by, `founder_${patch.status}`, `${chiiId} ${patch.status}`, cohortId) : d.log })
}

/* ---------- Results (gradebook) ---------- */

export function saveResult(x: { cohortId: string; code: string; chiiId: string; scores: Record<number, number>; score?: number; submittedAt?: string; dueAt?: string; reviewer?: string }, by: string, source: ResultSource = 'staff') {
  const d = load()
  const a = d.curriculum.assessments.find((y) => y.code === x.code)
  if (!a) throw new IncubationError('Unknown assessment.')
  if (!d.founders.some((f) => f.cohortId === x.cohortId && f.chiiId === x.chiiId)) throw new IncubationError(`${x.chiiId} isn’t in this cohort.`)
  if (Object.values(x.scores).some((s) => !Number.isInteger(s) || s < 1 || s > d.curriculum.scaleMax)) throw new IncubationError(`Rubric scores go from 1 to ${d.curriculum.scaleMax}.`)
  if (x.score != null && (x.score < 0 || (a.maxScore != null && x.score > a.maxScore))) throw new IncubationError(`The score should be between 0 and ${a.maxScore}.`)
  const cur = d.results.find((r) => r.cohortId === x.cohortId && r.code === x.code && r.chiiId === x.chiiId)
  const next: Result = { ...(cur ?? { id: uid('res'), cohortId: x.cohortId, code: x.code, chiiId: x.chiiId }), scores: x.scores, score: x.score, submittedAt: x.submittedAt || undefined, dueAt: x.dueAt, reviewer: x.reviewer ?? by, source }
  persist({ ...d, results: cur ? d.results.map((r) => (r.id === cur.id ? next : r)) : [...d.results, next], log: logged(d, by, 'result_saved', `${x.chiiId} · ${x.code}`, x.cohortId) })
  return next
}

export function deleteResult(id: string, by: string) {
  const d = load()
  const r = d.results.find((x) => x.id === id)
  if (!r) return
  persist({ ...d, results: d.results.filter((x) => x.id !== id), log: logged(d, by, 'result_deleted', `${r.chiiId} · ${r.code}`, r.cohortId) })
}

/** Gradebook CSV / Canvas export: rows of CHII ID or email, then one column per assessment code. */
export function importResults(cohortId: string, rows: { who: string; code: string; value: number; submittedAt?: string }[], by: string) {
  const d = load()
  const c = d.cohorts.find((x) => x.id === cohortId)!
  const people = allPeople()
  let written = 0
  const skipped: string[] = []
  let results = [...d.results]
  for (const row of rows) {
    const chiiId = /^CHII-/i.test(row.who) ? row.who.toUpperCase() : people.find((p) => p.email?.toLowerCase() === row.who.toLowerCase())?.chiiId
    const a = d.curriculum.assessments.find((y) => y.code === row.code)
    if (!chiiId || !d.founders.some((f) => f.cohortId === cohortId && f.chiiId === chiiId)) {
      skipped.push(`${row.who}: not a founder in this cohort`)
      continue
    }
    if (!a) {
      skipped.push(`${row.code}: not an assessment`)
      continue
    }
    const isScore = a.kind === 'skills_quiz' || a.kind === 'confidence_survey'
    if (isScore ? row.value < 0 || (a.maxScore != null && row.value > a.maxScore) : row.value < 1 || row.value > d.curriculum.scaleMax) {
      skipped.push(`${row.who} · ${row.code}: ${row.value} is out of range`)
      continue
    }
    const crit = d.curriculum.criteria[a.moduleCode ?? ''] ?? []
    const value = isScore ? { scores: {}, score: row.value } : { scores: Object.fromEntries(crit.map((_, i) => [i, Math.round(row.value)])), score: undefined }
    const cur = results.find((r) => r.cohortId === cohortId && r.code === row.code && r.chiiId === chiiId)
    const next: Result = { ...(cur ?? { id: uid('res'), cohortId, code: row.code, chiiId }), ...value, submittedAt: row.submittedAt ?? cur?.submittedAt ?? TODAY, dueAt: assessmentDue(d, c, row.code), source: 'import', reviewer: by }
    results = cur ? results.map((r) => (r.id === cur.id ? next : r)) : [...results, next]
    written++
  }
  persist({ ...d, results, log: logged(d, by, 'results_imported', `${written} result${written === 1 ? '' : 's'} imported`, cohortId) })
  return { written, skipped }
}

/* ---------- Exemptions (prior learning) ---------- */

export function requestExemption(x: { cohortId: string; chiiId: string; moduleCode: string; requestedOn: string; evidence: string }, by: string) {
  const d = load()
  if (!x.evidence.trim()) throw new IncubationError('Say what they showed as evidence.')
  if (d.exemptions.some((e) => e.cohortId === x.cohortId && e.chiiId === x.chiiId && e.moduleCode === x.moduleCode)) throw new IncubationError(`There’s already a ${x.moduleCode} request for this founder.`)
  const e: Exemption = { ...x, id: uid('ex'), decision: 'pending' }
  persist({ ...d, exemptions: [...d.exemptions, e], log: logged(d, by, 'exemption_requested', `${x.chiiId} · ${x.moduleCode} exemption requested`, x.cohortId) })
  return e
}

/** Rule 10: only approved exemptions count; every decision goes in the status history. */
export function decideExemption(id: string, decision: 'approved' | 'declined' | 'pending', by: string) {
  const d = load()
  const e = d.exemptions.find((x) => x.id === id)
  if (!e) return
  const next: Exemption = decision === 'pending' ? { ...e, decision, decidedBy: undefined, decidedOn: undefined } : { ...e, decision, decidedBy: by, decidedOn: TODAY }
  persist({ ...d, exemptions: d.exemptions.map((x) => (x.id === id ? next : x)), log: logged(d, by, `exemption_${decision}`, `${e.chiiId} · ${e.moduleCode} exemption ${decision === 'pending' ? 'reopened' : decision}`, e.cohortId) })
}

/* ---------- Module feedback ---------- */

/** One response per founder per module. */
export function addModuleFeedback(x: Omit<ModuleFeedback, 'id' | 'at'>) {
  const d = load()
  if (d.feedback.some((f) => f.cohortId === x.cohortId && f.chiiId === x.chiiId && f.moduleCode === x.moduleCode)) throw new IncubationError(`This founder has already given feedback on ${x.moduleCode}.`)
  persist({ ...d, feedback: [...d.feedback, { ...x, id: uid('fb'), at: nowIso() }] })
}

/* ---------- Gate ---------- */

export type GateInput = { cohortId: string; chiiId: string; ventureId?: string; decision: GateDecision['decision']; score?: number; decidedOn: string; nextCohortId?: string; notes: string }

/** Rule 8: one decision per venture per gate. "Build" needs the Build cohort once one exists. */
export function decideGate(x: GateInput, by: string) {
  const d = load()
  const builds = d.cohorts.filter((c) => c.stage === 'build')
  if (x.decision === 'build' && builds.length && !x.nextCohortId) throw new IncubationError('Choose the Build cohort they join.')
  if (x.score != null && (x.score < 0 || x.score > d.curriculum.scaleMax)) throw new IncubationError(`The portfolio score goes from 0 to ${d.curriculum.scaleMax}.`)
  if (!x.decidedOn) throw new IncubationError('Add the decision date.')
  const cur = d.gate.find((g) => g.cohortId === x.cohortId && (x.ventureId ? g.ventureId === x.ventureId : g.chiiId === x.chiiId))
  const next: GateDecision = { ...(cur ?? { id: uid('gate'), gate: 'ebi_evidence' as const }), ...x, nextCohortId: x.decision === 'build' ? x.nextCohortId : undefined, decidedBy: by }
  let founders = d.founders
  if (next.nextCohortId) {
    const team = d.founders.filter((f) => f.cohortId === x.cohortId && (x.ventureId ? f.ventureId === x.ventureId : f.chiiId === x.chiiId) && f.status === 'enrolled')
    const joining = team.filter((f) => !d.founders.some((g) => g.cohortId === next.nextCohortId && g.chiiId === f.chiiId))
    founders = [...founders, ...joining.map((f): Founder => ({ cohortId: next.nextCohortId!, chiiId: f.chiiId, ventureId: f.ventureId, pathway: f.pathway, status: 'enrolled', joinedOn: x.decidedOn }))]
  }
  persist({ ...d, founders, gate: cur ? d.gate.map((g) => (g.id === cur.id ? next : g)) : [...d.gate, next], log: logged(d, by, 'gate_decision', `${x.chiiId} · EBI Evidence Gate: ${x.decision}${cur ? ' (changed)' : ''}`, x.cohortId) })
  // The venture's registry track follows them into Build.
  if (next.nextCohortId && x.ventureId) {
    try {
      editVenture(x.ventureId, { track: 'Incubator – Build' }, by)
    } catch {
      /* registry rules failed for an unrelated field; the gate decision still stands */
    }
  }
  return next
}

/** Rule 9: the I4 snapshot adds a dated venture update; earlier updates are never changed. */
export function recordSnapshot(cohortId: string, ventureId: string, asOf: string, by: string) {
  const reg = getRegistry()
  const last = acceptedUpdates(reg, ventureId, asOf).slice(-1)[0]
  if (!last) throw new IncubationError('This venture has no baseline in the registry yet.')
  if (reg.updates.some((u) => u.ventureId === ventureId && u.source === 'incubation_snapshot' && u.asOf === asOf)) throw new IncubationError('A snapshot for this date is already recorded.')
  const { id: _i, ventureId: _v, updateType: _t, source: _s, fundingUsd: _f, revenueUsd: _r, submittedBy: _b, acceptedBy: _a, acceptedAt: _at, ...values } = last
  addUpdate(ventureId, { ...values, asOf, notes: 'Incubator I4 snapshot (Expose)' }, by, 'incubation_snapshot')
  const d = load()
  persist({ ...d, log: logged(d, by, 'snapshot', `${ventureId} · I4 snapshot as of ${asOf}`, cohortId) })
}
export const snapshotsOf = (ventureId: string) => getRegistry().updates.filter((u) => u.ventureId === ventureId && u.source === 'incubation_snapshot')

/* ---------- Canvas sync ---------- */

export function setCanvasCourses(cohortId: string, canvas: Cohort['canvas'], by: string) {
  updateCohort(cohortId, { canvas }, by)
}

export function setMapping(cohortId: string, mapping: Record<string, string>, by: string) {
  const d = load()
  const codes = Object.values(mapping).filter(Boolean)
  const dup = codes.find((c, i) => codes.indexOf(c) !== i)
  if (dup) throw new IncubationError(`${dup} is mapped to two Canvas items. Each assessment takes one.`)
  persist({ ...d, canvas: { ...d.canvas, mapping: { ...d.canvas.mapping, [cohortId]: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)) } }, log: logged(d, by, 'canvas_mapping', `${codes.length} Canvas items mapped`, cohortId) })
}

/** Match a Canvas user to a CHII ID by hand (stored on the CHII side only). */
export function matchCanvasUser(cohortId: string, canvasId: string, chiiId: string, by: string) {
  const d = load()
  persist({
    ...d,
    canvas: { ...d.canvas, links: { ...d.canvas.links, [canvasId]: { chiiId, matchedBy: 'staff', at: nowIso() } }, unmatched: { ...d.canvas.unmatched, [cohortId]: (d.canvas.unmatched[cohortId] ?? []).filter((u) => u.canvasId !== canvasId) } },
    log: logged(d, by, 'canvas_match', `Canvas user ${canvasId} matched to ${chiiId}`, cohortId),
  })
}
export function ignoreCanvasUser(cohortId: string, canvasId: string, by: string) {
  const d = load()
  persist({ ...d, canvas: { ...d.canvas, unmatched: { ...d.canvas.unmatched, [cohortId]: (d.canvas.unmatched[cohortId] ?? []).filter((u) => u.canvasId !== canvasId) }, links: { ...d.canvas.links, [canvasId]: { chiiId: '', matchedBy: 'staff', at: nowIso() } } }, log: logged(d, by, 'canvas_ignore', `Canvas user ${canvasId} marked as not a founder`, cohortId) })
}

/** Pull enrolments and submissions from Canvas (the stand-in), match people by email, upsert results. */
export function runSync(cohortId: string, by: string): SyncRun {
  const d = load()
  const c = d.cohorts.find((x) => x.id === cohortId)
  const startedAt = nowIso()
  if (!c) throw new IncubationError('Cohort not found.')
  const links = { ...d.canvas.links }
  const people = allPeople()
  const unmatched: CanvasUser[] = []
  const users = canvasUsers(d, c)
  for (const u of users) {
    if (links[u.canvasId]) continue
    const p = people.find((x) => x.email && x.email.toLowerCase() === u.email.toLowerCase())
    if (p) links[u.canvasId] = { chiiId: p.chiiId, matchedBy: 'email', at: startedAt }
    else unmatched.push(u)
  }
  const mapping = d.canvas.mapping[cohortId] ?? {}
  let read = 0
  let written = 0
  let results = [...d.results]
  for (const x of canvasAssignments(d, c)) {
    const code = mapping[x.id]
    if (!code || !x.dueAt || x.dueAt > TODAY) continue
    for (const u of users) {
      read++
      const chiiId = links[u.canvasId]?.chiiId
      if (!chiiId || !d.founders.some((f) => f.cohortId === cohortId && f.chiiId === chiiId && f.status === 'enrolled')) continue
      const a = d.curriculum.assessments.find((y) => y.code === code)
      if (a?.moduleCode && isExempt(d, cohortId, chiiId, a.moduleCode)) continue
      const s = canvasSubmission(d, c, chiiId, code, x.dueAt)
      if (!s) continue
      const cur = results.find((r) => r.cohortId === cohortId && r.code === code && r.chiiId === chiiId)
      if (cur && cur.source !== 'canvas') continue // staff and imported entries win
      const next: Result = { ...(cur ?? { id: uid('res'), cohortId, code, chiiId }), source: 'canvas', canvasSubmissionId: `sub-${x.id}-${u.canvasId}`, ...s }
      if (cur && JSON.stringify({ ...cur, id: '' }) === JSON.stringify({ ...next, id: '' })) continue
      results = cur ? results.map((r) => (r.id === cur.id ? next : r)) : [...results, next]
      written++
    }
  }
  const run: SyncRun = { id: uid('run'), cohortId, startedAt, finishedAt: nowIso(), status: 'ok', read, written, unmatched: unmatched.length, by }
  persist({ ...d, results, canvas: { ...d.canvas, links, unmatched: { ...d.canvas.unmatched, [cohortId]: unmatched }, runs: [run, ...d.canvas.runs] }, log: logged(d, by, 'canvas_sync', `Canvas sync: ${written} written, ${unmatched.length} unmatched`, cohortId) })
  return run
}

/* ---------- Curriculum template ---------- */

export function saveCurriculum(next: Curriculum, by: string, newVersion?: string) {
  const d = load()
  const version = newVersion?.trim() || next.version
  persist({ ...d, curriculum: { ...next, version, updatedBy: by, updatedAt: nowIso() }, log: logged(d, by, 'curriculum_saved', `Curriculum ${version} saved${newVersion ? ' as a new version' : ''}`) })
}

/** HENT people who could join a cohort: the registry's founders first, then HENT participants. */
export function candidateFounders() {
  const reg = getRegistry()
  const seen = new Set<string>()
  const out: { chiiId: string; name: string; ventureId?: string; venture?: string }[] = []
  for (const v of reg.ventures)
    for (const m of foundersOf(reg, v.id)) {
      if (seen.has(m.chiiId)) continue
      seen.add(m.chiiId)
      out.push({ chiiId: m.chiiId, name: personById(m.chiiId)?.name ?? m.chiiId, ventureId: v.id, venture: v.name })
    }
  for (const p of participants.filter((x) => x.pillars.includes('HENT')))
    if (!seen.has(p.id)) {
      seen.add(p.id)
      out.push({ chiiId: p.id, name: p.name })
    }
  return out
}

export { moduleWork }
