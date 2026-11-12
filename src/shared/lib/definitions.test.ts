import { describe, expect, it } from 'vitest'
import { platformDefinitions } from './definitions'

describe('Platform Analytics definitions', () => {
  it('every item has a definition, and the page items come first', () => {
    const d = platformDefinitions({ ventures: false })
    for (const i of d) expect(i.definition.trim().length, i.name).toBeGreaterThan(10)
    expect(d[0].group).toBe('On this page')
    expect(d.some((i) => i.code === 'feedback.nps')).toBe(true)
  })
  it('venture metrics are listed only where the Venture Registry is used', () => {
    expect(platformDefinitions({ ventures: false }).some((i) => i.code?.startsWith('venture.'))).toBe(false)
    expect(platformDefinitions({ ventures: true }).filter((i) => i.group === 'Ventures (HENT)').length).toBeGreaterThan(20)
  })
})
