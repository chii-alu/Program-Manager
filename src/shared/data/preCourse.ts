/**
 * SIE pre-internship course, synced from Canvas.
 *
 * Each SIE cohort has its own Canvas course; only the students selected for the cohort are enrolled.
 * The app pulls, per student: module progress, assignments (submitted, on time, grade), quiz scores
 * and when they were last active. Finishing the course is required before the internship starts,
 * so anyone not done by the "complete by" date is flagged.
 *
 * Canvas isn't connected yet: `canvasFeed` stands in for the Canvas API with fixed, repeatable data
 * (so re-running a sync changes nothing). Students are matched by the email they use on Canvas; the
 * CHII ID is never written to Canvas. Module and assignment names come from Canvas, so the sample
 * uses plain numbered names rather than made-up course content.
 */
import { useSyncExternalStore } from 'react'
import { participants } from './mela'
import { applicantsOf } from './worksheets'
import type { SessionRun } from './sessionStore'
import { TODAY as TODAY_DATE } from '../lib/time'

export const TODAY = `${TODAY_DATE.getFullYear()}-${String(TODAY_DATE.getMonth() + 1).padStart(2, '0')}-${String(TODAY_DATE.getDate()).padStart(2, '0')}`

/** Only SIE has a pre-internship course. */
export const hasPreCourse = (intervention: string) => intervention === 'SIE'

export type CourseItem = { id: string; name: string; kind: 'module' | 'assignment' | 'quiz'; dueAt?: string; points?: number }

export type StudentProgress = {
  chiiId: string
  canvasId: string
  modulesDone: string[]
  /** Assignment id → submission. */
  assignments: Record<string, { submittedAt?: string; grade?: number }>
  /** Quiz id → score (0–points). */
  quizzes: Record<string, number>
  lastActive?: string
}

export type CanvasPerson = { canvasId: string; name: string; email: string }
export type CourseSync = { id: string; at: string; by: string; read: number; written: number; unmatched: number }

export type PreCourse = {
  sessionId: string
  courseId: string
  startsOn: string
  /** Everyone must finish by this date (the internship start). */
  completeBy: string
  items: CourseItem[]
  progress: Record<string, StudentProgress>
  unmatched: CanvasPerson[]
  /** Canvas user ID → CHII ID ('' = not a student). */
  links: Record<string, string>
  runs: CourseSync[]
}

/* ---------- Helpers ---------- */

function hash01(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const addDays = (iso: string, k: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + k)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000)
const canvasIdOf = (chiiId: string) => String(200000 + Math.floor(hash01(`pre|${chiiId}`) * 799999))

/** Students selected for the cohort (the same rule the Applications tab starts from). */
export const selectedOf = (s: SessionRun) => applicantsOf(s).filter((a) => a.score != null && a.score >= 16).map((a) => a.person)

/** The course outline as Canvas lists it: 6 modules, 3 assignments, 2 quizzes, spread over the course. */
export function courseOutline(sessionId: string, startsOn: string, completeBy: string): CourseItem[] {
  const span = Math.max(14, daysBetween(startsOn, completeBy))
  const at = (f: number) => addDays(startsOn, Math.round(span * f))
  const base = 30000 + Math.floor(hash01(sessionId) * 9000)
  return [
    ...[1, 2, 3, 4, 5, 6].map((k): CourseItem => ({ id: `m${base + k}`, name: `Module ${k}`, kind: 'module', dueAt: at(k / 6) })),
    ...[1, 2, 3].map((k): CourseItem => ({ id: `a${base + 10 + k}`, name: `Assignment ${k}`, kind: 'assignment', dueAt: at((k * 2) / 6), points: 10 })),
    ...[1, 2].map((k): CourseItem => ({ id: `q${base + 20 + k}`, name: `Quiz ${k}`, kind: 'quiz', dueAt: at((k * 3) / 6), points: 10 })),
  ]
}

/* ---------- Canvas stand-in ---------- */

/** Who's enrolled on the Canvas course: the selected students, plus one CHII can't match (sample). */
export function canvasRoster(s: SessionRun): CanvasPerson[] {
  return [
    ...selectedOf(s).map((p) => ({ canvasId: canvasIdOf(p.id), name: p.name, email: p.email })),
    { canvasId: canvasIdOf(`${s.id}-guest`), name: 'Nadia Hassan (sample)', email: `nadia.h${s.id}@yahoo.com` },
  ]
}

