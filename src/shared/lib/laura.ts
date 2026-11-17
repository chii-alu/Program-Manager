/**
 * Laura: the platform's assistant.
 *
 * The chat UI only talks to `askLaura`. Today it answers from the platform guide (the FAQ, matched
 * by keyword); when the AI is ready, replace the body of `askLaura` with a call to it. The context
 * (page, role, portal) is already passed so the AI can tailor answers. No personal data is sent:
 * the chat asks people not to type names or contact details.
 */
import { useSyncExternalStore } from 'react'
import { faqs, type Faq } from '../data/faq'

export type LauraMessage = {
  id: string
  from: 'user' | 'laura'
  text: string
  /** A page Laura suggests opening. */
  link?: { label: string; key: string }
  /** Other questions she can answer next. */
  follow?: string[]
  at: number
}

export type LauraContext = { page: string; role: string; portal: string; user: string }

const GREETING = (name: string): LauraMessage => ({
  id: 'hello',
  from: 'laura',
  text: `Hi ${name.split(' ')[0]}, I’m Laura. Ask me how to do something on the platform: exports, imports, consent, CHII IDs, attendance, reports…`,
  follow: ['How do I export a sheet?', 'What is a CHII ID?', 'Why were rows rejected for consent?'],
  at: Date.now(),
})

const STOP = new Set(['how', 'do', 'does', 'did', 'can', 'could', 'i', 'we', 'you', 'my', 'our', 'a', 'an', 'the', 'is', 'are', 'what', 'why', 'when', 'where', 'who', 'which', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'it', 'this', 'that', 'with', 'be', 'me', 'please', 'there', 'get', 'make', 'should', 'would', 'want', 'need', 'about', 'from', 'at', 'by', 'as', 'if', 'not', 'any'])
const stem = (w: string) => w.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/(ing|ed|es|s)$/, '')

/** Guide answers that share a real keyword with the question (common words like "how" don't count). */
export function matchFaqs(question: string): Faq[] {
  const words = question.split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z0-9-]/g, '')).filter((w) => w.length > 1 && !STOP.has(w)).map(stem)
  if (!words.length) return []
  return faqs
    .map((f) => {
      const keys = f.keywords.map(stem)
      const hits = words.filter((w) => keys.some((k) => k === w || (w.length > 3 && (k.startsWith(w) || w.startsWith(k)) && k.length > 3)))
      const title = f.q.split(/\s+/).map(stem)
      return { f, hits: hits.length, score: hits.length * 3 + words.filter((w) => title.includes(w)).length }
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f)
}

/** Laura's answer. Swap this for the AI later; the rest of the chat stays the same. */
export async function askLaura(question: string, _history: LauraMessage[], _ctx: LauraContext): Promise<Omit<LauraMessage, 'id' | 'at'>> {
  await new Promise((r) => setTimeout(r, 650))
  const q = question.trim()
  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/i.test(q)) return { from: 'laura', text: 'Hello! What would you like to do? You can ask in your own words.', follow: ['How do I import a spreadsheet?', 'What can each role see?'] }
  if (/\b(thanks|thank you|cheers)\b/i.test(q)) return { from: 'laura', text: 'You’re welcome. Anything else?' }
  const hits = matchFaqs(q)
  if (!hits.length)
    return {
      from: 'laura',
      text: 'I don’t have an answer for that yet: I’m still learning the platform. Try other words, or email the MELA team at mela@chii.alu.edu and they’ll help.',
      follow: ['How do I filter or sort a table?', 'What does the date filter change?'],
    }
  const [best, ...more] = hits
  return { from: 'laura', text: best.a, link: best.to, follow: more.slice(0, 2).map((f) => f.q) }
}

/* ---------- Conversation, kept for the browser tab so it survives moving between pages ---------- */

const KEY = 'mela-laura-chat'
let cache: LauraMessage[] | null = null
const listeners = new Set<() => void>()
function load(): LauraMessage[] {
  if (cache) return cache
  try {
    cache = JSON.parse(sessionStorage.getItem(KEY) || '[]') as LauraMessage[]
  } catch {
    cache = []
  }
  return cache
}
function persist(next: LauraMessage[]) {
  cache = next
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next.slice(-60)))
  } catch {
    /* keep in memory */
  }
  listeners.forEach((l) => l())
}
export const useLauraChat = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), load, load)
export const startChat = (name: string) => load().length === 0 && persist([GREETING(name)])
export const clearChat = (name: string) => persist([GREETING(name)])
let n = 0
export const addMessage = (m: Omit<LauraMessage, 'id' | 'at'>) => persist([...load(), { ...m, id: `m${Date.now().toString(36)}${n++}`, at: Date.now() }])
