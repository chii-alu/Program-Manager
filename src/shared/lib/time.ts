import { useCallback, useEffect, useState } from 'react'
import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns'

export type Preset = '7d' | '30d' | '90d' | '12m' | 'all' | 'custom'
export type TimeRange = { preset: Preset; from?: string; to?: string }

/** The platform's "today" for sample data. */
export const TODAY = new Date(2025, 10, 10)

export const presets: { id: Exclude<Preset, 'custom'>; label: string; short: string }[] = [
  { id: '7d', label: 'Last 7 days', short: '7D' },
  { id: '30d', label: 'Last 30 days', short: '30D' },
  { id: '90d', label: 'Last 90 days', short: '90D' },
  { id: '12m', label: 'Last 12 months', short: '12M' },
  { id: 'all', label: 'All time', short: 'All' },
]

export function bounds(tr: TimeRange): { start: Date; end: Date } {
  const end = tr.preset === 'custom' && tr.to ? new Date(tr.to) : TODAY
  switch (tr.preset) {
    case '7d':
      return { start: subDays(end, 6), end }
    case '30d':
      return { start: subDays(end, 29), end }
    case '90d':
      return { start: subDays(end, 89), end }
    case '12m':
      return { start: subMonths(end, 12), end }
    case 'all':
      return { start: new Date(2024, 4, 1), end }
    case 'custom':
      return { start: tr.from ? new Date(tr.from) : subDays(end, 29), end }
  }
}

export function rangeLabel(tr: TimeRange) {
  if (tr.preset !== 'custom') return presets.find((p) => p.id === tr.preset)!.label
  const { start, end } = bounds(tr)
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`
}

const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

/** Parses "8 Nov 2025" or "10 Nov, 11:42" (current year). */
export function parseDay(s: string): Date | null {
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s*(\d{4})?/)
  if (!m) return null
  return new Date(m[3] ? Number(m[3]) : TODAY.getFullYear(), months[m[2].toLowerCase()] ?? 0, Number(m[1]))
}

export function inRange(tr: TimeRange, s: string) {
  const d = parseDay(s)
  if (!d) return true
  const { start, end } = bounds(tr)
  return d >= start && d <= addDays(end, 1)
}

/* ---------- Deterministic daily activity ---------- */

function noise(i: number, seed: number) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const base = { HENT: 2.1, HEMP: 3.9, HECO: 0.8 }

export type Point = { label: string; HENT: number; HEMP: number; HECO: number; registered: number; attended: number; completed: number; feedback: number }

function day(d: Date): Omit<Point, 'label'> {
  const ago = differenceInCalendarDays(TODAY, d)
  const growth = 0.55 + 0.9 * (1 - Math.min(ago, 540) / 540)
  const wd = d.getDay()
  const week = wd === 0 || wd === 6 ? 0.35 : 1.12
  const summer = d.getMonth() === 5 || d.getMonth() === 6 ? 0.6 : 1
  const pill = (k: keyof typeof base, s: number) => Math.round(base[k] * growth * week * summer * (0.55 + 0.9 * noise(ago, s)))
  const HENT = pill('HENT', 1)
  const HEMP = pill('HEMP', 2)
  const HECO = pill('HECO', 3)
  const registered = Math.round((HENT + HEMP + HECO) * 2.9)
  const attended = Math.round(registered * (0.72 + 0.12 * noise(ago, 4)))
  const completed = Math.round(attended * (0.74 + 0.1 * noise(ago, 5)))
  const feedback = Math.round(completed * (0.34 + 0.12 * noise(ago, 6)))
  return { HENT, HEMP, HECO, registered, attended, completed, feedback }
}

const zero = (): Omit<Point, 'label'> => ({ HENT: 0, HEMP: 0, HECO: 0, registered: 0, attended: 0, completed: 0, feedback: 0 })

/** Buckets activity for a range: daily up to 45 days, weekly up to 200, monthly beyond. */
export function seriesFor(tr: TimeRange): Point[] {
  const { start, end } = bounds(tr)
  const span = differenceInCalendarDays(end, start) + 1
  const gran = span <= 45 ? 'day' : span <= 200 ? 'week' : 'month'
  const keyOf = (d: Date) => (gran === 'day' ? d : gran === 'week' ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d))
  const fmt = gran === 'day' ? (span <= 7 ? 'EEE' : 'd MMM') : gran === 'week' ? 'd MMM' : span > 400 ? 'MMM yy' : 'MMM'
  const map = new Map<string, Point>()
  for (let i = 0; i < span; i++) {
    const d = addDays(start, i)
    const k = keyOf(d)
    const id = k.toISOString().slice(0, 10)
    if (!map.has(id)) map.set(id, { label: format(k, fmt), ...zero() })
    const p = map.get(id)!
    const v = day(d)
    ;(Object.keys(v) as (keyof typeof v)[]).forEach((key) => (p[key] += v[key]))
  }
  return Array.from(map.values())
}

export function totals(tr: TimeRange) {
  return seriesFor(tr).reduce((acc, p) => {
    ;(Object.keys(acc) as (keyof ReturnType<typeof zero>)[]).forEach((k) => (acc[k] += p[k]))
    return acc
  }, zero())
}

/** Same-length window just before the range, for deltas. */
export function previous(tr: TimeRange): TimeRange {
  const { start, end } = bounds(tr)
  const span = differenceInCalendarDays(end, start) + 1
  return { preset: 'custom', from: format(subDays(start, span), 'yyyy-MM-dd'), to: format(subDays(start, 1), 'yyyy-MM-dd') }
}

/* ---------- Shared, persisted hook ---------- */

const KEY = 'mela-range'
function read(): TimeRange {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '') as TimeRange
  } catch {
    return { preset: '90d' }
  }
}

export function useTimeRange() {
  const [range, setRangeState] = useState<TimeRange>(read)
  useEffect(() => {
    const h = (e: Event) => setRangeState((e as CustomEvent<TimeRange>).detail)
    window.addEventListener(KEY, h)
    return () => window.removeEventListener(KEY, h)
  }, [])
  const setRange = useCallback((r: TimeRange) => {
    setRangeState(r)
    try {
      localStorage.setItem(KEY, JSON.stringify(r))
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(KEY, { detail: r }))
  }, [])
  return { range, setRange, label: rangeLabel(range) }
}
