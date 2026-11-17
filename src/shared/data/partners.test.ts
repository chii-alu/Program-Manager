import { beforeEach, describe, expect, it } from 'vitest'
import { PartnerError, addPartner, daysToEnd, getPartners, interventionsOf, partnersFor, removePartner, resetPartners, updatePartner, type PartnerInput } from './partners'

beforeEach(() => resetPartners())

const base: PartnerInput = { name: 'Kigali Health Hub', pillar: 'HEMP', type: 'Health facility', status: 'Active', interventions: ['Career Exposure'], offers: ['Site visits'] }

describe('partnership bank', () => {
  it('each pillar sees only its own partners; MELA sees all', () => {
    for (const pl of ['HENT', 'HEMP', 'HECO'] as const) {
      const mine = partnersFor(getPartners().items, [pl])
      expect(mine.length).toBeGreaterThan(0)
      expect(mine.every((x) => x.pillar === pl)).toBe(true)
    }
    expect(partnersFor(getPartners().items, ['HENT', 'HEMP', 'HECO'])).toHaveLength(getPartners().items.length)
  })

  it('a partner is linked only to its own pillar’s interventions', () => {
    expect(interventionsOf('HEMP')).toEqual(['SIE', 'Career Exposure', 'Internships', 'Career Workshops'])
    expect(() => addPartner({ ...base, interventions: ['Hackathon'] }, 'Grace Wanjiru')).toThrow(PartnerError)
    for (const p of getPartners().items) for (const i of p.interventions) expect(interventionsOf(p.pillar), `${p.name}: ${i}`).toContain(i)
  })

  it('adds, edits and removes, with checks on name, email, website and agreement dates', () => {
    const p = addPartner(base, 'Grace Wanjiru')
    expect(getPartners().items[0]).toMatchObject({ id: p.id, addedBy: 'Grace Wanjiru' })
    expect(() => addPartner({ ...base, name: ' ' }, 'x')).toThrow(PartnerError)
    expect(() => addPartner({ ...base, contactEmail: 'nope' }, 'x')).toThrow(PartnerError)
    expect(() => addPartner({ ...base, url: 'hub.org' }, 'x')).toThrow(PartnerError)
    expect(() => addPartner({ ...base, agreement: { signed: '2025-05-01', ends: '2025-01-01' } }, 'x')).toThrow(PartnerError)
    const e = updatePartner(p.id, { ...base, status: 'Paused' }, 'Yusuf Abdi')
    expect(e).toMatchObject({ status: 'Paused', updatedBy: 'Yusuf Abdi', addedBy: 'Grace Wanjiru' })
    removePartner(p.id)
    expect(getPartners().items.some((x) => x.id === p.id)).toBe(false)
  })

  it('flags agreements ending soon', () => {
    const sfh = getPartners().items.find((x) => x.id === 'p-sfh')!
    expect(daysToEnd(sfh, '2025-11-10')).toBe(65)
    expect(daysToEnd({ ...sfh, agreement: undefined }, '2025-11-10')).toBeNull()
  })
})

describe('partner reference numbers', () => {
  it('are numbered within each pillar, oldest first, and new ones take the next number', async () => {
    const { partnerRef } = await import('./partners')
    const hemp = getPartners().items.filter((x) => x.pillar === 'HEMP').sort((a, b) => a.no! - b.no!)
    expect(hemp.map(partnerRef)).toEqual(['HEMP-P-01', 'HEMP-P-02', 'HEMP-P-03'])
    expect(hemp[0].name).toBe('SFH')
    const p = addPartner(base, 'x')
    expect(partnerRef(p)).toBe('HEMP-P-04')
  })
})
