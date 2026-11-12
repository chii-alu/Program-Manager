import { beforeEach, describe, expect, it } from 'vitest'
import { ventureChange, ventureLatest } from './derive'
import { resetPeople } from './people'
import {
  FormClosedError,
  VentureValidationError,
  acceptSubmission,
  acceptUpdate,
  checkRegistration,
  createRoundLinks,
  currentRound,
  getRegistry,
  linkByToken,
  markLinks,
  rejectSubmission,
  resetRegistry,
  setRegistrationOpen,
  submitFounderUpdate,
  submitRegistration,
  type RegistrationInput,
} from './store'

beforeEach(() => {
  resetPeople()
  resetRegistry()
})

const reg = (over: Partial<RegistrationInput> = {}): RegistrationInput => ({
  name: 'Kliniki Mobile',
  description: 'Mobile clinic scheduling',
  countries: ['RW'],
  healthSector: 'Primary care',
  source: 'Open call',
  yearFounded: 2024,
  institution: 'ALU',
  legalStatus: 'Informal',
  stage: 'Expose',
  founders: [
    { name: 'Thabo Nkosi', email: 'T.Nkosi@outlook.com', gender: 'M' },
    { name: 'New Cofounder', email: 'new.co@example.com', gender: 'F' },
  ],
  jobsTotal: 3,
  jobsWomen: 1,
  jobsPwd: 0,
  jobsDisplaced: 0,
  fundingAmount: 0,
  fundingCurrency: 'USD',
  revenueAmount: null,
  revenueCurrency: null,
  ...over,
})

describe('venture registration form', () => {
  it('a registration waits for review and adds nothing to the registry', () => {
    const before = getRegistry().ventures.length
    submitRegistration(reg())
    expect(getRegistry().ventures.length).toBe(before)
    expect(getRegistry().submissions!.filter((s) => s.status === 'pending').length).toBe(4) // 3 sample + this one
  })

  it('is checked like the registry: missing fields and women jobs above total are refused', () => {
    expect(checkRegistration(reg({ name: '', countries: [] }))[0]).toMatch(/Add your venture’s name and country/)
    expect(() => submitRegistration(reg({ jobsTotal: 1, jobsWomen: 2 }))).toThrow(VentureValidationError)
    expect(checkRegistration(reg({ founders: [{ name: '', email: '', gender: 'F' }] }))).toContain('Add the lead founder’s name and email.')
  })

  it('can’t be sent when the form is closed', () => {
    setRegistrationOpen(false, 'Tendai Moyo')
    expect(() => submitRegistration(reg())).toThrow(FormClosedError)
  })

  it('accepting creates the venture, matches founders to CHII IDs, and stores the numbers as the baseline', () => {
    const s = submitRegistration(reg())
    const v = acceptSubmission(s.id, { intakeYear: 2025, track: 'Incubation' }, 'Staff')
    const d = getRegistry()
    const members = d.members.filter((m) => m.ventureId === v.id)
    expect(members.map((m) => m.role)).toEqual(['lead_founder', 'co_founder'])
    expect(members[0].chiiId).toBe('CHII-000279') // matched by email, any case
    expect(d.updates.find((u) => u.ventureId === v.id)).toMatchObject({ updateType: 'baseline', source: 'founder_form', jobsTotal: 3 })
    expect(d.submissions!.find((x) => x.id === s.id)).toMatchObject({ status: 'accepted', ventureId: v.id })
    expect(() => acceptSubmission(s.id, { intakeYear: 2025, track: 'Incubation' }, 'Staff')).toThrow(/already been reviewed/)
  })

  it('a declined registration keeps its reason and never enters the registry', () => {
    const before = getRegistry().ventures.length
    const s = submitRegistration(reg())
    rejectSubmission(s.id, 'Duplicate of VEN-0001', 'Staff')
    expect(getRegistry().submissions!.find((x) => x.id === s.id)).toMatchObject({ status: 'rejected', rejectReason: 'Duplicate of VEN-0001' })
    expect(getRegistry().ventures.length).toBe(before)
  })
})

describe('founder update form', () => {
  it('each active venture with a lead founder has one link per round; closed ones get none', () => {
    const d = getRegistry()
    const round = currentRound(d)
    const links = d.links!.filter((l) => l.roundId === round.id)
    expect(new Set(links.map((l) => l.ventureId)).size).toBe(links.length)
    for (const l of links) expect(['Closed', 'Acquired']).not.toContain(d.ventures.find((v) => v.id === l.ventureId)!.currentStatus)
    expect(createRoundLinks('Tendai Moyo')).toBe(0) // already created
  })

  it('a founder update waits for staff; once accepted it changes the latest values but not the baseline', () => {
    const d = getRegistry()
    const link = d.links!.find((l) => !l.respondedAt)!
    const before = ventureLatest(d).find((r) => r.ventureId === link.ventureId)!
    const baseline = ventureChange(d, link.ventureId).find((c) => c.field === 'jobsTotal')!.baseline
    const u = submitFounderUpdate(link.token, {
      asOf: '2025-11-10', stage: before.stage, status: 'Active', cofoundersCount: null, cofoundersFemaleCount: null,
      jobsTotal: before.jobsTotal + 3, jobsWomen: 1, jobsPwd: 0, jobsDisplaced: 0, fundingAmount: 0, fundingCurrency: 'USD', revenueAmount: null, revenueCurrency: null, notes: 'Hired 3',
    })
    expect(linkByToken(link.token)).toMatchObject({ updateId: u.id })
    expect(linkByToken(link.token)!.respondedAt).not.toBeNull()
    expect(ventureLatest(getRegistry()).find((r) => r.ventureId === link.ventureId)!.jobsTotal).toBe(before.jobsTotal)
    acceptUpdate(u.id, 'Staff')
    expect(ventureLatest(getRegistry()).find((r) => r.ventureId === link.ventureId)!.jobsTotal).toBe(before.jobsTotal + 3)
    expect(ventureChange(getRegistry(), link.ventureId).find((c) => c.field === 'jobsTotal')!.baseline).toBe(baseline)
  })

  it('an unknown link is refused', () => {
    expect(() => submitFounderUpdate('nope', {} as never)).toThrow(FormClosedError)
  })

  it('sending and reminding are recorded per link', () => {
    const l = getRegistry().links![0]
    markLinks([l.token], 'reminded', 'Tendai Moyo')
    expect(linkByToken(l.token)!.remindedAt).not.toBeNull()
  })
})
