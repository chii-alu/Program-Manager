/**
 * Venture Registry storage and write operations.
 *
 * The prototype keeps the registry's tables in browser storage, like the Reports tool. Every
 * write runs the blocking data quality rules first (VEN-01 to VEN-05), updates are appended and
 * never overwritten, and Venture IDs come from a counter that only goes up.
 */
import { useSyncExternalStore } from 'react'
import type { Pillar, Role } from '../data/mela'
import { REPORTING_DATE, acceptedUpdates } from './derive'
import { toUsd } from './lists'
import { resolveBeneficiary, type ResolveInput, type ResolveResult } from './people'
import { validateUpdate, validateVenture } from './quality'
import { defaultSettings, seedRegistry } from './seed'
import type { FundingAward, MemberRole, RegistryData, RegistrySettings, UpdateLink, UpdateSource, Venture, VentureFunding, VentureHistory, VentureSubmission, VentureUpdate } from './types'

const KEY = 'mela-ventures-v1'

/* ---------- Access (spec §1, §6 RLS): HENT staff and MELA admin only ---------- */

export function canUseVentures(viewer: { role: Role; pillars: Pillar[] }) {
  if (viewer.role === 'admin') return true
  if (viewer.role === 'pillar_lead' || viewer.role === 'pillar_staff') return viewer.pillars.includes('HENT')
  return false
}

/* ---------- Persistence ---------- */

let cache: RegistryData | null = null
const listeners = new Set<() => void>()

function load(): RegistryData {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? withFormData(JSON.parse(raw) as RegistryData) : seedRegistry()
  } catch {
    cache = seedRegistry()
  }
  return cache
}

function persist(next: RegistryData) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked: keep the in-memory copy */
  }
  listeners.forEach((l) => l())
}

export const getRegistry = load

export function useRegistry(): RegistryData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    load,
    load,
  )
}

export function resetRegistry() {
  persist(seedRegistry())
}

/* ---------- Writes ---------- */

export class VentureValidationError extends Error {
  constructor(public messages: string[]) {
    super(messages.join(' '))
    this.name = 'VentureValidationError'
  }
}

const now = () => new Date().toISOString()
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const log = (d: RegistryData, ventureId: string, by: string, action: VentureHistory['action'], detail: string): VentureHistory[] => [
  ...d.history,
  { id: uid('h'), ventureId, at: now(), by, action, detail },
]

export type VentureInput = Omit<Venture, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'stage' | 'currentStatus'> & { countries: string[] }
export type UpdateInput = Omit<VentureUpdate, 'id' | 'ventureId' | 'updateType' | 'source' | 'fundingUsd' | 'revenueUsd' | 'submittedBy' | 'acceptedBy' | 'acceptedAt'>
export type FounderInput = { person: ResolveInput; role: MemberRole }

function nameTaken(d: RegistryData, name: string, exceptId?: string) {
  const n = name.trim().toLowerCase()
  return d.ventures.find((v) => v.id !== exceptId && v.name.trim().toLowerCase() === n)
}

function withUsd(u: UpdateInput) {
  return { ...u, fundingUsd: toUsd(u.fundingAmount, u.fundingCurrency), revenueUsd: u.revenueAmount == null || !u.revenueCurrency ? null : toUsd(u.revenueAmount, u.revenueCurrency) }
}

/** Add a venture with its founders and baseline. Founders are matched to (or given) CHII IDs. */
export function createVenture(input: VentureInput, founders: FounderInput[], baseline: UpdateInput, by: string, source: UpdateSource = 'staff') {
  const d = load()
  const problems = [...validateVenture({ ...input, stage: baseline.stage, currentStatus: baseline.status }, input.countries), ...validateUpdate(baseline)]
  const clash = nameTaken(d, input.name)
  if (clash) problems.unshift(`A venture called “${clash.name}” already exists (${clash.code}).`)
  if (problems.length) throw new VentureValidationError(problems)

  const seq = d.seq + 1
  const id = uid('ven')
  const at = now()
  const { countries, ...fields } = input
  const venture: Venture = { ...fields, name: input.name.trim(), id, code: `VEN-${String(seq).padStart(4, '0')}`, stage: baseline.stage, currentStatus: baseline.status, createdAt: at, updatedAt: at }
  const resolved = founders.map((f) => ({ f, r: resolveBeneficiary(f.person) }))
  const members = dedupe(resolved).map(({ f, r }, i) => ({ id: uid('m'), ventureId: id, chiiId: r.chiiId, role: f.role, isPrimary: f.role === 'lead_founder' && i === resolved.findIndex((x) => x.f.role === 'lead_founder'), joinedOn: baseline.asOf, leftOn: null }))
  const update: VentureUpdate = { ...withUsd(baseline), id: uid('u'), ventureId: id, updateType: 'baseline', source, submittedBy: by, acceptedBy: by, acceptedAt: at }
  persist({
    ...d,
    seq,
    ventures: [...d.ventures, venture],
    countries: [...d.countries, ...countries.map((c, i) => ({ ventureId: id, countryCode: c, isPrimary: i === 0 }))],
    members: [...d.members, ...members],
    updates: [...d.updates, update],
    history: log(d, id, by, 'created', `Created with ${members.length} founder${members.length === 1 ? '' : 's'}`),
  })
  return { venture, founders: resolved.map((x) => x.r) }
}

