import { beforeEach, describe, expect, it } from 'vitest'
import { addSampleResponses, createSession, getSessions, lifecycleOf, recordAttendance, recordSelected, resetSessions, sessionById, setFormStatus } from './sessionStore'

beforeEach(() => resetSessions())

describe('creating a session and taking it from registration to feedback', () => {
  it('a new session is created with its forms as drafts, and listed with the others', () => {
    const before = getSessions().length
    const s = createSession({ interventionId: 'i8', name: '', dates: ['2025-11-24', '2025-11-26'], venue: 'ALU Kigali campus' })
    expect(getSessions()).toHaveLength(before + 1)
    expect(s).toMatchObject({ intervention: 'Career Workshops', pillar: 'HEMP', kind: 'open', status: 'draft', registered: 0, dates: '24 Nov – 26 Nov' })
    expect(s.name).toMatch(/^Career Workshops · Cohort \d+$/)
    expect(lifecycleOf(s.id).forms).toEqual({ reg: 'draft', att: 'draft', fbk: 'draft' })
  })

  it('walks the whole process: open → responses → close → attendance → feedback → completed', () => {
    const s = createSession({ interventionId: 'i5', name: 'SIE Kenya 2026', dates: ['2026-06-22', '2026-07-20'], venue: 'Nairobi' })
    setFormStatus(s.id, 'reg', 'open')
    expect(sessionById(s.id)!.status).toBe('open')
    addSampleResponses(s.id, 'registered', 24)
    recordSelected(s.id, 18)
    setFormStatus(s.id, 'reg', 'closed')
    setFormStatus(s.id, 'att', 'open')
    recordAttendance(s.id, 18)
    setFormStatus(s.id, 'fbk', 'open')
    addSampleResponses(s.id, 'feedback', 9)
    setFormStatus(s.id, 'fbk', 'closed')
    const done = sessionById(s.id)!
    expect(done).toMatchObject({ status: 'completed', registered: 24, attended: 18, feedback: 9 })
    expect(lifecycleOf(s.id)).toMatchObject({ selected: 18, attendanceDays: 1, forms: { reg: 'closed', att: 'open', fbk: 'closed' } })
  })

  it('sample sessions start where their status says they are', () => {
    expect(lifecycleOf('s2').forms).toEqual({ reg: 'open', att: 'open', fbk: 'draft' }) // SIE Cohort 4, running
    expect(lifecycleOf('s9').forms).toEqual({ reg: 'closed', att: 'closed', fbk: 'open' }) // Career Workshop, completed
    expect(lifecycleOf('s7').forms).toEqual({ reg: 'draft', att: 'draft', fbk: 'draft' }) // draft
  })
})

describe('fixing a session created under the wrong intervention', () => {
  it('moves it to the right intervention, and its forms follow', async () => {
    const { updateSession } = await import('./sessionStore')
    const { templateFor } = await import('../forms/templates')
    const s = createSession({ interventionId: 'i5', name: 'Career Workshop · Networking', dates: ['2025-12-01'], venue: 'Kigali' })
    expect(s.intervention).toBe('SIE')
    const moved = updateSession(s.id, { interventionId: 'i8' })
    expect(moved).toMatchObject({ intervention: 'Career Workshops', kind: 'open', pillar: 'HEMP' })
    expect(templateFor(moved.intervention, 'registration', moved.name)?.id).toBe('career-workshop-registration')
    expect(sessionById(s.id)!.intervention).toBe('Career Workshops')
  })

  it('deletes created sessions; unknown ones are refused', async () => {
    const { deleteSession } = await import('./sessionStore')
    const s = createSession({ interventionId: 'i8', name: 'Oops', dates: ['2025-12-01'], venue: '' })
    deleteSession(s.id)
    expect(sessionById(s.id)).toBeUndefined()
    expect(() => deleteSession('nope')).toThrow()
  })
})

describe('deleting any session', () => {
  it('sample sessions can be deleted (and restored in the prototype); created ones are removed', async () => {
    const { deleteSession, restoreSampleSessions, deletedSampleCount } = await import('./sessionStore')
    deleteSession('s9')
    expect(sessionById('s9')).toBeUndefined()
    expect(deletedSampleCount()).toBe(1)
    restoreSampleSessions()
    expect(sessionById('s9')).toBeDefined()
    const s = createSession({ interventionId: 'i8', name: 'Temp', dates: ['2025-12-01'], venue: '' })
    deleteSession(s.id)
    expect(sessionById(s.id)).toBeUndefined()
    expect(deletedSampleCount()).toBe(0)
  })
})
