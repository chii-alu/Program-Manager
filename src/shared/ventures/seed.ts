/**
 * Sample registry: ~40 HENT ventures, as if the old venture sheet had been imported, followed
 * by bi-annual survey updates. Founders are existing HENT participants (one CHII ID each), so a
 * founder who did a Masterclass shows it on their venture. A few records are deliberately
 * imperfect so every warning rule (VEN-06 to VEN-11) has something to show.
 */
import { participants } from '../data/mela'
import { toUsd } from './lists'
import { rebuildActivity } from './activity'
import type { RegistrySettings, UpdateLink, VentureSubmission, FundingAward, FundingType, RegistryData, Stage, Venture, VentureCountry, VentureFunding, VentureHistory, VentureMember, VentureStatus, VentureUpdate } from './types'

const NAMES = [
  'AfyaLink', 'MamaCare Health', 'Dawa Direct', 'ScanRight Diagnostics', 'Kijiji Clinics', 'NutriPath', 'MindBridge', 'Sauti Health', 'PharmaTrace', 'CareCredit',
  'OxyGen Devices', 'Lishe Bora', 'Uzazi Salama', 'LabLink Africa', 'TeleDaktari', 'Imara Mental Health', 'RxRoute', 'BloodBank Connect', 'Zuri Maternity', 'Ndoto Optics',
  'HealthPay', 'ColdChain Box', 'Akili Screening', 'DawaDrone', 'Malaika Kids', 'Kinga Insurance', 'Pona Rehab', 'SokoMeds', 'Afya Records', 'Tiba Pulse',
  'Jamii Nurses', 'VitaGrow Nutrition', 'Moyo Cardiology', 'Salama Water Health', 'BioSafe Labs', 'Neema Hearing', 'Faraja Hospice', 'QuickDx',
]
const SECTORS = ['Digital health', 'Diagnostics', 'Pharma & supply chain', 'Primary care', 'Maternal & child health', 'Mental health', 'Nutrition', 'Health financing', 'Medical devices']
const SOURCES = ['Hackathon', 'Masterclass', 'Venture Funding', 'Mentorship', 'Referral', 'Open call']
const TRACKS = ['Incubation', 'Acceleration', 'Venture Funding', 'Alumni']
const COUNTRY_POOL = ['RW', 'RW', 'RW', 'NG', 'NG', 'KE', 'KE', 'GH', 'UG', 'ZA', 'SN', 'ET', 'TZ', 'CM']
const CURRENCY: Record<string, string> = { KE: 'KES', NG: 'NGN' }
const FUNDERS = ['Villgro Africa', 'Grand Challenges Africa', 'Angel investor', 'Seedstars', 'Local bank', 'Bill & Melinda Gates Foundation', 'Startup prize']
const FUND_TYPES: FundingType[] = ['grant', 'grant', 'equity', 'prize', 'debt', 'revenue_based']
const STAGE_ORDER: Stage[] = ['Expose', 'Build', 'Scale']
const TODAY = '2025-11-10'

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export function seedRegistry(): RegistryData {
  const r = rng(2025)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))

  // Founders come from HENT participants; Thabo Nkosi (Masterclass) and Chinedu Eze lead the first two.
  const pool = participants.filter((p) => p.pillars.includes('HENT') && p.age >= 20)
  const first = ['CHII-000279', 'CHII-000248']
  const ordered = [...first.map((id) => pool.find((p) => p.id === id)!), ...pool.filter((p) => !first.includes(p.id))]
  let next = 0
  const takeFounder = () => ordered[next++ % ordered.length]

  const ventures: Venture[] = []
  const countries: VentureCountry[] = []
  const members: VentureMember[] = []
  const updates: VentureUpdate[] = []
  const funding: VentureFunding[] = []
  const awards: FundingAward[] = []
  const history: VentureHistory[] = []

  // Two names that are really one venture, entered twice (VEN-08).
  const names = [...NAMES, 'Mama Care Health Ltd']

  names.forEach((name, i) => {
    const n = i + 1
    const id = `ven-${String(n).padStart(3, '0')}`
    // The first two and the deliberate data quality cases (9, 12, 24) need a few years of updates.
    const intakeYear = i < 2 || [9, 12, 24].includes(n) ? 2023 : r() < 0.3 ? 2023 : r() < 0.6 ? 2024 : 2025
    const yearFounded = Math.max(2016, intakeYear - int(0, 4))
    const country = name === 'Mama Care Health Ltd' ? countryOf(countries, 'ven-002') : i === 0 ? 'ZA' : pick(COUNTRY_POOL)
    const currency = CURRENCY[country] && r() < 0.6 ? CURRENCY[country] : 'USD'
    const source = pick(SOURCES)
    const track = source === 'Venture Funding' ? 'Venture Funding' : pick(TRACKS)
    let stage: Stage = r() < 0.55 ? 'Expose' : r() < 0.8 ? 'Build' : 'Scale'
    let status: VentureStatus = 'Active'

    const baseMonth = intakeYear === 2025 ? int(1, 8) : int(1, 11)
    const baseAsOf = `${intakeYear}-${String(baseMonth).padStart(2, '0')}-15`
    const createdAt = `${baseAsOf}T09:00:00.000Z`

    ventures.push({
      id,
      code: `VEN-${String(n).padStart(4, '0')}`,
      legacyId: `HV-${String(100 + n)}`,
      name,
      description: `${pick(['Affordable', 'Mobile', 'Community', 'AI-assisted', 'Low-cost', 'Last-mile'])} ${pick(['screening', 'care', 'medicine delivery', 'health records', 'diagnostics', 'payments'])} for ${pick(['rural clinics', 'mothers and newborns', 'pharmacies', 'young people', 'informal workers', 'district hospitals'])}.`,
      healthSector: pick(SECTORS),
      source,
      yearFounded,
      intakeYear,
      institution: r() < 0.6 ? 'ALU' : pick(['ALCHE', 'ALX', 'Other']),
      track,
      stage,
      currentStatus: status,
      legalStatus: r() < 0.55 ? 'Registered' : r() < 0.7 ? 'In progress' : 'Informal',
      inAccelerator: r() < 0.28,
      youthLedOverride: null,
      // VEN-06: one venture marked "not women-led" although it has a female founder (set below).
      womenLedOverride: null,
      pwdLedOverride: null,
      createdAt,
      updatedAt: createdAt,
    })
    countries.push({ ventureId: id, countryCode: country, isPrimary: true })
    if (r() < 0.15) countries.push({ ventureId: id, countryCode: pick(COUNTRY_POOL.filter((c) => c !== country)), isPrimary: false })

    // Founders: two ventures have none linked yet (VEN-07); they carry entered counts instead.
    const noFounders = n === 17 || n === 33
    const coCount = noFounders ? 0 : r() < 0.45 ? 0 : r() < 0.75 ? 1 : 2
    if (!noFounders)
      for (let k = 0; k <= coCount; k++) {
        const p = takeFounder()
        members.push({ id: `${id}-m${k}`, ventureId: id, chiiId: p.id, role: k === 0 ? 'lead_founder' : 'co_founder', isPrimary: k === 0, joinedOn: baseAsOf, leftOn: null })
      }

    // Baseline (from the imported sheet), then bi-annual survey updates.
    let jobs = int(1, 8)
    let fundingAmt = r() < 0.5 ? 0 : int(2, 30) * 1000 * (currency === 'USD' ? 1 : currency === 'KES' ? 130 : 1500)
    let revenue = r() < 0.65 ? int(0, 20) * 1000 : null
    const mk = (asOf: string, kind: 'baseline' | 'update', src: VentureUpdate['source'], accepted = true): VentureUpdate => {
      const women = Math.min(jobs, Math.round(jobs * (0.3 + r() * 0.35)))
      const fUsd = toUsd(fundingAmt, currency)
      return {
        id: `${id}-u${updates.filter((u) => u.ventureId === id).length}`,
        ventureId: id,
        updateType: kind,
        asOf,
        source: src,
        stage,
        status,
        cofoundersCount: noFounders ? 2 : null,
        cofoundersFemaleCount: noFounders ? 1 : null,
        jobsTotal: jobs,
        jobsWomen: women,
        jobsPwd: Math.min(jobs, r() < 0.25 ? int(1, 2) : 0),
        jobsDisplaced: Math.min(jobs, r() < 0.15 ? 1 : 0),
        fundingAmount: fundingAmt,
        fundingCurrency: currency,
        fundingUsd: fUsd,
        revenueAmount: revenue,
        revenueCurrency: revenue == null ? null : 'USD',
        revenueUsd: revenue,
        notes: '',
        submittedBy: src === 'import' ? 'Venture sheet import' : src === 'founder_form' ? 'Founder' : 'Bi-annual survey',
        acceptedBy: accepted ? 'Tendai Moyo' : null,
        acceptedAt: accepted ? `${asOf}T12:00:00.000Z` : null,
      }
    }
    updates.push(mk(baseAsOf, 'baseline', 'import'))

    const surveyDates = ['2023-06-30', '2023-12-31', '2024-06-30', '2024-12-31', '2025-06-30'].filter((s) => s > baseAsOf && s <= TODAY)
    const stale = n === 9 // VEN-09: active, last update June 2024
    const closer = n === 24 // VEN-11: closes, yet its jobs go up
    const jumper = n === 12 // VEN-10: jobs jump more than 300%
    surveyDates.forEach((asOf, k) => {
      if (stale && asOf > '2024-06-30') return
      const prevFunding = toUsd(fundingAmt, currency)
      const wasActive = status === 'Active'
      if (closer && k === surveyDates.length - 1) status = 'Closed'
      else if (!closer && wasActive && r() < 0.06) status = pick(['Paused', 'Pivoted', 'Closed', 'Acquired'] as VentureStatus[])
      // Ventures that stop trading keep their last numbers; only the deliberate VEN-11 case grows.
      const growing = status === 'Active' || status === 'Pivoted' || (closer && status === 'Closed')
      if (growing) {
        jobs = jumper && k === surveyDates.length - 1 ? jobs * 5 + 1 : Math.max(0, Math.round(jobs * (0.95 + r() * 0.6)) + (r() < 0.4 ? 1 : 0))
        if (r() < 0.35) fundingAmt += int(5, 60) * 1000 * (currency === 'USD' ? 1 : currency === 'KES' ? 130 : 1500)
        if (revenue != null) revenue = Math.round(revenue * (1 + r() * 0.5)) + int(0, 5) * 1000
        if (r() < 0.22 && stage !== 'Scale') stage = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]
      }
      updates.push(mk(asOf, 'update', 'survey'))
      const added = toUsd(fundingAmt, currency) - prevFunding
      if (added > 0) funding.push({ id: `${id}-f${k}`, ventureId: id, asOf, amount: added, currency: 'USD', amountUsd: added, fundingType: pick(FUND_TYPES), funder: pick(FUNDERS) })
    })

    // A few founder form updates waiting for staff to accept them.
    if (n % 9 === 4 && status === 'Active') {
      jobs += int(1, 4)
      updates.push(mk('2025-10-31', 'update', 'founder_form', false))
    }

    // CHII Venture Funding awards: "Funding Deployed".
    if (track === 'Venture Funding' || source === 'Venture Funding')
      awards.push({ id: `${id}-a`, ventureId: id, awardedOn: baseAsOf, amountUsd: int(5, 50) * 1000, instrument: r() < 0.7 ? 'grant' : 'convertible', cohortId: `vf-${intakeYear}` })

    const last = updates.filter((u) => u.ventureId === id && u.acceptedAt).slice(-1)[0]
    const v = ventures[ventures.length - 1]
    v.stage = last.stage
    v.currentStatus = last.status
    history.push({ id: `${id}-h0`, ventureId: id, at: createdAt, by: 'Venture sheet import', action: 'created', detail: `Imported from the HENT venture sheet (${v.legacyId})` })
  })

  // VEN-06: a manual "No" for women-led on a venture that has a female founder.
  const femaleLed = ventures.find((v) => members.some((m) => m.ventureId === v.id && participants.find((p) => p.id === m.chiiId)?.gender === 'F'))
  if (femaleLed) femaleLed.womenLedOverride = false

  // Founder update round H2 2025: personal links sent on 20 Oct; the founders who answered have pending updates.
  const settings = defaultSettings()
  const round = settings.rounds[settings.rounds.length - 1]
  const links: UpdateLink[] = ventures.flatMap((v, i) => {
    const lead = members.find((m) => m.ventureId === v.id && m.isPrimary)
    if (!lead || v.currentStatus === 'Closed' || v.currentStatus === 'Acquired') return []
    const answered = updates.find((u) => u.ventureId === v.id && u.source === 'founder_form')
    return [{ token: `t${String(i + 1).padStart(3, '0')}${v.code.slice(-2)}x`, ventureId: v.id, roundId: round.id, chiiId: lead.chiiId, createdAt: '2025-10-20T08:00:00.000Z', sentAt: '2025-10-20T08:00:00.000Z', remindedAt: i % 3 === 0 && !answered ? '2025-11-03T08:00:00.000Z' : null, respondedAt: answered ? `${answered.asOf}T15:00:00.000Z` : null, updateId: answered?.id ?? null }]
  })

  // Registrations founders sent through the public form, waiting for staff.
  const tele = ventures.find((v) => v.name === 'TeleDaktari')!
  const teleCountry = countryOf(countries, tele.id)
  const sub = (s: Omit<VentureSubmission, 'status'>): VentureSubmission => ({ ...s, status: 'pending' })
  const submissions: VentureSubmission[] = [
    sub({
      id: 'sub-001', receivedAt: '2025-11-07T10:12:00.000Z', name: 'Mwanga Diagnostics', description: 'Solar-powered rapid test reader for rural clinics.', countries: ['KE'], healthSector: 'Diagnostics', source: 'Open call', yearFounded: 2024, institution: 'Other', legalStatus: 'In progress', stage: 'Expose',
      founders: [{ name: 'Grace Akinyi', email: 'grace.akinyi@mwangadx.co.ke', phone: '+254 712 000 111', gender: 'F', dob: '1997-04-12', disability: false }, { name: 'Peter Otieno', email: 'p.otieno@mwangadx.co.ke', gender: 'M', dob: '1995-09-30' }],
      jobsTotal: 3, jobsWomen: 2, jobsPwd: 0, jobsDisplaced: 0, fundingAmount: 650000, fundingCurrency: 'KES', revenueAmount: null, revenueCurrency: null,
    }),
    sub({
      id: 'sub-002', receivedAt: '2025-11-08T16:40:00.000Z', name: 'AfyaBot', description: 'WhatsApp nurse line for first-time mothers.', countries: ['NG'], healthSector: 'Maternal & child health', source: 'Masterclass', yearFounded: 2025, institution: 'ALU', legalStatus: 'Informal', stage: 'Expose',
      founders: [{ name: 'Aisha Bello', email: 'a.bello@alustudent.com', gender: 'F' }],
      jobsTotal: 1, jobsWomen: 1, jobsPwd: 0, jobsDisplaced: 0, fundingAmount: 0, fundingCurrency: 'USD', revenueAmount: null, revenueCurrency: null,
    }),
    sub({
      id: 'sub-003', receivedAt: '2025-11-09T09:05:00.000Z', name: 'Tele Daktari', description: 'Video consultations for rural patients.', countries: [teleCountry], healthSector: 'Digital health', source: 'Referral', yearFounded: 2023, institution: 'Other', legalStatus: 'Registered', stage: 'Build',
      founders: [{ name: 'Samuel Wekesa', email: 's.wekesa@teledaktari.com', gender: 'M', dob: '1990-02-02' }],
      jobsTotal: 6, jobsWomen: 3, jobsPwd: 1, jobsDisplaced: 0, fundingAmount: 20000, fundingCurrency: 'USD', revenueAmount: 15000, revenueCurrency: 'USD',
    }),
  ]

  // Registrations staff already reviewed, so the registrations log has history.
  const accepted = ventures.filter((v) => v.intakeYear === 2025 && v.name !== 'Mama Care Health Ltd').slice(-1)[0]
  if (accepted) {
    const leadId = members.find((m) => m.ventureId === accepted.id && m.isPrimary)?.chiiId
    const lead = participants.find((p) => p.id === leadId)
    submissions.push({
      id: 'sub-000a', receivedAt: '2025-03-04T11:20:00.000Z', status: 'accepted', name: accepted.name, description: accepted.description, countries: [countryOf(countries, accepted.id)], healthSector: accepted.healthSector, source: accepted.source, yearFounded: accepted.yearFounded, institution: accepted.institution, legalStatus: accepted.legalStatus, stage: 'Expose',
      founders: lead ? [{ name: lead.name, email: lead.email, gender: lead.gender }] : [],
      jobsTotal: 2, jobsWomen: 1, jobsPwd: 0, jobsDisplaced: 0, fundingAmount: 0, fundingCurrency: 'USD', revenueAmount: null, revenueCurrency: null,
      ventureId: accepted.id, reviewedBy: 'Tendai Moyo', reviewedAt: '2025-03-06T09:15:00.000Z',
    })
  }
  submissions.push({
    id: 'sub-000b', receivedAt: '2025-09-15T14:02:00.000Z', status: 'rejected', name: 'QuickFit Gyms', description: 'Chain of budget gyms in Lagos.', countries: ['NG'], healthSector: 'Primary care', source: 'Open call', yearFounded: 2022, institution: 'Other', legalStatus: 'Registered', stage: 'Scale',
    founders: [{ name: 'Tunde Bakare', email: 't.bakare@quickfit.ng', gender: 'M' }],
    jobsTotal: 14, jobsWomen: 5, jobsPwd: 0, jobsDisplaced: 0, fundingAmount: 0, fundingCurrency: 'USD', revenueAmount: null, revenueCurrency: null,
    reviewedBy: 'Amara Okafor', reviewedAt: '2025-09-17T10:40:00.000Z', rejectReason: 'Fitness business, not a health venture in HENT’s scope.',
  })

  const data: RegistryData = { seq: ventures.length, ventures, countries, members, updates, funding, awards, history, submissions, links, settings }
  return { ...data, activity: rebuildActivity(data, 'Tendai Moyo') }
}

export function defaultSettings(): RegistrySettings {
  return {
    registrationOpen: true,
    updateEveryMonths: 6,
    rounds: [
      { id: '2025-H1', label: 'H1 2025 update', opensOn: '2025-06-01', dueOn: '2025-06-30' },
      { id: '2025-H2', label: 'H2 2025 update', opensOn: '2025-10-20', dueOn: '2025-11-30' },
    ],
  }
}

const countryOf = (cs: VentureCountry[], ventureId: string) => cs.find((c) => c.ventureId === ventureId && c.isPrimary)?.countryCode ?? 'RW'
