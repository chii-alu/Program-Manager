/** The registry's activity log: every registration and update-round action says who and when. */
import { beforeEach, describe, expect, it } from 'vitest'
import { bounds, previous, rangeLabel } from '../lib/time'
import { rebuildActivity } from './activity'
import { resetPeople } from './people'
import {
  acceptSubmission,
  acceptUpdate,
  createRoundLinks,
  getRegistry,
  markLinks,
  rejectSubmission,
  resetRegistry,
  setRegistrationOpen,
  setUpdateSchedule,
  submitFounderUpdate,
  submitRegistration,
} from './store'
import type { ActivityEntry } from './types'

beforeEach(() => {
  resetPeople()
  resetRegistry()
})

const last = (): ActivityEntry => getRegistry().activity!.slice(-1)[0]
const pending = () => getRegistry().submissions!.filter((s) => s.status === 'pending')

describe('registrations log', () => {
  it('the sample data already has received, accepted and declined registrations, with who reviewed them', () => {
    const a = getRegistry().activity!.filter((e) => e.area === 'registrations')
    expect(a.some((e) => e.action === 'registration_accepted' && e.by === 'Tendai Moyo' && e.ventureId)).toBe(true)
    expect(a.some((e) => e.action === 'registration_declined' && e.detail.includes('not a health venture'))).toBe(true)
    expect(a.filter((e) => e.action === 'registration_received').length).toBe(getRegistry().submissions!.length)
  })

  it('accepting logs who did it and the Venture ID it became', () => {
    const s = pending()[0]
    const v = acceptSubmission(s.id, { intakeYear: 2025, track: 'Incubation' }, 'Tendai Moyo')
    expect(last()).toMatchObject({ area: 'registrations', action: 'registration_accepted', by: 'Tendai Moyo', ventureId: v.id, submissionId: s.id })
    expect(last().detail).toContain(v.code)
  })

  it('declining logs who, and the reason', () => {
    const s = pending()[0]
    rejectSubmission(s.id, 'Duplicate of VEN-0012', 'Amara Okafor')
    expect(last()).toMatchObject({ action: 'registration_declined', by: 'Amara Okafor' })
    expect(last().detail).toContain('Duplicate of VEN-0012')
    expect(() => rejectSubmission(s.id, 'again', 'Amara Okafor')).toThrow()
  })

  it('a new registration and closing the form are logged', () => {
    const before = getRegistry().activity!.length
    submitRegistration({
      name: 'Kliniki Mobile', description: 'x', countries: ['RW'], healthSector: 'Primary care', source: 'Open call', yearFounded: 2024, institution: 'ALU', legalStatus: 'Informal', stage: 'Expose',
      founders: [{ name: 'A Founder', email: 'a@example.com', gender: 'F' }], jobsTotal: 1, jobsWomen: 1, jobsPwd: 0, jobsDisplaced: 0, fundingAmount: 0, fundingCurrency: 'USD', revenueAmount: null, revenueCurrency: null,
    })
    expect(last()).toMatchObject({ action: 'registration_received', by: 'Registration form' })
    setRegistrationOpen(false, 'Tendai Moyo')
    expect(last()).toMatchObject({ action: 'form_closed', by: 'Tendai Moyo' })
    setRegistrationOpen(false, 'Tendai Moyo') // no change, no entry
    expect(getRegistry().activity!.length).toBe(before + 2)
  })

  it('log entries never contain founder names or emails', () => {
    const json = JSON.stringify(getRegistry().activity)
    for (const s of getRegistry().submissions!) for (const f of s.founders) expect(json).not.toContain(f.email)
    expect(json).not.toMatch(/@/)
  })
})

describe('update round log', () => {
  it('sending and reminding log who, how many, and the round', () => {
    const d = getRegistry()
    const tokens = d.links!.slice(0, 3).map((l) => l.token)
    markLinks(tokens, 'reminded', 'Tendai Moyo')
    expect(last()).toMatchObject({ area: 'updates', action: 'links_reminded', by: 'Tendai Moyo', count: 3 })
    expect(last().detail).toMatch(/Reminded 3 links · H2 2025/)
  })

  it('creating links, a founder answer, accepting it and a schedule change are all logged', () => {
    expect(createRoundLinks('Tendai Moyo')).toBe(0) // all exist: nothing logged
    expect(last().action).not.toBe('links_created')
    const link = getRegistry().links!.find((l) => !l.respondedAt)!
    const u = submitFounderUpdate(link.token, {
      asOf: '2025-11-10', stage: 'Build', status: 'Active', cofoundersCount: null, cofoundersFemaleCount: null,
      jobsTotal: 9, jobsWomen: 1, jobsPwd: 0, jobsDisplaced: 0, fundingAmount: 0, fundingCurrency: 'USD', revenueAmount: null, revenueCurrency: null, notes: '',
    })
    expect(last()).toMatchObject({ action: 'founder_update_received', by: 'Founder update form', ventureId: link.ventureId })
    acceptUpdate(u.id, 'Tendai Moyo')
    expect(last()).toMatchObject({ action: 'update_accepted', by: 'Tendai Moyo', ventureId: link.ventureId })
    setUpdateSchedule(12, 'Amara Okafor')
    expect(last()).toMatchObject({ action: 'schedule_changed', by: 'Amara Okafor', detail: 'Changed update rounds from every 6 to every 12 months' })
  })

  it('registries saved before the log get one rebuilt from their records', () => {
    const { activity, ...old } = getRegistry()
    void activity
    const rebuilt = rebuildActivity(old)
    expect(rebuilt.some((e) => e.action === 'links_sent' && e.by === 'HENT team (not recorded)' && (e.count ?? 0) > 1)).toBe(true)
    expect(rebuilt.some((e) => e.action === 'founder_update_received')).toBe(true)
    expect(rebuilt.map((e) => e.at)).toEqual([...rebuilt.map((e) => e.at)].sort())
  })
})

describe('the top bar’s calendar-year period', () => {
  it('a past year is 1 Jan – 31 Dec; the current year runs to today', () => {
    const b24 = bounds({ preset: 'year', year: 2024 })
    expect([b24.start.toDateString(), b24.end.toDateString()]).toEqual([new Date(2024, 0, 1).toDateString(), new Date(2024, 11, 31).toDateString()])
    expect(bounds({ preset: 'year', year: 2025 }).end.toDateString()).toBe(new Date(2025, 10, 10).toDateString())
    expect(rangeLabel({ preset: 'year', year: 2024 })).toBe('Year 2024')
    expect(rangeLabel({ preset: 'year', year: 2025 })).toBe('2025 (year to date)')
  })
  it('compares with the same dates a year earlier', () => {
    expect(previous({ preset: 'year', year: 2025 })).toEqual({ preset: 'custom', from: '2024-01-01', to: '2024-11-10' })
  })
})
