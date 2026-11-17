/**
 * Partnership bank: the organisations each pillar works with (hosts, funders, ministries,
 * NGOs, universities, health facilities…), which interventions they support, what they offer,
 * the agreement in place, who to contact and when we last spoke. Each pillar sees only its own
 * partners; MELA sees every pillar's.
 *
 * Browser-only like the rest of the prototype (localStorage). The sample partners are labelled
 * "(sample)" except SFH, which HEMP named as its internship partner; replace them with real ones.
 */
import { useSyncExternalStore } from 'react'
import { interventions, type Pillar } from './mela'

export const PARTNER_TYPES = ['Employer / host', 'Funder / donor', 'Government / ministry', 'NGO', 'University / academic', 'Health facility', 'Company', 'Community organisation'] as const
export type PartnerType = (typeof PARTNER_TYPES)[number]

export const PARTNER_STATUSES = ['Prospect', 'In talks', 'Active', 'Paused', 'Ended'] as const
export type PartnerStatus = (typeof PARTNER_STATUSES)[number]

export const OFFERS = ['Placements / internships', 'Site visits', 'Funding', 'Mentors', 'Speakers / facilitators', 'Venue', 'Data / research', 'Jobs for alumni'] as const

export type PartnerDoc = { name: string; size: number; type: string; dataUrl?: string }

export type Partner = {
  id: string
  name: string
  pillar: Pillar
  type: PartnerType
  status: PartnerStatus
  /** Interventions (of this pillar) the partner supports. */
  interventions: string[]
  offers: string[]
  url?: string
  country?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  /** MOU or agreement. */
  agreement?: { signed?: string; ends?: string; doc?: PartnerDoc }
  lastContact?: string
  notes?: string
  addedBy: string
  addedAt: string
  updatedBy?: string
}

/** The interventions a pillar's partners can be linked to. */
export const interventionsOf = (pillar: Pillar) => interventions.filter((i) => i.pillar === pillar).map((i) => i.name)

const P = (id: string, x: Omit<Partner, 'id'>): Partner => ({ id, ...x })

export function seedPartners(): Partner[] {
  return [
    P('p-sfh', {
      name: 'SFH',
      pillar: 'HEMP',
      type: 'NGO',
      status: 'Active',
      interventions: ['Internships'],
      offers: ['Placements / internships', 'Mentors'],
      country: 'Rwanda',
      agreement: { signed: '2025-01-15', ends: '2026-01-14' },
      lastContact: '2025-10-28',
      notes: 'Hosts interns in each SFH cohort across several departments. Confirm department places before each cohort opens.',
      addedBy: 'Yusuf Abdi',
      addedAt: '2025-01-15',
    }),
    P('p-hosp', {
      name: 'District hospital (sample)',
      pillar: 'HEMP',
      type: 'Health facility',
      status: 'Active',
      interventions: ['Career Exposure', 'SIE'],
      offers: ['Site visits', 'Speakers / facilitators'],
      country: 'Kenya',
      lastContact: '2025-09-30',
      notes: 'Site visits for Career Exposure and the SIE immersion week. Needs two weeks’ notice and a participant list.',
      addedBy: 'Grace Wanjiru',
      addedAt: '2025-06-02',
    }),
    P('p-emp', {
      name: 'Health-tech employer (sample)',
      pillar: 'HEMP',
      type: 'Company',
      status: 'In talks',
      interventions: ['Career Workshops'],
      offers: ['Speakers / facilitators', 'Jobs for alumni'],
      notes: 'Interested in running a CV clinic at the next Career Workshop.',
      addedBy: 'Grace Wanjiru',
      addedAt: '2025-10-20',
    }),
    P('p-ministry', {
      name: 'Ministry of Health host unit (sample)',
      pillar: 'HECO',
      type: 'Government / ministry',
      status: 'Active',
      interventions: ['Public Sector Fellowship'],
      offers: ['Placements / internships', 'Mentors'],
      agreement: { signed: '2024-11-01', ends: '2025-12-31' },
      lastContact: '2025-11-04',
      notes: 'Hosts fellows for six months. Placement numbers are agreed before applications open.',
      addedBy: 'Esi Owusu',
      addedAt: '2024-11-01',
    }),
    P('p-univ', {
      name: 'School of public health (sample)',
      pillar: 'HECO',
      type: 'University / academic',
      status: 'Prospect',
      interventions: ['Executive Courses'],
      offers: ['Speakers / facilitators', 'Data / research'],
      notes: 'Possible co-delivery of the health financing executive course.',
      addedBy: 'Esi Owusu',
      addedAt: '2025-10-10',
    }),
    P('p-fund', {
      name: 'Impact investor (sample)',
      pillar: 'HENT',
      type: 'Funder / donor',
      status: 'Active',
      interventions: ['Venture Funding', 'Mentorship'],
      offers: ['Funding', 'Mentors'],
      agreement: { signed: '2025-03-01', ends: '2026-02-28' },
      lastContact: '2025-10-15',
      notes: 'Co-funds Venture Funding awards and sits on the selection panel.',
      addedBy: 'Tendai Moyo',
      addedAt: '2025-03-01',
    }),
    P('p-hack', {
      name: 'Innovation hub (sample)',
      pillar: 'HENT',
      type: 'Company',
      status: 'Active',
      interventions: ['Hackathon', 'Masterclass'],
      offers: ['Venue', 'Mentors'],
      lastContact: '2025-10-18',
      notes: 'Provides the venue and judges for the HealthTech Hackathon.',
      addedBy: 'Tendai Moyo',
      addedAt: '2025-05-12',
    }),
  ]
}

