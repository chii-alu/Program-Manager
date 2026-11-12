import { beforeEach, describe, expect, it } from 'vitest'
import { participants } from '../data/mela'
import { REPORTING_DATE, deriveFlags, stageHistory, uniqueFounders, ventureChange, ventureLatest } from './derive'
import { regionOf, toUsd } from './lists'
import { interventionsOf, personById, resetPeople, resolveBeneficiary } from './people'
import { runVentureChecks, similar, validateUpdate } from './quality'
import { VentureValidationError, acceptUpdate, addUpdate, canUseVentures, createVenture, getRegistry, resetRegistry, type UpdateInput, type VentureInput } from './store'

beforeEach(() => {
  resetPeople()
  resetRegistry()
})

const venture = (over: Partial<VentureInput> = {}): VentureInput => ({
  name: 'Test Health Venture',
  description: 'Testing',
  healthSector: 'Digital health',
  source: 'Hackathon',
  yearFounded: 2023,
  intakeYear: 2024,
  institution: 'ALU',
  track: 'Incubation',
  legalStatus: 'Registered',
  inAccelerator: false,
  youthLedOverride: null,
  womenLedOverride: null,
  pwdLedOverride: null,
  countries: ['RW'],
  ...over,
})
const baseline = (over: Partial<UpdateInput> = {}): UpdateInput => ({
  asOf: '2024-03-01',
  stage: 'Expose',
  status: 'Active',
  cofoundersCount: null,
  cofoundersFemaleCount: null,
  jobsTotal: 4,
  jobsWomen: 2,
  jobsPwd: 0,
  jobsDisplaced: 0,
  fundingAmount: 10000,
  fundingCurrency: 'USD',
  revenueAmount: 5000,
  revenueCurrency: 'USD',
  notes: '',
  ...over,
})
const founder = (name: string, email: string, gender: 'F' | 'M' = 'F') => ({ person: { name, email, gender, dob: '1999-05-01' }, role: 'lead_founder' as const })

describe('founders are people with a CHII ID (spec §2, §7)', () => {
  it('a founder who attended a HENT Masterclass keeps one CHII ID, and the venture shows the Masterclass', () => {
    const thabo = participants.find((p) => p.id === 'CHII-000279')!
    expect(thabo.interventions).toContain('Masterclass')
    const first = getRegistry().members.find((m) => m.ventureId === 'ven-001' && m.isPrimary)!
    expect(first.chiiId).toBe('CHII-000279')
    expect(interventionsOf(first.chiiId)).toContain('Masterclass')
    // Matching the same person again by email (any case) finds the same CHII ID.
    expect(resolveBeneficiary({ name: thabo.name, email: thabo.email.toUpperCase() })).toEqual({ chiiId: 'CHII-000279', matchedOn: 'email', created: false })
  })

  it('a new founder gets a new CHII ID once; importing them again matches it', () => {
    const a = resolveBeneficiary({ name: 'New Founder', email: 'new.founder@example.com', gender: 'F' })
    expect(a.created).toBe(true)
    const b = resolveBeneficiary({ name: 'New Founder', email: ' New.Founder@example.com ' })
    expect(b).toEqual({ chiiId: a.chiiId, matchedOn: 'email', created: false })
  })

  it('a founder can’t be added without an email, phone or student ID', () => {
    expect(() => resolveBeneficiary({ name: 'No Contact' })).toThrow(/email, phone number or student ID/)
  })
})

describe('creating ventures', () => {
  it('gives sequential Venture IDs that are never reused', () => {
    const before = getRegistry().seq
    const { venture: v } = createVenture(venture(), [founder('A Founder', 'a.founder@example.com')], baseline(), 'Staff')
    expect(v.code).toBe(`VEN-${String(before + 1).padStart(4, '0')}`)
    expect(getRegistry().seq).toBe(before + 1)
  })

  it('importing the same venture twice is blocked, and founders aren’t duplicated', () => {
    const people = () => getRegistry().members.length
    createVenture(venture(), [founder('A Founder', 'a.founder@example.com')], baseline(), 'Import', 'import')
    const after = people()
    expect(() => createVenture(venture({ name: 'test health venture ' }), [founder('A Founder', 'a.founder@example.com')], baseline(), 'Import', 'import')).toThrow(/already exists/)
    expect(people()).toBe(after)
  })

  it('women jobs greater than total jobs is blocked with a clear message', () => {
    try {
      createVenture(venture(), [], baseline({ jobsTotal: 3, jobsWomen: 5 }), 'Staff')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(VentureValidationError)
      expect((e as VentureValidationError).messages).toContain('Women jobs (5) can’t be more than total jobs (3).')
    }
  })

  it('other blocking rules: missing fields, year founded, negative funding, female co-founders', () => {
    expect(() => createVenture(venture({ name: '', countries: [] }), [], baseline(), 'Staff')).toThrow(/name and country of operation/)
    expect(() => createVenture(venture({ yearFounded: 1985 }), [], baseline(), 'Staff')).toThrow(/between 1990/)
    expect(validateUpdate(baseline({ fundingAmount: -5 }))).toContain('Funding raised can’t be negative.')
    expect(validateUpdate(baseline({ cofoundersCount: 1, cofoundersFemaleCount: 2 }))).toContain('Female co-founders (2) can’t be more than co-founders (1).')
  })
})

