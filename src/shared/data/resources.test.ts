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
  it('each pillar sees only its own SOPs; MELA sees every pillar’s and its own', () => {
    for (const pl of ['HENT', 'HEMP', 'HECO'] as const) {
      const mine = sopsFor(getSops(), [pl])
      expect(mine.length).toBeGreaterThan(0)
      expect(mine.every((x) => x.pillar === pl)).toBe(true)
    }
    expect(sopsFor(getSops(), ['HENT', 'HEMP', 'HECO'], true)).toHaveLength(getSops().length)
    expect(sopsFor(getSops(), ['HENT', 'HEMP', 'HECO']).some((x) => x.pillar === 'MELA')).toBe(false)
  })
  it('no pillar SOP points to another pillar’s or MELA’s SOP', () => {
    for (const x of getSops().filter((s) => s.pillar !== 'MELA')) expect(JSON.stringify(x.steps)).not.toMatch(/ SOP\b/)
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

describe('uploading and editing SOPs', () => {
  it('an uploaded document becomes a draft SOP for the pillar, with no steps needed', async () => {
    const { createSop, SopError } = await import('./sops')
    const s = createSop({ title: 'Intern placement SOP', pillar: 'HEMP', owner: '', purpose: '', appliesTo: [], steps: [], document: { name: 'placement.pdf', size: 2000, type: 'application/pdf' } }, 'Grace Wanjiru')
    expect(s).toMatchObject({ status: 'Draft', version: 1, pillar: 'HEMP', createdBy: 'Grace Wanjiru', owner: 'Not set' })
    expect(() => createSop({ title: 'Empty', pillar: 'HEMP', owner: '', purpose: '', appliesTo: [], steps: [] }, 'x')).toThrow(SopError)
    expect(() => createSop({ title: ' ', pillar: 'HEMP', owner: '', purpose: '', appliesTo: [], steps: [{ title: 'a', detail: '' }] }, 'x')).toThrow(SopError)
  })

  it('editing an approved SOP makes its next version a draft; blank steps are dropped and links labelled', async () => {
    const { updateSop } = await import('./sops')
    approveSop('sop-hemp-workshops', 'Yusuf Abdi')
    const cur = getSops().find((x) => x.id === 'sop-hemp-workshops')!
    const next = updateSop(cur.id, { ...cur, steps: [...cur.steps, { title: ' ', detail: '' }, { title: 'Send the room booking', detail: '', to: 'interventions' }] }, 'Grace Wanjiru')
    expect(next).toMatchObject({ status: 'Draft', version: cur.version + 1, updatedBy: 'Grace Wanjiru' })
    expect(next.steps).toHaveLength(cur.steps.length + 1)
    expect(next.steps.slice(-1)[0].toLabel).toBe('Interventions')
  })

  it('deletes an SOP', async () => {
    const { deleteSop } = await import('./sops')
    deleteSop('sop-hent-hackathon')
    expect(getSops().some((x) => x.id === 'sop-hent-hackathon')).toBe(false)
  })
})
