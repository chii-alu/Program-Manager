/**
 * Report periods (REPORT-TOOL-SPEC §3 step 2): presets relative to today, custom ranges,
 * and the two comparison periods. Dates are ISO strings in UTC so ranges never drift by a
 * day across time zones.
 */
import type { Comparison, Period } from './types'
import { TODAY_ISO } from './facts'

/** MELA decisions (spec §14). The financial year start month is an assumption until MELA confirms it. */
export const REPORT_SETTINGS = {
  thresholdInternal: 5,
  thresholdExternal: 10,
  /** 1 = January. */
  fyStartMonth: 1,
}

export type PresetId =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'h1'
  | 'h2'
  | 'this_year'
  | 'last_year'
  | 'this_fy'
  | 'last_fy'
  | 'custom'

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'last_quarter', label: 'Last quarter' },
  { id: 'h1', label: 'H1 (Jan–Jun)' },
  { id: 'h2', label: 'H2 (Jul–Dec)' },
  { id: 'this_year', label: 'This year' },
  { id: 'last_year', label: 'Last year' },
  { id: 'this_fy', label: 'This financial year' },
  { id: 'last_fy', label: 'Last financial year' },
  { id: 'custom', label: 'Custom dates' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)
/** Last day of month `m` (0-based) of year `y`. */
const endOf = (y: number, m: number) => iso(y, m + 1, 0)
const parts = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m: m - 1, d }
}

/** "1 Jul 2025" */
export function fmtDay(s: string) {
  const { y, m, d } = parts(s)
  return `${d} ${MONTHS[m]} ${y}`
}

/** "1 Jul – 30 Sep 2025", dropping the first year when both ends share it. */
export function fmtRange(start: string, end: string) {
  const a = parts(start)
  const b = parts(end)
  return a.y === b.y ? `${a.d} ${MONTHS[a.m]} – ${fmtDay(end)}` : `${fmtDay(start)} – ${fmtDay(end)}`
}

function fyLabel(startYear: number, fyStart: number) {
  return fyStart === 1 ? `FY ${startYear}` : `FY ${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** Resolve a preset to concrete dates, relative to `today` (defaults to the app's "today"). */
export function presetPeriod(id: Exclude<PresetId, 'custom'>, today = TODAY_ISO, fyStart = REPORT_SETTINGS.fyStartMonth): Period {
  const { y, m } = parts(today)
  const q = Math.floor(m / 3)
  switch (id) {
    case 'this_month':
      return { start: iso(y, m, 1), end: endOf(y, m), label: `${MONTHS_LONG[m]} ${y}` }
    case 'last_month': {
      const ly = m === 0 ? y - 1 : y
      const lm = (m + 11) % 12
      return { start: iso(ly, lm, 1), end: endOf(ly, lm), label: `${MONTHS_LONG[lm]} ${ly}` }
    }
    case 'this_quarter':
      return { start: iso(y, q * 3, 1), end: endOf(y, q * 3 + 2), label: `Q${q + 1} ${y}` }
    case 'last_quarter': {
      const lq = (q + 3) % 4
      const ly = q === 0 ? y - 1 : y
      return { start: iso(ly, lq * 3, 1), end: endOf(ly, lq * 3 + 2), label: `Q${lq + 1} ${ly}` }
    }
    case 'h1':
      return { start: iso(y, 0, 1), end: endOf(y, 5), label: `H1 ${y}` }
    case 'h2':
      return { start: iso(y, 6, 1), end: endOf(y, 11), label: `H2 ${y}` }
    case 'this_year':
      return { start: iso(y, 0, 1), end: endOf(y, 11), label: `${y}` }
    case 'last_year':
      return { start: iso(y - 1, 0, 1), end: endOf(y - 1, 11), label: `${y - 1}` }
    case 'this_fy':
    case 'last_fy': {
      const fs = fyStart - 1
      let startYear = m >= fs ? y : y - 1
      if (id === 'last_fy') startYear -= 1
      return { start: iso(startYear, fs, 1), end: iso(startYear + 1, fs, 0), label: fyLabel(startYear, fyStart) }
    }
  }
}

export function customPeriod(start: string, end: string): Period {
  // A custom range that is exactly one calendar month reads better by name.
  const a = parts(start)
  const b = parts(end)
  if (a.d === 1 && a.y === b.y && a.m === b.m && end === endOf(b.y, b.m)) return { start, end, label: `${MONTHS_LONG[a.m]} ${a.y}` }
  return { start, end, label: fmtRange(start, end) }
}

/**
 * The period after this one, for "Duplicate for new period" (spec §6): Q3 → Q4, a month → the
 * next month, and any other range → the same number of days straight after.
 */
export function nextPeriod(p: Period): Period {
  const a = parts(p.start)
  const b = parts(p.end)
  if (a.d === 1 && p.end === endOf(b.y, b.m)) {
    const months = (b.y - a.y) * 12 + (b.m - a.m) + 1
    const start = iso(a.y, a.m + months, 1)
    const e = parts(start)
    const end = endOf(e.y, e.m + months - 1)
    // Keep the preset's naming style where we can recognise it.
    const label =
      months === 3 && a.m % 3 === 0 ? `Q${Math.floor(e.m / 3) + 1} ${e.y}` : months === 1 ? `${MONTHS_LONG[e.m]} ${e.y}` : months === 6 && a.m % 6 === 0 ? `H${e.m < 6 ? 1 : 2} ${e.y}` : months === 12 && a.m === 0 ? `${e.y}` : fmtRange(start, end)
    return { start, end, label }
  }
  const len = Math.round((Date.parse(p.end) - Date.parse(p.start)) / 86_400_000)
  const start = new Date(Date.parse(p.end) + 86_400_000).toISOString().slice(0, 10)
  const end = new Date(Date.parse(start) + len * 86_400_000).toISOString().slice(0, 10)
  return customPeriod(start, end)
}

/** The period a report compares against: same length immediately before, or the same dates a year earlier. */
export function comparisonPeriod(p: Period, c: Exclude<Comparison, 'none'>): Period {
  if (c === 'last_year') {
    const a = parts(p.start)
    const b = parts(p.end)
    // Clamp 29 Feb to 28 Feb in non-leap years.
    const start = iso(a.y - 1, a.m, Math.min(a.d, parts(endOf(a.y - 1, a.m)).d))
    const end = iso(b.y - 1, b.m, Math.min(b.d, parts(endOf(b.y - 1, b.m)).d))
    return { start, end, label: `Same period last year (${fmtRange(start, end)})` }
  }
  // Whole calendar months (a month, quarter, half or year) compare with the previous whole
  // unit, e.g. Q3 → Q2, not "the 92 days before 1 July".
  const a = parts(p.start)
  const b = parts(p.end)
  if (a.d === 1 && p.end === endOf(b.y, b.m)) {
    const months = (b.y - a.y) * 12 + (b.m - a.m) + 1
    const start = iso(a.y, a.m - months, 1)
    const end = endOf(a.y, a.m - 1)
    return { start, end, label: `Previous period (${fmtRange(start, end)})` }
  }
  const len = Math.round((Date.parse(p.end) - Date.parse(p.start)) / 86_400_000)
  const end = new Date(Date.parse(p.start) - 86_400_000).toISOString().slice(0, 10)
  const start = new Date(Date.parse(end) - len * 86_400_000).toISOString().slice(0, 10)
  return { start, end, label: `Previous period (${fmtRange(start, end)})` }
}
