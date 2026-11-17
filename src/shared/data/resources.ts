/**
 * Resource bank: articles, papers, studies, guides, templates and videos that staff have found
 * useful in their work, shared with everyone. Each resource says who added it and why it helped.
 *
 * Browser-only like the rest of the prototype (localStorage). The sample entries are either CHII's
 * own documents (no link) or public sources referenced by their home page, so nothing is a
 * made-up citation; staff add the real ones with their links.
 */
import { useSyncExternalStore } from 'react'
import type { Pillar } from './mela'

export const RESOURCE_TYPES = ['Article', 'Paper / study', 'Guide', 'Template', 'Video', 'Dataset', 'Course'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export const TOPICS = ['Programme design', 'M&E and data', 'Health systems', 'Careers and employment', 'Entrepreneurship', 'Facilitation', 'Partnerships', 'Leadership'] as const

export type Resource = {
  id: string
  title: string
  type: ResourceType
  /** Author, organisation or journal. */
  source: string
  year?: number
  /** A link, or empty for a CHII document kept elsewhere. */
  url?: string
  summary: string
  /** How it helped the person who added it. */
  why?: string
  topics: string[]
  /** Pillars it's most useful for; empty means everyone. */
  pillars: Pillar[]
  addedBy: string
  addedAt: string
}

const KEY = 'mela-resources-v1'
type State = { items: Resource[]; saved: Record<string, string[]> }

const r = (id: string, x: Omit<Resource, 'id'>): Resource => ({ id, ...x })

export function seedResources(): Resource[] {
  return [
    r('r1', {
      title: 'Health systems building blocks (WHO framework)',
      type: 'Guide',
      source: 'World Health Organization',
      url: 'https://www.who.int',
      summary: 'The six building blocks of a health system: service delivery, workforce, information, medicines, financing and governance. A shared language for the SIE “health systems” sessions.',
      why: 'We use it to structure the SIE reflection sessions and the “health systems interests” question on the application.',
      topics: ['Health systems', 'Programme design'],
      pillars: ['HEMP', 'HECO'],
      addedBy: 'Yusuf Abdi',
      addedAt: '2025-09-02',
    }),
    r('r2', {
      title: 'Africa CDC: public health programmes and reports',
      type: 'Paper / study',
      source: 'Africa Centres for Disease Control and Prevention',
      url: 'https://africacdc.org',
      summary: 'Continental reports on public health priorities, the health workforce and local manufacturing: useful context for fellowship and immersion briefs.',
      topics: ['Health systems', 'Partnerships'],
      pillars: ['HECO', 'HEMP'],
      addedBy: 'Esi Owusu',
      addedAt: '2025-09-18',
    }),
    r('r3', {
      title: 'World Bank Open Knowledge Repository: health financing',
      type: 'Paper / study',
      source: 'World Bank',
      url: 'https://openknowledge.worldbank.org',
      summary: 'Open-access studies on health financing, insurance and service delivery. Search by country for evidence to cite in briefs and reports.',
      why: 'Good source of country evidence for the Public Sector Fellowship policy memos.',
      topics: ['Health systems', 'M&E and data'],
      pillars: ['HECO'],
      addedBy: 'Esi Owusu',
      addedAt: '2025-10-01',
    }),
    r('r4', {
      title: 'The Lancet Global Health',
      type: 'Article',
      source: 'The Lancet',
      url: 'https://www.thelancet.com/journals/langlo/home',
      summary: 'Open-access journal on global health research and policy. Useful for reading lists and staying current.',
      topics: ['Health systems'],
      pillars: [],
      addedBy: 'Amara Okafor',
      addedAt: '2025-08-20',
    }),
    r('r5', {
      title: 'Writing a strong health mission statement (CHII guide)',
      type: 'Guide',
      source: 'CHII · HEMP',
      summary: 'How to help students move from “I want to work in health” to a specific, testable mission, with examples from past SIE cohorts.',
      why: 'Applications with a clear mission score higher; we share this before applications open.',
      topics: ['Careers and employment', 'Facilitation'],
      pillars: ['HEMP'],
      addedBy: 'Grace Wanjiru',
      addedAt: '2025-10-12',
    }),
    r('r6', {
      title: 'Venture update call script and checklist',
      type: 'Template',
      source: 'CHII · HENT',
      summary: 'The questions to ask founders in the six-monthly update call, matched to the venture update form, so numbers come back consistent.',
      why: 'Cut the back-and-forth on update rounds; founders know what we’ll ask.',
      topics: ['Entrepreneurship', 'M&E and data'],
      pillars: ['HENT'],
      addedBy: 'Tendai Moyo',
      addedAt: '2025-10-20',
    }),
    r('r7', {
      title: 'Facilitating reflective sessions after site visits',
      type: 'Guide',
      source: 'CHII · HEMP',
      summary: 'A 45-minute debrief structure (what, so what, now what) used after field visits during immersions.',
      topics: ['Facilitation', 'Programme design'],
      pillars: ['HEMP'],
      addedBy: 'Yusuf Abdi',
      addedAt: '2025-11-03',
    }),
    r('r8', {
      title: 'MELA data quality checklist',
      type: 'Template',
      source: 'CHII · MELA',
      summary: 'What to check before a report is final: attendance completeness, feedback response rate, duplicates, consent. Mirrors the report data check.',
      why: 'Saved a report from going out with half the attendance missing.',
      topics: ['M&E and data'],
      pillars: [],
      addedBy: 'Amara Okafor',
      addedAt: '2025-09-25',
    }),
  ]
}

let cache: State | null = null
const listeners = new Set<() => void>()
function load(): State {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as State) : { items: seedResources(), saved: {} }
  } catch {
    cache = { items: seedResources(), saved: {} }
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
export const useResources = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), load, load)
export const getResources = load

export class ResourceError extends Error {}

export function addResource(x: Omit<Resource, 'id' | 'addedAt'>): Resource {
  if (!x.title.trim()) throw new ResourceError('Give it a title.')
  if (x.url && !/^https?:\/\/\S+\.\S+/.test(x.url.trim())) throw new ResourceError('The link should start with http:// or https://')
  const s = load()
  const item: Resource = { ...x, title: x.title.trim(), url: x.url?.trim() || undefined, id: `r-${Date.now().toString(36)}`, addedAt: new Date().toISOString().slice(0, 10) }
  persist({ ...s, items: [item, ...s.items] })
  return item
}

export function removeResource(id: string, by: string) {
  const s = load()
  const item = s.items.find((x) => x.id === id)
  if (!item) return
  if (item.addedBy !== by) throw new ResourceError('Only the person who added a resource can remove it.')
  persist({ ...s, items: s.items.filter((x) => x.id !== id) })
}

/** Each person's saved list. */
export function toggleSaved(user: string, id: string) {
  const s = load()
  const mine = s.saved[user] ?? []
  persist({ ...s, saved: { ...s.saved, [user]: mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id] } })
}

export function resetResources() {
  persist({ items: seedResources(), saved: {} })
}
