import { beforeEach, describe, expect, it } from 'vitest'
import { getSessions, resetSessions } from './sessionStore'
import { WorksheetError, columnsOf, ensureCohortWorksheets, generateWorksheet, getWorksheets, planImport, resetWorksheets, rowsOf, runImport, saveTemplate, setCell, setSettings, templatesFor } from './worksheets'

beforeEach(() => (resetSessions(), resetWorksheets()))
const sie = () => getSessions().filter((s) => s.intervention === 'SIE')

describe('worksheets for selective interventions', () => {
  it('generates a cohort worksheet from a template, with platform columns filled in', () => {
    const w = generateWorksheet({ intervention: 'SIE', sessionId: 's2', templateId: 'ws-selection', by: 'Yusuf Abdi', cohortName: 'SIE Cohort 4' })
    const rows = rowsOf(w, sie())
    expect(rows.length).toBeGreaterThan(5)
    expect(rows[0].cells.chii_id).toMatch(/^CHII-\d{6}$/)
    expect(rows[0].cells.cohort).toBe('SIE Cohort 4')
    expect(columnsOf(w).map((c) => c.key)).toContain('decision')
  })

  it('“always generate”: every cohort gets a worksheet from the reused template, once', () => {
    setSettings('SIE', { defaultTemplate: 'ws-interview' })
    expect(ensureCohortWorksheets('SIE', sie(), 'Yusuf Abdi')).toBe(sie().length)
    expect(ensureCohortWorksheets('SIE', sie(), 'Yusuf Abdi')).toBe(0)
    expect(getWorksheets().worksheets.every((w) => w.templateId === 'ws-interview' && w.auto)).toBe(true)
    setSettings('SIE', { autoGenerate: false })
    resetWorksheets()
    setSettings('SIE', { autoGenerate: false })
    expect(ensureCohortWorksheets('SIE', sie(), 'x')).toBe(0)
  })

  it('a custom template is saved for one intervention and needs the CHII ID column', () => {
    const t = saveTemplate({ name: 'SIE 2026', description: '', intervention: 'SIE', columns: [{ key: 'chii_id', label: 'CHII ID', source: { kind: 'chii_id' } }, { key: 'a_available', label: 'Available', source: { kind: 'answer', question: 'available' } }] })
    expect(templatesFor('SIE').some((x) => x.id === t.id)).toBe(true)
    expect(templatesFor('Internships').some((x) => x.id === t.id)).toBe(false)
    expect(() => saveTemplate({ name: 'No id', description: '', intervention: 'SIE', columns: [] })).toThrow(WorksheetError)
  })

  it('staff values are kept, and an imported sheet fills matching columns and adds new ones', () => {
    const w = generateWorksheet({ intervention: 'SIE', sessionId: 's2', templateId: 'ws-selection', by: 'x' })
    const [first, second] = rowsOf(w, sie())
    setCell(w.id, first.id, 'decision', 'Selected')
    const sheet = [
      ['CHII ID', 'Decision', 'Notes', 'Interview panel'],
      [second.id, 'Waitlisted', 'Strong essay', 'Panel B'],
      ['CHII-999999', 'Selected', '', ''],
    ]
    const plan = planImport(sheet, getWorksheets().worksheets[0], sie())
    expect(plan.matched).toEqual([second.id])
    expect(plan.unmatched).toBe(1)
    expect(plan.newColumns).toEqual(['Interview panel'])
    const after = runImport(w.id, sheet, plan, 'sie-selection.xlsx', 'Yusuf Abdi', sie())
    const rows = rowsOf(after, sie())
    expect(rows.find((r) => r.id === first.id)!.cells.decision).toBe('Selected')
    expect(rows.find((r) => r.id === second.id)!.cells).toMatchObject({ decision: 'Waitlisted', notes: 'Strong essay', x_interview_panel: 'Panel B' })
    expect(() => planImport([['Name', 'Decision']], after, sie())).toThrow(WorksheetError)
  })

  it('the master worksheet covers every cohort of the intervention', () => {
    const w = generateWorksheet({ intervention: 'SIE', sessionId: null, templateId: 'ws-selection', by: 'x' })
    const cohorts = new Set(rowsOf(w, sie()).map((r) => r.cells.cohort))
    expect([...cohorts]).toEqual(sie().map((s) => s.name))
  })
})
