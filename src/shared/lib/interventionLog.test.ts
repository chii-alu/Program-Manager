import { beforeEach, describe, expect, it } from 'vitest'
import { participants } from '../data/mela'
import { entriesFor, getLog, logAction, resetLog } from './interventionLog'

beforeEach(() => resetLog())

describe('Interventions activity log', () => {
  it('has sample history for HEMP and HECO, newest first, one pillar at a time', () => {
    const hemp = entriesFor(getLog(), 'HEMP')
    expect(hemp.length).toBeGreaterThan(5)
    expect(hemp.every((x) => x.pillar === 'HEMP')).toBe(true)
    expect(hemp.map((x) => x.at)).toEqual([...hemp.map((x) => x.at)].sort().reverse())
    expect(entriesFor(getLog(), 'HECO').length).toBeGreaterThan(0)
  })

  it('records who did what, as it happens', () => {
    logAction({ by: 'Grace Wanjiru', pillar: 'HEMP', action: 'form_closed', session: 'SIE Cohort 4', detail: 'Closed the Application form (SIE4-REG)' })
    const top = entriesFor(getLog(), 'HEMP')[0]
    expect(top).toMatchObject({ by: 'Grace Wanjiru', action: 'form_closed', session: 'SIE Cohort 4' })
    expect(entriesFor(getLog(), 'HECO').some((x) => x.id === top.id)).toBe(false)
  })

  it('never names participants (CHII IDs at most)', () => {
    const text = JSON.stringify(getLog())
    for (const p of participants.slice(0, 40)) expect(text).not.toContain(p.email)
    expect(text).not.toMatch(/Wanjiku Kamau|Aisha Bello|Mariam Said/)
  })
})