describe('updates (spec §2, §7)', () => {
  it('a founder update changes the latest values and the change since baseline once accepted; the baseline stays', () => {
    const { venture: v } = createVenture(venture(), [founder('A Founder', 'a.founder@example.com')], baseline(), 'Staff')
    const u = addUpdate(v.id, { ...baseline(), asOf: '2025-06-30', stage: 'Build', jobsTotal: 9, jobsWomen: 5, fundingAmount: 40000 }, 'Founder', 'founder_form')
    // Pending: nothing changes yet.
    expect(ventureLatest(getRegistry()).find((r) => r.ventureId === v.id)!.jobsTotal).toBe(4)
    acceptUpdate(u.id, 'Staff')
    const row = ventureLatest(getRegistry()).find((r) => r.ventureId === v.id)!
    expect(row.jobsTotal).toBe(9)
    expect(row.stage).toBe('Build')
    const jobs = ventureChange(getRegistry(), v.id).find((c) => c.field === 'jobsTotal')!
    expect(jobs).toEqual({ field: 'jobsTotal', baseline: 4, latest: 9, change: 5 })
    expect(getRegistry().updates.find((x) => x.ventureId === v.id && x.updateType === 'baseline')!.jobsTotal).toBe(4)
    expect(getRegistry().ventures.find((x) => x.id === v.id)!.stage).toBe('Build')
    expect(stageHistory(getRegistry()).some((m) => m.ventureId === v.id && m.from === 'Expose' && m.to === 'Build' && m.year === 2025)).toBe(true)
  })

  it('funding is kept in its own currency and in USD', () => {
    const { venture: v } = createVenture(venture(), [], baseline({ fundingAmount: 1_300_000, fundingCurrency: 'KES' }), 'Staff')
    const u = getRegistry().updates.find((x) => x.ventureId === v.id)!
    expect(u.fundingAmount).toBe(1_300_000)
    expect(u.fundingUsd).toBe(toUsd(1_300_000, 'KES'))
  })
})

describe('derived flags (MELA decisions)', () => {
  it('women-led means at least one female founder', () => {
    const { venture: v } = createVenture(venture(), [founder('Lead Man', 'lead.man@example.com', 'M'), { ...founder('Co Woman', 'co.woman@example.com', 'F'), role: 'co_founder' }], baseline(), 'Staff')
    expect(deriveFlags(getRegistry(), getRegistry().ventures.find((x) => x.id === v.id)!).derived.womenLed).toBe(true)
  })
  it('a manual value that disagrees with the founders is flagged (VEN-06)', () => {
    const { venture: v } = createVenture(venture({ womenLedOverride: false }), [founder('A Woman', 'a.woman@example.com', 'F')], baseline(), 'Staff')
    expect(runVentureChecks(getRegistry()).some((i) => i.rule === 'VEN-06' && i.ventureId === v.id)).toBe(true)
  })
  it('youth-led uses the lead founder’s age on the reporting date', () => {
    const young = createVenture(venture({ name: 'Young' }), [{ person: { name: 'Y', email: 'y@example.com', gender: 'F', dob: '1995-01-01' }, role: 'lead_founder' }], baseline(), 'Staff').venture
    const older = createVenture(venture({ name: 'Older' }), [{ person: { name: 'O', email: 'o@example.com', gender: 'F', dob: '1980-01-01' }, role: 'lead_founder' }], baseline(), 'Staff').venture
    const d = getRegistry()
    expect(deriveFlags(d, d.ventures.find((x) => x.id === young.id)!).derived.youthLed).toBe(true)
    expect(deriveFlags(d, d.ventures.find((x) => x.id === older.id)!).derived.youthLed).toBe(false)
  })
  it('region comes from the country of operation', () => {
    expect(regionOf('RW')).toBe('East Africa')
    expect(regionOf('NG')).toBe('West Africa')
    expect(regionOf('GB')).toBe('Outside Africa')
  })
})

describe('access (spec §1, §7)', () => {
  it('HENT staff and MELA admin only', () => {
    expect(canUseVentures({ role: 'admin', pillars: ['HENT', 'HEMP', 'HECO'] })).toBe(true)
    expect(canUseVentures({ role: 'pillar_staff', pillars: ['HENT'] })).toBe(true)
    expect(canUseVentures({ role: 'pillar_lead', pillars: ['HENT'] })).toBe(true)
    expect(canUseVentures({ role: 'pillar_staff', pillars: ['HEMP'] })).toBe(false)
    expect(canUseVentures({ role: 'pillar_lead', pillars: ['HECO'] })).toBe(false)
    expect(canUseVentures({ role: 'reviewer', pillars: [] })).toBe(false)
  })
})

describe('privacy (spec §4, §7)', () => {
  it('analytics rows contain no founder names, emails or CHII IDs', () => {
    const d = getRegistry()
    const json = JSON.stringify([ventureLatest(d), stageHistory(d), d.ventures.map((v) => ventureChange(d, v.id)), uniqueFounders(d, d.ventures.map((v) => v.id))])
    expect(json).not.toMatch(/CHII-\d{6}/)
    expect(json).not.toMatch(/@/)
    for (const m of d.members) expect(json).not.toContain(personById(m.chiiId)!.name)
  })
})

describe('sample registry data checks (spec §5)', () => {
  it('every warning rule has an example, and there are no critical issues', () => {
    const issues = runVentureChecks(getRegistry(), REPORTING_DATE)
    for (const rule of ['VEN-06', 'VEN-07', 'VEN-08', 'VEN-09', 'VEN-10', 'VEN-11']) expect(issues.some((i) => i.rule === rule)).toBe(true)
    expect(issues.filter((i) => i.severity === 'critical')).toEqual([])
  })
  it('duplicate names are matched loosely', () => {
    expect(similar('MamaCare Health', 'Mama Care Health Ltd')).toBe(true)
    expect(similar('AfyaLink', 'Dawa Direct')).toBe(false)
  })
})
