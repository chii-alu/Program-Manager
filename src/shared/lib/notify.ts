import { useCallback, useEffect, useState } from 'react'

export type Tone = 'good' | 'warn' | 'bad' | 'info'
export type Note = { id: string; title: string; body: string; at: number; unread: boolean; tone: Tone; to?: string }
export type Toast = { id: string; title: string; body?: string; tone?: Tone; action?: { label: string; to: string } }

const KEY = 'mela-notes-v2'
const EVT = 'mela-notes'
const TOAST = 'mela-toast'
const min = 60_000

function seed(): Note[] {
  const now = Date.now()
  return [
    { id: 'n1', title: 'Feedback form is still in draft', body: 'Public Sector Fellowship 2026 starts in 10 days', at: now - 12 * min, unread: true, tone: 'bad', to: 'session:s4' },
    { id: 'n2', title: 'Import finished · 214 rows added', body: 'SIE Cohort 4 registrations.xlsx', at: now - 64 * min, unread: true, tone: 'good', to: 'import' },
    { id: 'n3', title: 'Grace Wanjiru exported a sheet', body: 'HEMP participants · de-identified', at: now - 3 * 60 * min, unread: false, tone: 'info', to: 'data' },
    { id: 'n4', title: '23 applications awaiting scores', body: 'SIE Cohort 4 · selection closes Friday', at: now - 26 * 60 * min, unread: false, tone: 'warn', to: 'applications' },
  ]
}

function load(): Note[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Note[]) : seed()
  } catch {
    return seed()
  }
}

function save(items: Note[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 40)))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVT))
}

/** Adds a notification to the centre, and shows it as a toast unless told not to. */
export function notify(n: Omit<Note, 'id' | 'at' | 'unread'>, opts: { toast?: boolean } = {}) {
  const note: Note = { ...n, id: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), unread: true }
  save([note, ...load()])
  if (opts.toast !== false) toast({ title: n.title, body: n.body, tone: n.tone, action: n.to ? { label: 'View', to: n.to } : undefined })
}

export function toast(t: Omit<Toast, 'id'>) {
  window.dispatchEvent(new CustomEvent<Toast>(TOAST, { detail: { ...t, id: `t${Date.now()}${Math.random()}` } }))
}

export function onToast(cb: (t: Toast) => void) {
  const h = (e: Event) => cb((e as CustomEvent<Toast>).detail)
  window.addEventListener(TOAST, h)
  return () => window.removeEventListener(TOAST, h)
}

export function useNotifications() {
  const [items, setItems] = useState<Note[]>(load)
  useEffect(() => {
    const h = () => setItems(load())
    window.addEventListener(EVT, h)
    window.addEventListener('storage', h)
    return () => {
      window.removeEventListener(EVT, h)
      window.removeEventListener('storage', h)
    }
  }, [])
  const update = useCallback((fn: (xs: Note[]) => Note[]) => save(fn(load())), [])
  return {
    items,
    unread: items.filter((n) => n.unread).length,
    markRead: (id: string) => update((xs) => xs.map((x) => (x.id === id ? { ...x, unread: false } : x))),
    markAll: () => update((xs) => xs.map((x) => ({ ...x, unread: false }))),
    remove: (id: string) => update((xs) => xs.filter((x) => x.id !== id)),
    clear: () => update(() => []),
  }
}

export function timeAgo(at: number) {
  const s = Math.max(1, Math.round((Date.now() - at) / 1000))
  if (s < 60) return 'now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.round(h / 24)}d`
}

/* ---------- Simulated realtime feed ---------- */
let started = false
const incoming: Omit<Note, 'id' | 'at' | 'unread'>[] = [
  { title: '12 new registrations', body: 'Masterclass · Pitching to investors', tone: 'info', to: 'session:s1' },
  { title: 'Feedback rate passed 30%', body: 'Career Exposure · Kigali', tone: 'good', to: 'feedback' },
  { title: 'Check-in QR scanned 40 times', body: 'SIE Cohort 4 · today', tone: 'info', to: 'session:s2' },
]
export function startRealtime() {
  if (started) return
  started = true
  incoming.forEach((n, i) => setTimeout(() => notify(n), 35_000 * (i + 1)))
}
