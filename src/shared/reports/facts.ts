/**
 * The metrics fact table: one row per person × cohort.
 *
 * Every report number is computed from these rows by getMetric (metrics.ts), never from
 * ad-hoc queries, so a number means the same thing everywhere it appears.
 *
 * Privacy: rows carry an opaque person number (`pid`) and aggregatable attributes only.
 * There is no name, email, phone, student ID or CHII ID anywhere in this table, so no
 * report built from it can contain one.
 *
 * The prototype has no database, so the table is generated deterministically from the
 * app's sample people (same people, same interventions), extended with the attributes
 * the report spec needs: cohorts, per-session attendance, the ten core feedback items,
 * outcomes and the extra demographics.
 */
import { Pillar, interventions as catalogue, participants } from '../data/mela'
import { TODAY } from '../lib/time'

export const FEEDBACK_ITEMS = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'quality', label: 'Quality' },
  { key: 'utility', label: 'Utility' },
  { key: 'skills_confidence', label: 'Skills confidence' },
  { key: 'health_systems_knowledge', label: 'Health systems knowledge' },
  { key: 'employment_pathway_exposure', label: 'Employment pathway exposure' },
  { key: 'practical_skills', label: 'Practical skills' },
  { key: 'professional_networking', label: 'Professional networking' },
  { key: 'career_clarity', label: 'Career clarity' },
  { key: 'health_mission_confidence', label: 'Health mission confidence' },
] as const
export type FeedbackItem = (typeof FEEDBACK_ITEMS)[number]['key']

export type CohortStatus = 'completed' | 'ongoing' | 'upcoming'

export type Cohort = {
  id: string
  name: string
  pillar: Pillar
  intervention: string
  start: string
  end: string
  status: CohortStatus
  /** Meetings planned for the whole cohort. */
  sessionsPlanned: number
  /** Meetings that have taken place by today. */
  sessionsHeld: number
}

export type Fact = {
  /** Opaque person number. Not the CHII ID and not reversible to it. */
  pid: number
  pillar: Pillar
  intervention: string
  kind: 'open' | 'selective'
  cohortId: string
  cohortName: string
  cohortStatus: CohortStatus
  /** The three dates a report's date rule can pick from (ISO). */
  sessionDate: string
  registeredOn: string
  respondedOn: string | null
  /** Person's first registration anywhere at CHII, for new vs returning. */
  firstRegisteredOn: string
  /* Intake */
  applied: boolean
  selected: boolean
  waitlisted: boolean
  /** Open interventions: registered. Selective: selected. The base for attendance. */
  eligible: boolean
  /* Participation */
  sessionsHeld: number
  sessionsAttended: number
  attended: boolean
  completed: boolean
  /* Feedback */
  responded: boolean
  nps: number | null
  items: Record<FeedbackItem, number> | null
  /* Outcomes */
  placed: boolean
  job: boolean
  furtherStudy: boolean
  ventureStarted: boolean
  fundingAmount: number | null
  /* Demographics (aggregate use only) */
  gender: string
  ageGroup: string
  nationality: string
  residence: string
  disability: string
  humanitarian: string
  beneficiaryType: string
}

/* ---------- Deterministic helpers ---------- */

function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const DAY = 86_400_000
const todayUtc = Date.UTC(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate())
/** ISO date `n` days from today (negative = past). */
export const isoFromToday = (n: number) => new Date(todayUtc + n * DAY).toISOString().slice(0, 10)
export const TODAY_ISO = isoFromToday(0)
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10)

export const ageGroup = (age: number) => (age <= 20 ? '18–20' : age <= 24 ? '21–24' : age <= 29 ? '25–29' : '30+')

/* ---------- Cohorts ---------- */

/** Meetings per cohort: one-off events are 1–3 days, programmes meet for weeks. */
const meetings: Record<string, number> = {
  Masterclass: 2,
  Hackathon: 3,
  Mentorship: 8,
  'Venture Funding': 6,
  SIE: 10,
  'Career Exposure': 1,
  Internships: 12,
  'Career Workshops': 3,
  'Public Sector Fellowship': 10,
  'Health Expert in Residence': 6,
  'Executive Courses': 4,
}