/** One student's progress as Canvas reports it on a day: fixed, so a second sync writes nothing. */
function canvasProgress(c: PreCourse, chiiId: string, on: string): Omit<StudentProgress, 'chiiId' | 'canvasId'> {
  const pace = 0.55 + hash01(`${chiiId}|pace`) * 0.6 // < 1 falls behind
  const quiet = hash01(`${chiiId}|quiet`) < 0.12 // stopped logging in
  const elapsed = Math.max(0, daysBetween(c.startsOn, on))
  const reach = quiet ? Math.min(elapsed, 6) : elapsed
  const span = Math.max(14, daysBetween(c.startsOn, c.completeBy))
  const share = Math.min(1, (reach / span) * pace * 1.35)
  const modules = c.items.filter((i) => i.kind === 'module')
  const modulesDone = modules.slice(0, Math.floor(share * modules.length + 1e-9)).map((m) => m.id)
  const assignments: StudentProgress['assignments'] = {}
  const quizzes: StudentProgress['quizzes'] = {}
  for (const it of c.items.filter((i) => i.kind !== 'module')) {
    const due = it.dueAt!
    const reached = daysBetween(c.startsOn, due) <= reach * pace * 1.35 + 1
    if (!reached || due > on) continue
    const r = hash01(`${chiiId}|${it.id}`)
    if (it.kind === 'assignment') {
      if (r < 0.08) continue
      const late = r > 0.86
      assignments[it.id] = { submittedAt: late ? addDays(due, 1 + Math.floor(r * 3)) : addDays(due, -1), grade: Math.round(5 + hash01(`${chiiId}|${it.id}|g`) * 5) }
    } else quizzes[it.id] = Math.round(4 + hash01(`${chiiId}|${it.id}|q`) * 6)
  }
  const lastActive = elapsed === 0 ? undefined : addDays(c.startsOn, quiet ? Math.min(elapsed, 6) : Math.max(0, elapsed - Math.floor(hash01(`${chiiId}|seen`) * 3)))
  return { modulesDone, assignments, quizzes, lastActive }
}

/* ---------- Store ---------- */

const KEY = 'mela-precourse-v1'
type State = Record<string, PreCourse>
let cache: State | null = null
const listeners = new Set<() => void>()
function load(): State {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || '{}') as State
  } catch {
    cache = {}
  }
  return cache
}
function persist(next: State) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* keep in memory */
  }
  listeners.forEach((l) => l())
}
export const usePreCourses = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), load, load)
export const getPreCourses = load
export function resetPreCourses() {
  persist({})
}

/** The cohort's course, set up with sample defaults the first time it's opened. */
export function courseFor(s: SessionRun, state: State = load()): PreCourse {
  const cur = state[s.id]
  if (cur) return cur
  const startsOn = s.startDate ?? addDays(TODAY, -21)
  const completeBy = s.endDate ?? addDays(TODAY, 35)
  return { sessionId: s.id, courseId: '', startsOn, completeBy, items: courseOutline(s.id, startsOn, completeBy), progress: {}, unmatched: [], links: {}, runs: [] }
}

export class PreCourseError extends Error {}

export function saveCourseSettings(s: SessionRun, patch: Partial<Pick<PreCourse, 'courseId' | 'startsOn' | 'completeBy'>>) {
  const cur = courseFor(s)
  const next = { ...cur, ...patch }
  if (next.completeBy < next.startsOn) throw new PreCourseError('“Complete by” can’t be before the course starts.')
  const datesChanged = next.startsOn !== cur.startsOn || next.completeBy !== cur.completeBy
  persist({ ...load(), [s.id]: { ...next, items: datesChanged ? courseOutline(s.id, next.startsOn, next.completeBy) : next.items } })
}

