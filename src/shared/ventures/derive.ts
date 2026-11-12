/**
 * Registry views (VENTURE-REGISTRY-SPEC §6):
 *   v_venture_latest        → ventureLatest(): one de-identified row per venture, latest accepted values
 *   v_venture_change        → ventureChange(): baseline vs latest
 *   v_venture_stage_history → stageHistory(): stage changes between updates, by date
 *   v_venture_flags         → deriveFlags(): women-, youth- and PWD-led from the founders, beside overrides
 *
 * Rows returned for analytics carry no names, emails or CHII IDs (spec §4, §7).
 */
import { YOUTH_MAX_AGE, isActive, regionOf } from './lists'
import { ageOn, personById } from './people'
import type { AuRegion, LegalStatus, RegistryData, Stage, Venture, VentureMember, VentureStatus, VentureUpdate } from './types'

/** The sample world's "today" (matches the rest of the prototype). */
export const REPORTING_DATE = '2025-11-10'

const byAsOf = (a: VentureUpdate, b: VentureUpdate) => a.asOf.localeCompare(b.asOf) || (a.updateType === 'baseline' ? -1 : b.updateType === 'baseline' ? 1 : 0)

/** Accepted updates for a venture up to a date, oldest first. Pending founder updates are left out. */
export function acceptedUpdates(d: RegistryData, ventureId: string, onIso = REPORTING_DATE): VentureUpdate[] {
  return d.updates.filter((u) => u.ventureId === ventureId && u.acceptedAt && u.asOf <= onIso).sort(byAsOf)
}

/** Founders (lead and co-founders, not team) in post on a date. */
export function foundersOf(d: RegistryData, ventureId: string, onIso = REPORTING_DATE): VentureMember[] {
  return d.members.filter((m) => m.ventureId === ventureId && m.role !== 'team' && m.joinedOn <= onIso && (!m.leftOn || m.leftOn > onIso))
}

export type Flags = {
  derived: { womenLed: boolean | null; youthLed: boolean | null; pwdLed: boolean | null }
  value: { womenLed: boolean | null; youthLed: boolean | null; pwdLed: boolean | null }
  /** Manual values that disagree with the founders' data (rule VEN-06). */
  mismatches: ('womenLed' | 'youthLed' | 'pwdLed')[]
  founders: number
  femaleFounders: number
}

/** "At least one" rule: true if any is true, false if all are known and false, otherwise unknown. */
const anyKnown = (vals: (boolean | undefined)[]) => (vals.some((v) => v === true) ? true : vals.length && vals.every((v) => v === false) ? false : null)

export function deriveFlags(d: RegistryData, v: Venture, onIso = REPORTING_DATE): Flags {
  const fs = foundersOf(d, v.id, onIso).map((m) => ({ m, p: personById(m.chiiId) }))
  const lead = fs.find((f) => f.m.isPrimary) ?? fs.find((f) => f.m.role === 'lead_founder')
  // Co-founders the venture sheet only counts ("Co-Founders #", "Co-Founders Female #"): those
  // beyond the ones linked by CHII ID still count as founders, and as female founders.
  const last = acceptedUpdates(d, v.id, onIso).slice(-1)[0]
  const linkedCo = fs.filter((f) => f.m.role === 'co_founder')
  const extraCo = Math.max(0, (last?.cofoundersCount ?? 0) - linkedCo.length)
  const extraFemale = last?.cofoundersFemaleCount == null ? null : Math.max(0, last.cofoundersFemaleCount - linkedCo.filter((f) => f.p?.gender === 'F').length)
  // MELA: women-led = at least one female founder (lead or co-founder).
  const womenLed = anyKnown([
    ...fs.map((f) => (f.p && f.p.gender !== 'X' ? f.p.gender === 'F' : undefined)),
    ...(extraFemale == null ? (extraCo ? [undefined] : []) : [extraFemale > 0]),
  ])
  const leadAge = lead?.p ? ageOn(lead.p.dob, onIso) : null
  const youthLed = leadAge == null ? null : leadAge <= YOUTH_MAX_AGE
  const pwdLed = anyKnown(fs.map((f) => f.p?.disability))
  const derived = { womenLed, youthLed, pwdLed }
  const overrides = { womenLed: v.womenLedOverride, youthLed: v.youthLedOverride, pwdLed: v.pwdLedOverride }
  const value = {
    womenLed: overrides.womenLed ?? womenLed,
    youthLed: overrides.youthLed ?? youthLed,
    pwdLed: overrides.pwdLed ?? pwdLed,
  }
  const mismatches = (Object.keys(overrides) as (keyof typeof overrides)[]).filter((k) => overrides[k] != null && derived[k] != null && overrides[k] !== derived[k])
  return { derived, value, mismatches, founders: fs.length + extraCo, femaleFounders: fs.filter((f) => f.p?.gender === 'F').length + (extraFemale ?? 0) }
}

