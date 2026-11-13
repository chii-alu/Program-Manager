/**
 * Interventions activity log: who did what to a pillar's sessions, and when. It records session
 * creation, form status changes, applicant decisions, application scores, attendance and sheet
 * imports. Entries name sessions and staff; they never name participants (a CHII ID at most).
 *
 * Browser-only like the rest of the prototype (localStorage), with sample history so the log
 * isn't empty. A server version would write these from the same actions.
 */
import { useSyncExternalStore } from 'react'
import type { Pillar } from '../data/mela'

export type LogAction =
  | 'session_created'
  | 'session_changed'
  | 'session_deleted'
  | 'form_opened'
  | 'form_closed'
  | 'form_draft'
  | 'applicants_decided'
  | 'application_scored'
  | 'attendance_marked'
  | 'sheet_imported'

export type LogEntry = {
  id: string
  at: string
  by: string
  pillar: Pillar
  action: LogAction
  /** The session (cohort) it concerns, when there is one. */
  session?: string
  detail: string
}

export const ACTION_LABEL: Record<LogAction, string> = {
  session_created: 'Session created',
  session_changed: 'Session changed',
  session_deleted: 'Session deleted',
  form_opened: 'Form opened',
  form_closed: 'Form closed',
  form_draft: 'Form set to draft',
  applicants_decided: 'Applicant decision',
  application_scored: 'Application scored',
  attendance_marked: 'Attendance',
  sheet_imported: 'Sheet imported',
}

const KEY = 'mela-intervention-log-v1'
let cache: LogEntry[] | null = null
const listeners = new Set<() => void>()

const e = (id: string, at: string, by: string, pillar: Pillar, action: LogAction, detail: string, session?: string): LogEntry => ({ id, at, by, pillar, action, detail, session })

/** Sample history for HEMP and HECO (and HENT, so the log works the same if it's turned on there). */
export function seedLog(): LogEntry[] {
  return [
    e('l01', '2025-09-12T09:10:00Z', 'Yusuf Abdi', 'HEMP', 'session_created', 'Created SFH Internship · Cohort 4 (1 Oct – 20 Dec), forms saved as drafts', 'SFH Internship · Cohort 4'),
    e('l02', '2025-09-15T08:30:00Z', 'Grace Wanjiru', 'HEMP', 'form_opened', 'Opened the Application form (SFH4-REG)', 'SFH Internship · Cohort 4'),
    e('l03', '2025-09-28T16:05:00Z', 'Kofi Mensah', 'HEMP', 'application_scored', 'Scored CHII-000561 · 15/20', 'SFH Internship · Cohort 4'),
    e('l04', '2025-09-30T10:00:00Z', 'Grace Wanjiru', 'HEMP', 'form_closed', 'Closed the Application form (SFH4-REG): 64 responses', 'SFH Internship · Cohort 4'),
    e('l05', '2025-10-01T11:20:00Z', 'Yusuf Abdi', 'HEMP', 'applicants_decided', '18 applicants → Selected · offer emails queued', 'SFH Internship · Cohort 4'),
    e('l06', '2025-10-08T07:45:00Z', 'Grace Wanjiru', 'HEMP', 'session_created', 'Created Career Workshop · CV & interview skills (22 Oct), forms saved as drafts', 'Career Workshop · CV & interview skills'),
    e('l07', '2025-10-08T07:50:00Z', 'Grace Wanjiru', 'HEMP', 'form_opened', 'Opened the Registration form (CW-REG)', 'Career Workshop · CV & interview skills'),
    e('l08', '2025-10-14T09:00:00Z', 'Yusuf Abdi', 'HEMP', 'session_created', 'Created SIE Cohort 4 (3 Nov – 15 Dec), forms saved as drafts', 'SIE Cohort 4'),
    e('l09', '2025-10-14T09:05:00Z', 'Yusuf Abdi', 'HEMP', 'form_opened', 'Opened the Application form (SIE4-REG)', 'SIE Cohort 4'),
    e('l10', '2025-10-22T17:30:00Z', 'Grace Wanjiru', 'HEMP', 'attendance_marked', 'Marked 58 present · 22 Oct', 'Career Workshop · CV & interview skills'),
    e('l11', '2025-10-24T10:15:00Z', 'Grace Wanjiru', 'HEMP', 'sheet_imported', 'Imported Career Exposure registrations: 96 rows added, 2 rejected for consent', 'Career Exposure · Kigali'),
    e('l12', '2025-10-28T18:00:00Z', 'Grace Wanjiru', 'HEMP', 'attendance_marked', 'Marked 74 present · 28 Oct', 'Career Exposure · Kigali'),
    e('l13', '2025-11-02T14:40:00Z', 'Kofi Mensah', 'HEMP', 'application_scored', 'Scored CHII-000215 · 17/20', 'SIE Cohort 4'),
    e('l14', '2025-11-05T15:10:00Z', 'Kofi Mensah', 'HEMP', 'application_scored', 'Scored CHII-000341 · 14/20', 'SIE Cohort 4'),
    e('l15', '2025-11-07T12:00:00Z', 'Yusuf Abdi', 'HEMP', 'applicants_decided', '3 applicants → Waitlisted', 'SIE Cohort 4'),
    e('l16', '2025-11-10T09:30:00Z', 'Grace Wanjiru', 'HEMP', 'attendance_marked', 'Marked 186 present · Mon 10 Nov', 'SIE Cohort 4'),
    e('l21', '2025-10-30T10:00:00Z', 'Esi Owusu', 'HECO', 'session_created', 'Created Public Sector Fellowship 2026 (20 Nov – 30 Jan), forms saved as drafts', 'Public Sector Fellowship 2026'),
    e('l22', '2025-10-30T10:10:00Z', 'Esi Owusu', 'HECO', 'form_opened', 'Opened the Application form (PSF2026-REG)', 'Public Sector Fellowship 2026'),
    e('l23', '2025-11-04T13:25:00Z', 'Kofi Mensah', 'HECO', 'application_scored', 'Scored CHII-000317 · 16/20', 'Public Sector Fellowship 2026'),
    e('l24', '2025-11-06T09:45:00Z', 'Esi Owusu', 'HECO', 'session_created', 'Created Exec Course · Health financing (2 Dec), forms saved as drafts', 'Exec Course · Health financing'),
    e('l25', '2025-11-08T16:20:00Z', 'Esi Owusu', 'HECO', 'form_draft', 'Set the Feedback form to draft (PSF2026-FBK)', 'Public Sector Fellowship 2026'),
    e('l31', '2025-10-20T19:00:00Z', 'Tendai Moyo', 'HENT', 'attendance_marked', 'Marked 167 present · 20 Oct', 'HealthTech Hackathon'),
  ]
}

function load(): LogEntry[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as LogEntry[]) : seedLog()
  } catch {
    cache = seedLog()
  }
  return cache
}

function persist(next: LogEntry[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked: keep the in-memory copy */
  }
  listeners.forEach((l) => l())
}

export const getLog = load

export function useLog(): LogEntry[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    load,
    load,
  )
}

/** Record an action. `by` is the signed-in staff member. */
export function logAction(entry: Omit<LogEntry, 'id' | 'at'> & { at?: string }) {
  persist([...load(), { id: `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: entry.at ?? new Date().toISOString(), ...entry }])
}

export function resetLog() {
  persist(seedLog())
}

/** A pillar's entries, newest first. */
export const entriesFor = (all: LogEntry[], pillar: Pillar) => all.filter((x) => x.pillar === pillar).sort((a, b) => b.at.localeCompare(a.at))