function buildCohorts(): Cohort[] {
  return catalogue.flatMap((iv, ix) => {
    const n = meetings[iv.name] ?? 3
    const lengthDays = iv.kind === 'selective' ? n * 7 : n
    // Six cohorts about a quarter apart over ~17 months (the last current or upcoming),
    // staggered per intervention so every quarter has activity to report on.
    const starts = [-490, -400, -310, -220, -130, -40].map((d) => d + ((ix * 11) % 40))
    return starts.map((offset, k) => {
      const start = isoFromToday(offset)
      const end = addDays(start, lengthDays - 1)
      const status: CohortStatus = start > TODAY_ISO ? 'upcoming' : end < TODAY_ISO ? 'completed' : 'ongoing'
      const elapsed = Math.max(0, Math.min(lengthDays, Math.round((todayUtc - Date.parse(start)) / DAY) + 1))
      const sessionsHeld = status === 'upcoming' ? 0 : status === 'completed' ? n : Math.max(1, Math.round((elapsed / lengthDays) * n))
      return {
        id: `${iv.id}-c${k + 1}`,
        name: `${iv.name} · Cohort ${k + 1}`,
        pillar: iv.pillar,
        intervention: iv.name,
        start,
        end,
        status,
        sessionsPlanned: n,
        sessionsHeld,
      }
    })
  })
}

export const cohorts: Cohort[] = buildCohorts()

/* ---------- Facts ---------- */

/**
 * People behind the facts: the app's named sample people (so reach lines up with the rest
 * of the app) plus a larger anonymous population, because real CHII cohorts are far bigger
 * than the 179 named samples (SIE Cohort 4 alone has 312 registrations). The extra people
 * have no names or IDs at all: reports only ever see aggregates.
 */
type PersonSeed = { gender: 'F' | 'M'; age: number; country: string; pillars: Pillar[]; interventions: string[]; attendance: number }

const EXTRA_PEOPLE = 720
const COUNTRIES = ['Rwanda', 'Rwanda', 'Rwanda', 'Nigeria', 'Nigeria', 'Kenya', 'Kenya', 'Ghana', 'Uganda', 'Tanzania', 'South Africa', 'Senegal', 'Ethiopia', 'Zimbabwe', 'Cameroon']

function extraPeople(): PersonSeed[] {
  const r = rng(2026)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const byPillar = (p: Pillar) => catalogue.filter((i) => i.pillar === p).map((i) => i.name)
  return Array.from({ length: EXTRA_PEOPLE }, () => {
    const roll = r()
    const main: Pillar = roll < 0.32 ? 'HENT' : roll < 0.84 ? 'HEMP' : 'HECO'
    const pillars: Pillar[] = r() < 0.15 ? [...new Set<Pillar>([main, pick<Pillar>(['HENT', 'HEMP', 'HECO'])])] : [main]
    const interventions = [...new Set(pillars.flatMap((p) => [pick(byPillar(p)), ...(r() < 0.3 ? [pick(byPillar(p))] : [])]))]
    return {
      gender: r() < 0.56 ? 'F' : 'M',
      age: 18 + Math.floor(Math.pow(r(), 1.4) * 17),
      country: pick(COUNTRIES),
      pillars,
      interventions,
      attendance: r() < 0.08 ? 0 : Math.round(45 + r() * 55),
    }
  })
}

const PEOPLE: PersonSeed[] = [...participants.map((p) => ({ gender: p.gender, age: p.age, country: p.country, pillars: p.pillars, interventions: p.interventions, attendance: p.attendance })), ...extraPeople()]

const RESIDENCE_HUBS = ['Rwanda', 'Rwanda', 'Kenya', 'Nigeria']
const TYPES = ['Student', 'Student', 'Student', 'Alumni', 'Alumni', 'Founder', 'Professional']