/** Pull enrolments and progress from Canvas, match by email, and update each student's record. */
export function syncCourse(s: SessionRun, by: string, on = TODAY): CourseSync {
  const c = courseFor(s)
  const roster = canvasRoster(s)
  const links = { ...c.links }
  const unmatched: CanvasPerson[] = []
  const chosen = new Set(selectedOf(s).map((p) => p.id))
  for (const u of roster) {
    if (u.canvasId in links) continue
    // Email match; if two records share an email, the one selected for this cohort wins.
    const hits = participants.filter((x) => x.email.toLowerCase() === u.email.toLowerCase())
    const p = hits.find((x) => chosen.has(x.id)) ?? hits[0]
    if (p) links[u.canvasId] = p.id
    else unmatched.push(u)
  }
  const progress = { ...c.progress }
  let written = 0
  for (const u of roster) {
    const chiiId = links[u.canvasId]
    if (!chiiId) continue
    const next: StudentProgress = { chiiId, canvasId: u.canvasId, ...canvasProgress(c, chiiId, on) }
    if (JSON.stringify(progress[chiiId]) !== JSON.stringify(next)) {
      progress[chiiId] = next
      written++
    }
  }
  const run: CourseSync = { id: `sync-${Date.now().toString(36)}`, at: new Date().toISOString(), by, read: roster.length * c.items.length, written, unmatched: unmatched.length }
  persist({ ...load(), [s.id]: { ...c, links, unmatched, progress, runs: [run, ...c.runs].slice(0, 30) } })
  return run
}

export function matchStudent(s: SessionRun, canvasId: string, chiiId: string) {
  const c = courseFor(s)
  persist({ ...load(), [s.id]: { ...c, links: { ...c.links, [canvasId]: chiiId }, unmatched: c.unmatched.filter((u) => u.canvasId !== canvasId) } })
}
export function dismissStudent(s: SessionRun, canvasId: string) {
  const c = courseFor(s)
  persist({ ...load(), [s.id]: { ...c, links: { ...c.links, [canvasId]: '' }, unmatched: c.unmatched.filter((u) => u.canvasId !== canvasId) } })
}

/* ---------- Rules ---------- */

export type CourseStatus = 'complete' | 'on_track' | 'behind' | 'inactive' | 'not_started' | 'not_complete' | 'not_synced'
export const STATUS_LABEL: Record<CourseStatus, string> = {
  complete: 'Complete',
  on_track: 'On track',
  behind: 'Behind',
  inactive: 'Inactive 7+ days',
  not_started: 'Not started',
  not_complete: 'Not complete',
  not_synced: 'Not synced yet',
}

/** Days without opening the course before a student is flagged. */
export const INACTIVE_DAYS = 7

export function studentSummary(c: PreCourse, p: StudentProgress | undefined, on = TODAY) {
  const modules = c.items.filter((i) => i.kind === 'module')
  const assignments = c.items.filter((i) => i.kind === 'assignment')
  const quizzes = c.items.filter((i) => i.kind === 'quiz')
  const share = p ? p.modulesDone.length / modules.length : 0
  // Where they should be by now: modules whose due date has passed.
  const expected = modules.filter((m) => m.dueAt! <= on).length / modules.length
  const dueAssignments = assignments.filter((a) => a.dueAt! <= on)
  const submitted = dueAssignments.filter((a) => p?.assignments[a.id]?.submittedAt)
  const late = submitted.filter((a) => p!.assignments[a.id].submittedAt! > a.dueAt!)
  const grades = Object.values(p?.assignments ?? {}).map((x) => x.grade).filter((x): x is number => x != null)
  const quizScores = quizzes.map((q) => p?.quizzes[q.id]).filter((x): x is number => x != null)
  const idle = p?.lastActive ? daysBetween(p.lastActive, on) : null
  const complete = share >= 1
  const status: CourseStatus = !p
    ? 'not_synced'
    : complete
      ? 'complete'
      : on > c.completeBy
        ? 'not_complete'
        : !p.lastActive
          ? 'not_started'
          : idle != null && idle >= INACTIVE_DAYS
            ? 'inactive'
            : share + 1e-9 < expected - 1 / modules.length
              ? 'behind'
              : 'on_track'
  return {
    status,
    share,
    expected,
    modules: { done: p?.modulesDone.length ?? 0, of: modules.length },
    assignments: { submitted: submitted.length, due: dueAssignments.length, late: late.length, mean: grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null },
    quiz: quizScores.length ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : null,
    idle,
    /** Required before the internship: complete by the deadline. */
    ready: complete,
  }
}
