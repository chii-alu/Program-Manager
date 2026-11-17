import { describe, expect, it } from 'vitest'
import { askLaura, matchFaqs } from './laura'

const ctx = { page: 'overview', role: 'pillar_staff', portal: 'hemp', user: 'Yusuf Abdi' }

describe('Laura (guide answers until the AI is connected)', () => {
  it('finds the guide answer for a question in plain words', () => {
    expect(matchFaqs('How do I export a sheet?')[0].id).toBe('export')
    expect(matchFaqs('why were my rows rejected for consent')[0].id).toBe('consent')
  })
  it('doesn’t answer from common words alone', () => {
    expect(matchFaqs('how do I plan a budget?')).toHaveLength(0)
  })
  it('says when she doesn’t know, and points to MELA', async () => {
    const r = await askLaura('how do I plan a budget?', [], ctx)
    expect(r.text).toMatch(/not sure about that one/)
    expect(r.text).toMatch(/mela@chii\.alu\.edu/)
  })
})