const dedupe = <T extends { r: ResolveResult }>(xs: T[]) => xs.filter((x, i) => xs.findIndex((y) => y.r.chiiId === x.r.chiiId) === i)

/** Edit venture details. Stage and status change through updates, so their history is kept. */
export function editVenture(id: string, patch: Partial<Omit<VentureInput, 'countries'>> & { countries?: string[] }, by: string) {
  const d = load()
  const v = d.ventures.find((x) => x.id === id)
  if (!v) throw new Error('Venture not found')
  const { countries, ...fields } = patch
  const next = { ...v, ...fields, updatedAt: now() }
  const codes = countries ?? d.countries.filter((c) => c.ventureId === id).map((c) => c.countryCode)
  const problems = validateVenture(next, codes)
  const clash = patch.name ? nameTaken(d, patch.name, id) : undefined
  if (clash) problems.unshift(`A venture called “${clash.name}” already exists (${clash.code}).`)
  if (problems.length) throw new VentureValidationError(problems)
  const changed = Object.keys(fields).filter((k) => JSON.stringify((v as Record<string, unknown>)[k]) !== JSON.stringify((fields as Record<string, unknown>)[k]))
  persist({
    ...d,
    ventures: d.ventures.map((x) => (x.id === id ? next : x)),
    countries: countries ? [...d.countries.filter((c) => c.ventureId !== id), ...countries.map((c, i) => ({ ventureId: id, countryCode: c, isPrimary: i === 0 }))] : d.countries,
    history: log(d, id, by, 'edited', `Changed ${[...changed, ...(countries ? ['countries'] : [])].join(', ') || 'nothing'}`),
  })
  return next
}

export function addFounder(ventureId: string, person: ResolveInput, role: MemberRole, by: string, joinedOn = REPORTING_DATE) {
  const d = load()
  const r = resolveBeneficiary(person)
  if (d.members.some((m) => m.ventureId === ventureId && m.chiiId === r.chiiId && !m.leftOn)) throw new VentureValidationError([`${person.name} is already a founder of this venture.`])
  const isPrimary = role === 'lead_founder' && !d.members.some((m) => m.ventureId === ventureId && m.isPrimary && !m.leftOn)
  persist({
    ...d,
    members: [...d.members, { id: uid('m'), ventureId, chiiId: r.chiiId, role, isPrimary, joinedOn, leftOn: null }],
    history: log(d, ventureId, by, 'founder_added', `${role.replace('_', ' ')} ${r.chiiId}${r.created ? ' (new CHII ID)' : ` (matched on ${r.matchedOn?.replace('_', ' ')})`}`),
  })
  return r
}

export function endFounder(memberId: string, leftOn: string, by: string) {
  const d = load()
  const m = d.members.find((x) => x.id === memberId)
  if (!m) return
  persist({ ...d, members: d.members.map((x) => (x.id === memberId ? { ...x, leftOn } : x)), history: log(d, m.ventureId, by, 'founder_removed', `${m.chiiId} left on ${leftOn}`) })
}

/** Add an update. Staff, import and survey updates count at once; founder form updates wait for staff. */
export function addUpdate(ventureId: string, input: UpdateInput, by: string, source: UpdateSource) {
  const d = load()
  const problems = validateUpdate(input)
  if (problems.length) throw new VentureValidationError(problems)
  const pending = source === 'founder_form'
  const at = now()
  const u: VentureUpdate = { ...withUsd(input), id: uid('u'), ventureId, updateType: 'update', source, submittedBy: by, acceptedBy: pending ? null : by, acceptedAt: pending ? null : at }
  persist(syncCurrent({ ...d, updates: [...d.updates, u], history: log(d, ventureId, by, 'update_added', `${pending ? 'Founder update received' : 'Update'} as of ${input.asOf}`) }, ventureId))
  return u
}

