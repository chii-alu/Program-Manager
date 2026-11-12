/**
 * People and resolveBeneficiary: founders are always people with a CHII ID, never just text.
 *
 * Matching order (VENTURE-REGISTRY-SPEC §2): email, then phone, then student ID. A person who
 * matches none of these gets a new CHII ID. CHII-ID-data-model.md isn't available, so these
 * rules follow the spec's summary; replace them with the full rules when the doc is on hand.
 *
 * The prototype's participants (src/shared/data/mela.ts) are the existing people. People
 * created here are kept in browser storage. Identity stays in this module: analytics only
 * ever receives CHII IDs and flags derived from them.
 */
import { participants } from '../data/mela'
import type { Person } from './types'

const KEY = 'mela-people-v1'

/** Deterministic 0–1 value from a string, so sample attributes are stable between visits. */
function hash01(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

/** Existing people: participants, with a date of birth worked out from their age and a sample disability flag. */
const existing: Person[] = participants.map((p) => ({
  chiiId: p.id,
  name: p.name,
  email: p.email,
  gender: p.gender,
  dob: `${2025 - p.age}-0${1 + Math.floor(hash01(p.id + 'm') * 9)}-15`,
  disability: hash01(p.id + 'd') < 0.07,
}))

let created: Person[] | null = null
function loadCreated(): Person[] {
  if (created) return created
  try {
    created = JSON.parse(localStorage.getItem(KEY) || '[]') as Person[]
  } catch {
    created = []
  }
  return created
}
function persistCreated(next: Person[]) {
  created = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked: keep in memory */
  }
}

export const allPeople = (): Person[] => [...existing, ...loadCreated()]
export const personById = (chiiId: string) => allPeople().find((p) => p.chiiId === chiiId) ?? null

/** CHII programmes a person took part in (the venture page's Interventions tab). */
export function interventionsOf(chiiId: string): string[] {
  return participants.find((p) => p.id === chiiId)?.interventions ?? []
}

const normEmail = (e?: string) => (e ?? '').trim().toLowerCase()
const normPhone = (p?: string) => (p ?? '').replace(/[^\d]/g, '').replace(/^0+/, '')
const normStudent = (s?: string) => (s ?? '').trim().toUpperCase()

export type ResolveInput = { name: string; email?: string; phone?: string; studentId?: string; gender?: Person['gender']; dob?: string; disability?: boolean }
export type ResolveResult = { chiiId: string; matchedOn: 'email' | 'phone' | 'student_id' | null; created: boolean }

export class ResolveError extends Error {}

/**
 * Find the person's CHII ID, or create one. Calling it twice with the same email returns the
 * same CHII ID, so importing a sheet twice never creates duplicate founders.
 */
export function resolveBeneficiary(input: ResolveInput, opts: { create?: boolean } = { create: true }): ResolveResult {
  const email = normEmail(input.email)
  const phone = normPhone(input.phone)
  const student = normStudent(input.studentId)
  if (!email && !phone && !student) throw new ResolveError('Give an email, phone number or student ID so the founder can be matched to a CHII ID.')
  const people = allPeople()
  const byEmail = email ? people.find((p) => normEmail(p.email) === email) : undefined
  if (byEmail) return { chiiId: byEmail.chiiId, matchedOn: 'email', created: false }
  const byPhone = phone ? people.find((p) => p.phone && normPhone(p.phone) === phone) : undefined
  if (byPhone) return { chiiId: byPhone.chiiId, matchedOn: 'phone', created: false }
  const byStudent = student ? people.find((p) => p.studentId && normStudent(p.studentId) === student) : undefined
  if (byStudent) return { chiiId: byStudent.chiiId, matchedOn: 'student_id', created: false }
  if (opts.create === false) return { chiiId: '', matchedOn: null, created: false }

  const next = Math.max(...people.map((p) => Number(p.chiiId.slice(5)) || 0)) + 1
  const person: Person = {
    chiiId: `CHII-${String(next).padStart(6, '0')}`,
    name: input.name.trim(),
    email: email,
    phone: input.phone?.trim() || undefined,
    studentId: student || undefined,
    gender: input.gender ?? 'X',
    dob: input.dob,
    disability: input.disability,
  }
  persistCreated([...loadCreated(), person])
  return { chiiId: person.chiiId, matchedOn: null, created: true }
}

/** Age in whole years on a date (both ISO). Null when the date of birth isn't known. */
export function ageOn(dob: string | undefined, onIso: string): number | null {
  if (!dob) return null
  const [y, m, d] = dob.split('-').map(Number)
  const [Y, M, D] = onIso.split('-').map(Number)
  return Y - y - (M < m || (M === m && D < d) ? 1 : 0)
}

/** Clears created people (tests and the demo reset). */
export function resetPeople() {
  persistCreated([])
}
