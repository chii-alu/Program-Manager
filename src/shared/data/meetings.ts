/**
 * Attendance by meeting, for selective interventions (SIE, SFH internships, fellowships…).
 *
 * A selective cohort meets on specific occasions (orientation, workshops, site visits, check-ins),
 * so attendance is taken per meeting rather than per calendar day. Each meeting says who's expected:
 * everyone selected for the cohort, or particular people (e.g. one group's site visit).
 * Attendance rates are worked out against the meetings each person was expected at.
 *
 * Browser-only like the rest of the prototype. The first time a cohort is opened, its meetings are
 * set up from its dates with plain names ("Cohort meeting") for staff to rename.
 */
import { useSyncExternalStore } from 'react'
import type { SessionRun } from './sessionStore'
import { applicantsOf } from './worksheets'
import { TODAY as TODAY_DATE } from '../lib/time'

export const TODAY = `${TODAY_DATE.getFullYear()}-${String(TODAY_DATE.getMonth() + 1).padStart(2, '0')}-${String(TODAY_DATE.getDate()).padStart(2, '0')}`

export const MEETING_TYPES = ['Orientation', 'Workshop', 'Site visit', 'Check-in', 'Mentoring', 'Presentation', 'Other'] as const
export type MeetingType = (typeof MEETING_TYPES)[number]

export type Meeting = {
  id: string
  sessionId: string
  title: string
  type: MeetingType
  date: string
  time?: string
  mode: 'In person' | 'Online'
  /** Who's expected: everyone selected, or these CHII IDs. */
  invite: 'all' | string[]
  /** CHII ID → check-in time ("09:12"), or "manual" when ticked by staff. */
  present: Record<string, string>
  createdBy: string
}

/** The people a selective cohort's meetings are for: those selected. */
export const cohortMembers = (s: SessionRun) => applicantsOf(s).filter((a) => a.score != null && a.score >= 16).map((a) => a.person)

export const expectedAt = (m: Meeting, members: string[]) => (m.invite === 'all' ? members : m.invite.filter((id) => members.includes(id)))

/* ---------- Store ---------- */

const KEY = 'mela-meetings-v1'
type State = Record<string, Meeting[]>
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
export const useMeetingsState = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), load, load)
export function resetMeetings() {
  persist({})
}

const SAMPLE_DATES = ['2025-11-03', '2025-11-10', '2025-11-17', '2025-11-24', '2025-12-01', '2025-12-15']
let n = 0
const uid = () => `mt-${Date.now().toString(36)}${(n++).toString(36)}`

/** The cohort's meetings, oldest first. First visit: one per cohort date, the past ones with sample check-ins. */
export function meetingsFor(s: SessionRun, state: State = load()): Meeting[] {
  const cur = state[s.id]
  if (cur) return [...cur].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
  const dates = s.dateList?.length ? s.dateList : s.created ? [] : SAMPLE_DATES
  const members = cohortMembers(s).map((p) => p.id)
  return dates.map((date, i) => ({
    id: `${s.id}-m${i + 1}`,
    sessionId: s.id,
    title: 'Cohort meeting',
    type: 'Workshop' as MeetingType,
    date,
    time: '09:00',
    mode: 'In person' as const,
    invite: 'all' as const,
    // Sample sessions have earlier check-ins; a new session starts with nobody marked.
    present: !s.created && date <= TODAY ? Object.fromEntries(members.filter((_, k) => (k + i) % 5 !== 3).map((id, k) => [id, `08:${String(50 + ((k * 7) % 10)).padStart(2, '0')}`])) : {},
    createdBy: 'Set up from the cohort dates',
  }))
}

const save = (s: SessionRun, list: Meeting[]) => persist({ ...load(), [s.id]: list })

export class MeetingError extends Error {}

export type MeetingInput = Pick<Meeting, 'title' | 'type' | 'date' | 'time' | 'mode' | 'invite'>

function check(x: MeetingInput) {
  if (!x.title.trim()) throw new MeetingError('Give the meeting a name, e.g. “Orientation” or “Site visit: district hospital”.')
  if (!x.date) throw new MeetingError('Choose the date.')
  if (x.invite !== 'all' && !x.invite.length) throw new MeetingError('Choose who’s expected, or pick “Everyone selected”.')
}

export function addMeeting(s: SessionRun, x: MeetingInput, by: string): Meeting {
  check(x)
  const m: Meeting = { ...x, title: x.title.trim(), id: uid(), sessionId: s.id, present: {}, createdBy: by }
  save(s, [...meetingsFor(s), m])
  return m
}

export function updateMeeting(s: SessionRun, id: string, x: MeetingInput) {
  check(x)
  save(
    s,
    meetingsFor(s).map((m) => {
      if (m.id !== id) return m
      // Narrowing who's expected drops check-ins of people no longer invited.
      const keep = x.invite === 'all' ? m.present : Object.fromEntries(Object.entries(m.present).filter(([k]) => (x.invite as string[]).includes(k)))
      return { ...m, ...x, title: x.title.trim(), present: keep }
    }),
  )
}

export function deleteMeeting(s: SessionRun, id: string) {
  save(s, meetingsFor(s).filter((m) => m.id !== id))
}

export function setPresent(s: SessionRun, id: string, chiiIds: string[], on: boolean) {
  save(
    s,
    meetingsFor(s).map((m) => {
      if (m.id !== id) return m
      const present = { ...m.present }
      for (const c of chiiIds) {
        if (on) present[c] = present[c] ?? 'manual'
        else delete present[c]
      }
      return { ...m, present }
    }),
  )
}

/** Each member's attendance across the meetings held so far that they were expected at. */
export function attendanceByPerson(meetings: Meeting[], members: string[], on = TODAY) {
  const held = meetings.filter((m) => m.date <= on)
  return members.map((id) => {
    const expected = held.filter((m) => expectedAt(m, members).includes(id))
    const attended = expected.filter((m) => m.present[id]).length
    return { id, expected: expected.length, attended, rate: expected.length ? attended / expected.length : null }
  })
}