/** One row per venture: what analytics and reports see. No names, emails or CHII IDs. */
export type VentureRow = {
  ventureId: string
  code: string
  name: string
  sector: string
  source: string
  track: string
  institution: string
  intakeYear: number
  yearFounded: number
  country: string | null
  countries: string[]
  region: AuRegion | null
  stage: Stage
  status: VentureStatus
  active: boolean
  legalStatus: LegalStatus
  inAccelerator: boolean
  womenLed: boolean | null
  youthLed: boolean | null
  pwdLed: boolean | null
  /** Founders recorded (from venture_member), or the count entered on the update when none are. */
  founders: number
  femaleFounders: number
  jobsTotal: number
  jobsWomen: number
  jobsPwd: number
  jobsDisplaced: number
  /** External funding raised to date (USD). */
  fundingRaisedUsd: number
  /** CHII Venture Funding awards to date (USD): "Funding Deployed". */
  chiiFundingUsd: number
  /** Revenue over the last 12 months (USD), when reported. */
  revenueUsd: number | null
  latestAsOf: string
  baselineAsOf: string
}

/** v_venture_latest, as of a date: ventures already in the portfolio then, with their latest accepted values. */
export function ventureLatest(d: RegistryData, onIso = REPORTING_DATE): VentureRow[] {
  return d.ventures.flatMap((v) => {
    const ups = acceptedUpdates(d, v.id, onIso)
    if (!ups.length) return []
    const last = ups[ups.length - 1]
    const flags = deriveFlags(d, v, onIso)
    const countries = d.countries.filter((c) => c.ventureId === v.id).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((c) => c.countryCode)
    const founders = flags.founders
    const femaleFounders = flags.femaleFounders
    return [
      {
        ventureId: v.id,
        code: v.code,
        name: v.name,
        sector: v.healthSector,
        source: v.source,
        track: v.track,
        institution: v.institution,
        intakeYear: v.intakeYear,
        yearFounded: v.yearFounded,
        country: countries[0] ?? null,
        countries,
        region: regionOf(countries[0]),
        // The latest update says where the venture stands at that date.
        stage: last.stage,
        status: last.status,
        active: isActive(last.status),
        legalStatus: v.legalStatus,
        inAccelerator: v.inAccelerator,
        womenLed: flags.value.womenLed,
        youthLed: flags.value.youthLed,
        pwdLed: flags.value.pwdLed,
        founders,
        femaleFounders,
        jobsTotal: last.jobsTotal,
        jobsWomen: last.jobsWomen,
        jobsPwd: last.jobsPwd,
        jobsDisplaced: last.jobsDisplaced,
        fundingRaisedUsd: last.fundingUsd,
        chiiFundingUsd: d.awards.filter((a) => a.ventureId === v.id && a.awardedOn <= onIso).reduce((s, a) => s + a.amountUsd, 0),
        revenueUsd: last.revenueUsd,
        latestAsOf: last.asOf,
        baselineAsOf: ups[0].asOf,
      },
    ]
  })
}

export type Change = { field: 'jobsTotal' | 'jobsWomen' | 'jobsPwd' | 'jobsDisplaced' | 'fundingUsd' | 'revenueUsd'; baseline: number | null; latest: number | null; change: number | null }

/** v_venture_change: baseline against the latest accepted update. */
export function ventureChange(d: RegistryData, ventureId: string, onIso = REPORTING_DATE): Change[] {
  const ups = acceptedUpdates(d, ventureId, onIso)
  const base = ups.find((u) => u.updateType === 'baseline') ?? ups[0]
  const last = ups[ups.length - 1]
  if (!base || !last) return []
  return (['jobsTotal', 'jobsWomen', 'jobsPwd', 'jobsDisplaced', 'fundingUsd', 'revenueUsd'] as const).map((field) => {
    const b = base[field]
    const l = last[field]
    return { field, baseline: b, latest: l, change: b == null || l == null ? null : l - b }
  })
}

export type StageMove = { ventureId: string; from: Stage; to: Stage; asOf: string; year: number }

/** v_venture_stage_history: each time a venture's stage changed between accepted updates. */
export function stageHistory(d: RegistryData, onIso = REPORTING_DATE): StageMove[] {
  return d.ventures.flatMap((v) => {
    const ups = acceptedUpdates(d, v.id, onIso)
    return ups.slice(1).flatMap((u, i) => (u.stage !== ups[i].stage ? [{ ventureId: v.id, from: ups[i].stage, to: u.stage, asOf: u.asOf, year: Number(u.asOf.slice(0, 4)) }] : []))
  })
}

/** Unique founders across a set of ventures, by CHII ID (counts only: no IDs leave this function). */
export function uniqueFounders(d: RegistryData, ventureIds: string[], onIso = REPORTING_DATE) {
  const ids = new Set(ventureIds.flatMap((id) => foundersOf(d, id, onIso).map((m) => m.chiiId)))
  const female = [...ids].filter((id) => personById(id)?.gender === 'F').length
  return { total: ids.size, female }
}