export function acceptUpdate(updateId: string, by: string) {
  const d = load()
  const u = d.updates.find((x) => x.id === updateId)
  if (!u || u.acceptedAt) return
  const next = { ...d, updates: d.updates.map((x) => (x.id === updateId ? { ...x, acceptedBy: by, acceptedAt: now() } : x)), history: log(d, u.ventureId, by, 'update_accepted', `Accepted the founder update as of ${u.asOf}`) }
  persist(syncCurrent(next, u.ventureId))
}

/** The venture's current stage and status follow its latest accepted update. */
function syncCurrent(d: RegistryData, ventureId: string): RegistryData {
  const ups = acceptedUpdates(d, ventureId, '9999-12-31')
  const last = ups[ups.length - 1]
  if (!last) return d
  return { ...d, ventures: d.ventures.map((v) => (v.id === ventureId ? { ...v, stage: last.stage, currentStatus: last.status, updatedAt: now() } : v)) }
}

export function addFunding(row: Omit<VentureFunding, 'id' | 'amountUsd'>, by: string) {
  if (row.amount < 0) throw new VentureValidationError(['Funding can’t be negative.'])
  const d = load()
  persist({ ...d, funding: [...d.funding, { ...row, id: uid('f'), amountUsd: toUsd(row.amount, row.currency) }], history: log(d, row.ventureId, by, 'funding_added', `${row.currency} ${row.amount.toLocaleString()} from ${row.funder}`) })
}

export function addAward(row: Omit<FundingAward, 'id'>, by: string) {
  if (row.amountUsd <= 0) throw new VentureValidationError(['The award must be more than 0.'])
  const d = load()
  persist({ ...d, awards: [...d.awards, { ...row, id: uid('a') }], history: log(d, row.ventureId, by, 'award_added', `CHII award of $${row.amountUsd.toLocaleString()}`) })
}

/* ---------- Public forms (registration and founder updates) ---------- */

/** Registries saved before the public forms existed get empty form data. */
function withFormData(d: RegistryData): RegistryData {
  return { ...d, submissions: d.submissions ?? [], links: d.links ?? [], settings: d.settings ?? defaultSettings() }
}

export const settingsOf = (d: RegistryData): RegistrySettings => d.settings ?? defaultSettings()
export const currentRound = (d: RegistryData) => settingsOf(d).rounds.slice(-1)[0]

export function setRegistrationOpen(open: boolean) {
  const d = load()
  persist({ ...d, settings: { ...settingsOf(d), registrationOpen: open } })
}

export function setUpdateSchedule(months: RegistrySettings['updateEveryMonths']) {
  const d = load()
  persist({ ...d, settings: { ...settingsOf(d), updateEveryMonths: months } })
}

export class FormClosedError extends Error {}

export type RegistrationInput = Omit<VentureSubmission, 'id' | 'receivedAt' | 'status' | 'ventureId' | 'reviewedBy' | 'reviewedAt' | 'rejectReason'>

/** Check a registration the way the registry would, before it's sent. Returns messages. */
export function checkRegistration(r: RegistrationInput): string[] {
  const out = [
    ...validateVenture({ name: r.name, healthSector: r.healthSector, stage: r.stage, currentStatus: 'Active', yearFounded: r.yearFounded, description: r.description }, r.countries),
    ...validateUpdate({ ...r, cofoundersCount: null, cofoundersFemaleCount: null }),
  ]
  if (!r.founders[0]?.name.trim() || !r.founders[0]?.email.trim()) out.push('Add the lead founder’s name and email.')
  r.founders.slice(1).forEach((f, i) => (f.name.trim() || f.email.trim()) && (!f.name.trim() || !f.email.trim()) && out.push(`Co-founder ${i + 1}: add both a name and an email.`))
  return out.map((m) => m.replace("Add the venture's", 'Add your venture’s'))
}

/** A founder registers their venture. It waits for staff; nothing enters the registry yet. */
export function submitRegistration(r: RegistrationInput) {
  const d = load()
  if (!settingsOf(d).registrationOpen) throw new FormClosedError('The registration form is closed.')
  const problems = checkRegistration(r)
  if (problems.length) throw new VentureValidationError(problems)
  const sub: VentureSubmission = { ...r, founders: r.founders.filter((f) => f.name.trim() && f.email.trim()), id: uid('s'), receivedAt: now(), status: 'pending' }
  persist({ ...d, submissions: [...(d.submissions ?? []), sub] })
  return sub
}

