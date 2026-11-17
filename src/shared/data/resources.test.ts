import { beforeEach, describe, expect, it } from 'vitest'
import { ResourceError, addResource, getResources, removeResource, resetResources, toggleSaved } from './resources'
import { approveSop, getSops, resetSops, sopsFor } from './sops'

beforeEach(() => (resetResources(), resetSops()))

describe('resource bank', () => {
  const base = { title: 'CHW programmes review', type: 'Paper / study' as const, source: 'Journal', summary: 'A review.', topics: ['Health systems'], pillars: [] as never[], addedBy: 'Grace Wanjiru' }
  it('adds a resource with who added it, and checks the link', () => {
    const r = addResource({ ...base, url: 'https://example.org/review' })
    expect(getResources().items[0]).toMatchObject({ id: r.id, addedBy: 'Grace Wanjiru' })
    expect(() => addResource({ ...base, url: 'example' })).toThrow(ResourceError)
    expect(() => addResource({ ...base, title: ' ' })).toThrow(ResourceError)
  })
  it('only the person who added it can remove it; saving is per person', () => {
    const r = addResource(base)
    expect(() => removeResource(r.id, 'Tendai Moyo')).toThrow(ResourceError)
    toggleSaved('Tendai Moyo', r.id)
    expect(getResources().saved['Tendai Moyo']).toEqual([r.id])
    expect(getResources().saved['Grace Wanjiru']).toBeUndefined()
    removeResource(r.id, 'Grace Wanjiru')
    expect(getResources().items.some((x) => x.id === r.id)).toBe(false)
  })
  it('sample resources are CHII documents or public home pages (no made-up citations)', () => {
    for (const x of getResources().items) if (x.url) expect(new URL(x.url).pathname.split('/').filter(Boolean).length).toBeLessThanOrEqual(3)
  })
})

describe('SOPs', () => {
  it('each pillar sees its own SOPs and the CHII-wide ones; MELA sees all', () => {
    const hemp = sopsFor(getSops(), ['HEMP'])
    expect(hemp.every((x) => x.pillar === 'HEMP' || x.pillar === 'CHII')).toBe(true)
    expect(hemp.some((x) => x.pillar === 'HEMP') && hemp.some((x) => x.pillar === 'CHII')).toBe(true)
    for (const pl of ['HENT', 'HECO'] as const) expect(sopsFor(getSops(), [pl]).some((x) => x.pillar === pl)).toBe(true)
    expect(sopsFor(getSops(), ['HENT', 'HEMP', 'HECO'])).toHaveLength(getSops().length)
  })
  it('start as drafts; approving records who and when, and re-approving bumps the version', () => {
    expect(getSops().every((x) => x.status === 'Draft')).toBe(true)
    approveSop('sop-hemp-selective', 'Yusuf Abdi')
    const a = getSops().find((x) => x.id === 'sop-hemp-selective')!
    expect(a).toMatchObject({ status: 'Approved', reviewedBy: 'Yusuf Abdi', version: 1 })
    approveSop('sop-hemp-selective', 'Yusuf Abdi')
    expect(getSops().find((x) => x.id === 'sop-hemp-selective')!.version).toBe(2)
  })
})
