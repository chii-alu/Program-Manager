/**
 * Venture data quality rules VEN-01 to VEN-11 (VENTURE-REGISTRY-SPEC §5).
 *
 * Critical rules on a single record (VEN-01 to VEN-05) also block saving: the form and the
 * importer call validateVenture / validateUpdate and show the messages. runVentureChecks scans
 * the whole registry for the data check and for records that came in before a rule existed.
 */
import { CURRENCIES } from './lists'
import { REPORTING_DATE, acceptedUpdates, deriveFlags, foundersOf } from './derive'
import type { RegistryData, Venture, VentureUpdate } from './types'

export type VenRule = 'VEN-01' | 'VEN-02' | 'VEN-03' | 'VEN-04' | 'VEN-05' | 'VEN-06' | 'VEN-07' | 'VEN-08' | 'VEN-09' | 'VEN-10' | 'VEN-11'
export type VenIssue = { rule: VenRule; severity: 'critical' | 'warning'; ventureId: string; title: string; detail: string }

export const DQ_RULES: { rule: VenRule; check: string; severity: 'critical' | 'warning' }[] = [
  { rule: 'VEN-01', check: 'Venture missing name, country, sector, stage or status', severity: 'critical' },
  { rule: 'VEN-02', check: 'Women / PWD / displaced jobs greater than total jobs', severity: 'critical' },
  { rule: 'VEN-03', check: 'Female co-founders greater than co-founders', severity: 'critical' },
  { rule: 'VEN-04', check: 'Year founded outside 1990 to current year', severity: 'critical' },
  { rule: 'VEN-05', check: 'Funding negative, or missing currency', severity: 'critical' },
  { rule: 'VEN-06', check: "Youth-, women- or PWD-led value doesn't match founders' data", severity: 'warning' },
  { rule: 'VEN-07', check: 'Venture with no founder linked to a CHII ID', severity: 'warning' },
  { rule: 'VEN-08', check: 'Possible duplicate venture (similar name + same country)', severity: 'warning' },
  { rule: 'VEN-09', check: 'Active venture with no update in more than 12 months', severity: 'warning' },
  { rule: 'VEN-10', check: 'Large unexplained change since last update', severity: 'warning' },
  { rule: 'VEN-11', check: 'Status Closed but jobs or funding still increasing', severity: 'warning' },
]

const CURRENT_YEAR = Number(REPORTING_DATE.slice(0, 4))

/** VEN-01 and VEN-04 on the venture record. Returns messages; empty means it can be saved. */
export function validateVenture(v: Partial<Venture>, countryCodes: string[]): string[] {
  const out: string[] = []
  const missing = [!v.name?.trim() && 'name', !countryCodes.length && 'country of operation', !v.healthSector && 'health sector', !v.stage && 'stage', !v.currentStatus && 'status'].filter(Boolean)
  if (missing.length) out.push(`Add the venture's ${list(missing as string[])}.`)
  if (v.description && v.description.length > 200) out.push(`The description is ${v.description.length} characters. Keep it to 200.`)
  if (v.yearFounded != null && (v.yearFounded < 1990 || v.yearFounded > CURRENT_YEAR)) out.push(`Year founded must be between 1990 and ${CURRENT_YEAR}.`)
  if (v.intakeYear != null && v.yearFounded != null && v.intakeYear < v.yearFounded) out.push('The intake year can’t be before the year the venture was founded.')
  return out
}

/** VEN-02, VEN-03 and VEN-05 on an update. */
export function validateUpdate(u: Pick<VentureUpdate, 'jobsTotal' | 'jobsWomen' | 'jobsPwd' | 'jobsDisplaced' | 'fundingAmount' | 'fundingCurrency' | 'cofoundersCount' | 'cofoundersFemaleCount' | 'revenueAmount' | 'revenueCurrency'>): string[] {
  const out: string[] = []
  for (const [k, label] of [['jobsTotal', 'Total jobs'], ['jobsWomen', 'Women jobs'], ['jobsPwd', 'PWD jobs'], ['jobsDisplaced', 'Displaced persons jobs']] as const) {
    if (!Number.isInteger(u[k]) || u[k] < 0) out.push(`${label} must be a whole number, 0 or more.`)
  }
  for (const [k, label] of [['jobsWomen', 'Women jobs'], ['jobsPwd', 'PWD jobs'], ['jobsDisplaced', 'Displaced persons jobs']] as const) {
    if (u[k] > u.jobsTotal) out.push(`${label} (${u[k]}) can’t be more than total jobs (${u.jobsTotal}).`)
  }
  if (u.cofoundersCount != null && u.cofoundersFemaleCount != null && u.cofoundersFemaleCount > u.cofoundersCount)
    out.push(`Female co-founders (${u.cofoundersFemaleCount}) can’t be more than co-founders (${u.cofoundersCount}).`)
  if (u.fundingAmount < 0) out.push('Funding raised can’t be negative.')
  if (!u.fundingCurrency || !CURRENCIES.includes(u.fundingCurrency)) out.push('Choose the currency of the funding raised.')
  if (u.revenueAmount != null && u.revenueAmount < 0) out.push('Revenue can’t be negative.')
  if (u.revenueAmount != null && (!u.revenueCurrency || !CURRENCIES.includes(u.revenueCurrency))) out.push('Choose the currency of the revenue.')
  return out
}