function buildFacts(): Fact[] {
  const facts: Fact[] = []
  PEOPLE.forEach((person, pid) => {
    const r = rng(1000 + pid * 97)
    // Person-level attributes, stable across all of their cohorts.
    const nationality = person.country
    const residence = r() < 0.55 ? nationality : RESIDENCE_HUBS[Math.floor(r() * RESIDENCE_HUBS.length)]
    const disability = r() < 0.06 ? 'Yes' : r() < 0.1 ? 'Not given' : 'No'
    const hRoll = r()
    const humanitarian = hRoll < 0.04 ? 'Refugee' : hRoll < 0.06 ? 'Internally displaced' : hRoll < 0.12 ? 'Not given' : 'None'
    const beneficiaryType = person.pillars.includes('HENT') && r() < 0.35 ? 'Founder' : TYPES[Math.floor(r() * TYPES.length)]
    const gender = person.gender === 'F' ? 'Female' : 'Male'

    const mine: Fact[] = []
    person.interventions.forEach((ivName) => {
      const iv = catalogue.find((x) => x.name === ivName)
      if (!iv) return
      const ivCohorts = cohorts.filter((c) => c.intervention === ivName)
      // Most people take one cohort; some come back for another.
      const picks = new Set<number>([Math.min(ivCohorts.length - 1, Math.floor(Math.pow(r(), 0.7) * ivCohorts.length))])
      if (r() < 0.3) picks.add(Math.floor(r() * ivCohorts.length))
      picks.forEach((ci) => {
        const c = ivCohorts[ci]
        const registeredOn = addDays(c.start, -(3 + Math.floor(r() * 28)))
        const selective = iv.kind === 'selective'
        const applied = selective
        const selected = selective ? r() < 0.58 : false
        const waitlisted = selective && !selected && r() < 0.25
        const eligible = selective ? selected : true
        const showRate = person.attendance / 100
        const attended = eligible && c.sessionsHeld > 0 && r() < Math.max(0.35, Math.min(0.97, showRate + 0.2))
        const sessionsAttended = attended ? Math.max(1, Math.round(c.sessionsHeld * Math.max(0.25, Math.min(1, showRate + (r() - 0.4) * 0.4)))) : 0
        const completed = attended && c.status === 'completed' && sessionsAttended >= 0.75 * c.sessionsHeld
        const canRespond = attended && (c.status === 'completed' || (c.status === 'ongoing' && c.sessionsHeld >= 2))
        const responded = canRespond && r() < (ivName === 'Career Exposure' ? 0.3 : 0.5)
        const respondedOn = responded ? (c.status === 'completed' ? addDays(c.end, 1 + Math.floor(r() * 9)) : addDays(TODAY_ISO, -Math.floor(r() * 5))) : null
        // Feedback: one underlying "experience" score per response, plus item-level noise.
        const base = 3.1 + r() * 1.9 - (ivName === 'Career Exposure' ? 0.5 : 0) - (ivName === 'Hackathon' ? 0.2 : 0)
        const items = responded
          ? (Object.fromEntries(FEEDBACK_ITEMS.map((it) => [it.key, Math.max(1, Math.min(5, Math.round(base + (r() - 0.5) * 1.4)))])) as Record<FeedbackItem, number>)
          : null
        const nps = responded ? Math.max(0, Math.min(10, Math.round(base * 2 + (r() - 0.5) * 2.5))) : null
        // Outcomes, only for people who completed the relevant programme.
        const placed = completed && ivName === 'Internships'
        const job = completed && (ivName === 'SIE' || ivName === 'Career Exposure') && r() < 0.32
        const furtherStudy = completed && r() < 0.07
        const ventureStarted = completed && (ivName === 'Hackathon' || ivName === 'Mentorship') && r() < 0.18
        const fundingAmount = ivName === 'Venture Funding' && selected ? Math.round((2000 + r() * 13000) / 500) * 500 : null

        mine.push({
          pid,
          pillar: iv.pillar,
          intervention: ivName,
          kind: iv.kind,
          cohortId: c.id,
          cohortName: c.name,
          cohortStatus: c.status,
          sessionDate: c.start,
          registeredOn,
          respondedOn,
          firstRegisteredOn: registeredOn,
          applied,
          selected,
          waitlisted,
          eligible,
          sessionsHeld: c.sessionsHeld,
          sessionsAttended,
          attended,
          completed,
          responded,
          nps,
          items,
          placed,
          job,
          furtherStudy,
          ventureStarted,
          fundingAmount,
          gender,
          ageGroup: ageGroup(person.age),
          nationality,
          residence,
          disability,
          humanitarian,
          beneficiaryType,
        })
      })
    })
    const first = mine.reduce((m, f) => (f.registeredOn < m ? f.registeredOn : m), '9999-12-31')
    mine.forEach((f) => facts.push({ ...f, firstRegisteredOn: first }))
  })
  return facts
}

export const facts: Fact[] = buildFacts()