/** Staff accept a registration: it becomes a venture, founders are matched to (or given) CHII IDs. */
export function acceptSubmission(id: string, extra: { intakeYear: number; track: string }, by: string) {
  const d = load()
  const s = d.submissions?.find((x) => x.id === id)
  if (!s || s.status !== 'pending') throw new Error('This registration has already been reviewed.')
  const asOf = s.receivedAt.slice(0, 10) > REPORTING_DATE ? REPORTING_DATE : s.receivedAt.slice(0, 10)
  const { venture } = createVenture(
    {
      name: s.name,
      description: s.description,
      countries: s.countries,
      healthSector: s.healthSector,
      source: s.source,
      yearFounded: s.yearFounded,
      intakeYear: extra.intakeYear,
      institution: s.institution,
      track: extra.track,
      legalStatus: s.legalStatus,
      inAccelerator: false,
      youthLedOverride: null,
      womenLedOverride: null,
      pwdLedOverride: null,
    },
    s.founders.map((f, i) => ({ person: f, role: i === 0 ? 'lead_founder' : 'co_founder' })),
    {
      asOf,
      stage: s.stage,
      status: 'Active',
      cofoundersCount: null,
      cofoundersFemaleCount: null,
      jobsTotal: s.jobsTotal,
      jobsWomen: s.jobsWomen,
      jobsPwd: s.jobsPwd,
      jobsDisplaced: s.jobsDisplaced,
      fundingAmount: s.fundingAmount,
      fundingCurrency: s.fundingCurrency,
      revenueAmount: s.revenueAmount,
      revenueCurrency: s.revenueCurrency,
      notes: 'From the venture registration form.',
    },
    by,
    'founder_form',
  )
  const after = load()
  persist({ ...after, submissions: (after.submissions ?? []).map((x) => (x.id === id ? { ...x, status: 'accepted' as const, ventureId: venture.id, reviewedBy: by, reviewedAt: now() } : x)) })
  return venture
}

export function rejectSubmission(id: string, reason: string, by: string) {
  const d = load()
  persist({ ...d, submissions: (d.submissions ?? []).map((x) => (x.id === id ? { ...x, status: 'rejected' as const, rejectReason: reason, reviewedBy: by, reviewedAt: now() } : x)) })
}

/* Founder update links */

const token = () => Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6)

/** One personal link per active venture with a lead founder, for the current round. Existing links are kept. */
export function createRoundLinks() {
  const d = load()
  const round = currentRound(d)
  const links = d.links ?? []
  const fresh: UpdateLink[] = []
  for (const v of d.ventures) {
    const last = acceptedUpdates(d, v.id, '9999-12-31').slice(-1)[0]
    const lead = d.members.find((m) => m.ventureId === v.id && m.isPrimary && !m.leftOn)
    if (!lead || last?.status === 'Closed' || last?.status === 'Acquired') continue
    if (links.some((l) => l.ventureId === v.id && l.roundId === round.id)) continue
    fresh.push({ token: token(), ventureId: v.id, roundId: round.id, chiiId: lead.chiiId, createdAt: now(), sentAt: null, remindedAt: null, respondedAt: null, updateId: null })
  }
  persist({ ...d, links: [...links, ...fresh] })
  return fresh.length
}

export function markLinks(tokens: string[], what: 'sent' | 'reminded') {
  const d = load()
  const at = now()
  persist({ ...d, links: (d.links ?? []).map((l) => (tokens.includes(l.token) ? (what === 'sent' ? { ...l, sentAt: l.sentAt ?? at } : { ...l, remindedAt: at }) : l)) })
}

export const linkByToken = (t: string) => load().links?.find((l) => l.token === t) ?? null

/** A founder sends an update through their link. It waits for staff to accept it. */
export function submitFounderUpdate(t: string, input: UpdateInput) {
  const d = load()
  const link = d.links?.find((l) => l.token === t)
  if (!link) throw new FormClosedError('This link isn’t valid any more.')
  const u = addUpdate(link.ventureId, input, 'Founder (update form)', 'founder_form')
  const after = load()
  persist({ ...after, links: (after.links ?? []).map((l) => (l.token === t ? { ...l, respondedAt: now(), updateId: u.id } : l)) })
  return u
}