type State = { items: Partner[] }
const KEY = 'mela-partners-v1'
let cache: State | null = null
const listeners = new Set<() => void>()
function load(): State {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as State) : { items: seedPartners() }
  } catch {
    cache = { items: seedPartners() }
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
export const usePartners = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), load, load)
export const getPartners = load

/** A pillar sees only its own partners; MELA sees every pillar's. */
export const partnersFor = (all: Partner[], pillars: Pillar[]) => all.filter((x) => pillars.includes(x.pillar))

export class PartnerError extends Error {}

export type PartnerInput = Omit<Partner, 'id' | 'addedBy' | 'addedAt' | 'updatedBy'>

function check(x: PartnerInput) {
  if (!x.name.trim()) throw new PartnerError('Give the partner’s name.')
  if (x.url && !/^https?:\/\/\S+\.\S+/.test(x.url.trim())) throw new PartnerError('The website should start with http:// or https://')
  if (x.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x.contactEmail.trim())) throw new PartnerError('Check the contact’s email address.')
  const ok = interventionsOf(x.pillar)
  const wrong = x.interventions.filter((i) => !ok.includes(i))
  if (wrong.length) throw new PartnerError(`${wrong.join(', ')} isn’t a ${x.pillar} intervention.`)
  if (x.agreement?.signed && x.agreement?.ends && x.agreement.ends < x.agreement.signed) throw new PartnerError('The agreement can’t end before it’s signed.')
}

const tidy = (x: PartnerInput): PartnerInput => ({ ...x, name: x.name.trim(), url: x.url?.trim() || undefined, contactEmail: x.contactEmail?.trim() || undefined })

export function addPartner(x: PartnerInput, by: string): Partner {
  check(x)
  const p: Partner = { ...tidy(x), id: `p-${Date.now().toString(36)}`, addedBy: by, addedAt: new Date().toISOString().slice(0, 10) }
  persist({ items: [p, ...load().items] })
  return p
}

export function updatePartner(id: string, x: PartnerInput, by: string): Partner {
  check(x)
  const cur = load().items.find((p) => p.id === id)
  if (!cur) throw new PartnerError('This partner doesn’t exist any more.')
  const next: Partner = { ...cur, ...tidy(x), updatedBy: by }
  persist({ items: load().items.map((p) => (p.id === id ? next : p)) })
  return next
}

export function removePartner(id: string) {
  persist({ items: load().items.filter((p) => p.id !== id) })
}

/** Days until the agreement ends (negative once it has), from a given day. */
export function daysToEnd(p: Partner, today: string) {
  if (!p.agreement?.ends) return null
  return Math.round((new Date(`${p.agreement.ends}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
}

export function resetPartners() {
  persist({ items: seedPartners() })
}