/** All rules over the registry. */
export function runVentureChecks(d: RegistryData, onIso = REPORTING_DATE): VenIssue[] {
  const issues: VenIssue[] = []
  const add = (rule: VenRule, ventureId: string, title: string, detail: string) => issues.push({ rule, severity: DQ_RULES.find((r) => r.rule === rule)!.severity, ventureId, title, detail })
  const yearAgo = `${Number(onIso.slice(0, 4)) - 1}${onIso.slice(4)}`

  for (const v of d.ventures) {
    const countries = d.countries.filter((c) => c.ventureId === v.id).map((c) => c.countryCode)
    const ups = acceptedUpdates(d, v.id, onIso)
    const last = ups[ups.length - 1]

    for (const m of validateVenture(v, countries)) add(m.startsWith('Year founded') ? 'VEN-04' : 'VEN-01', v.id, v.name || v.code, m)
    for (const u of ups) for (const m of validateUpdate(u)) add(m.includes('co-founders') ? 'VEN-03' : /fund|currency|revenue/i.test(m) ? 'VEN-05' : 'VEN-02', v.id, v.name, `${m} (update of ${u.asOf})`)

    const flags = deriveFlags(d, v, onIso)
    const word = { womenLed: 'Women-led', youthLed: 'Youth-led', pwdLed: 'PWD-led' } as const
    for (const k of flags.mismatches) add('VEN-06', v.id, v.name, `${word[k]} is set to ${flags.value[k] ? 'Yes' : 'No'}, but the founders’ data says ${flags.derived[k] ? 'Yes' : 'No'}.`)

    if (!foundersOf(d, v.id, onIso).length) add('VEN-07', v.id, v.name, 'No founder is linked to a CHII ID. Add the founders so they count in founder metrics.')

    if (last && last.status === 'Active' && last.asOf < yearAgo) add('VEN-09', v.id, v.name, `Active, but the last update was on ${last.asOf}. Send the founder update form.`)

    if (ups.length >= 2) {
      const prev = ups[ups.length - 2]
      const jump = (a: number, b: number) => a > 0 && b > a * 4 // up by more than 300%
      if (jump(prev.jobsTotal, last.jobsTotal)) add('VEN-10', v.id, v.name, `Jobs went from ${prev.jobsTotal} to ${last.jobsTotal} since the last update. Add a note if this is right.`)
      if (jump(prev.fundingUsd, last.fundingUsd)) add('VEN-10', v.id, v.name, `Funding raised went from $${prev.fundingUsd.toLocaleString()} to $${last.fundingUsd.toLocaleString()}. Add a note if this is right.`)
      if (last.status === 'Active' && prev.jobsTotal > 0 && last.jobsTotal === 0) add('VEN-10', v.id, v.name, 'Jobs dropped to 0 while the venture is Active.')
      if (last.status === 'Closed' && (last.jobsTotal > prev.jobsTotal || last.fundingUsd > prev.fundingUsd)) add('VEN-11', v.id, v.name, 'The venture is Closed, but its jobs or funding went up in the latest update.')
    }
  }

  // VEN-08: similar names in the same primary country.
  const prim = new Map(d.countries.filter((c) => c.isPrimary).map((c) => [c.ventureId, c.countryCode]))
  for (let i = 0; i < d.ventures.length; i++)
    for (let j = i + 1; j < d.ventures.length; j++) {
      const a = d.ventures[i]
      const b = d.ventures[j]
      if (prim.get(a.id) && prim.get(a.id) === prim.get(b.id) && similar(a.name, b.name))
        add('VEN-08', b.id, b.name, `Looks like a duplicate of ${a.name} (${a.code}) in the same country. Merge them if they're the same venture.`)
    }
  return issues
}

/* ---------- Helpers ---------- */

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** Names compared without case, spaces, punctuation and company suffixes. */
export function normName(s: string) {
  return s
    .toLowerCase()
    .replace(/\b(ltd|limited|inc|llc|plc|co|company|group|africa|health|technologies|tech)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function similar(a: string, b: string) {
  const x = normName(a)
  const y = normName(b)
  if (!x || !y) return false
  if (x === y || (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x)))) return true
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length) >= 0.85
}

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}
