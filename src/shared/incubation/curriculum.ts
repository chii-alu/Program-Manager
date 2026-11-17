/**
 * The Expose curriculum template (version 2026-11): 4 modules (I1–I4) × 10 sessions, with
 * 3 assignments and 1 final brief per module, a skills quiz (intake, end of I1, end of I4), a
 * confidence survey (intake, end of I4) and the gate portfolio.
 *
 * Only the titles the build addendum quotes are filled in. Everything else is left blank so the
 * app never shows made-up curriculum content: staff paste the compendium's titles, key ideas,
 * takeaways and rubric criteria in on the Curriculum page. Blanks show as "to add".
 * Build and Scale have no curriculum yet; they're added the same way later.
 */
import type { Assessment, Curriculum, CurriculumModule, CurriculumSession } from './types'

export const EXPOSE_MODULES = ['I1', 'I2', 'I3', 'I4'] as const
export const SESSIONS_PER_MODULE = 10
/** Assignments are due after these sessions of their module; the final brief after the last. */
export const DUE_AFTER = { A1: 2, A2: 5, A3: 8, FINAL: 10 } as const

/** Rubric criteria per module ("How work is reviewed"): I1 5 (p.5), I2 5 (p.10), I3 7 (p.15), I4 6 (p.19). */
const CRITERIA_COUNT: Record<string, number> = { I1: 5, I2: 5, I3: 7, I4: 6 }

export function defaultCurriculum(): Curriculum {
  const modules: CurriculumModule[] = [
    { code: 'I1', stage: 'expose', title: 'Health Problem Identification and Evidence-Based Innovation', position: 1, pages: 'pp.2–5' },
    { code: 'I2', stage: 'expose', title: '', position: 2, pages: 'pp.6–10' },
    { code: 'I3', stage: 'expose', title: '', position: 3, pages: 'pp.11–15' },
    { code: 'I4', stage: 'expose', title: '', position: 4, pages: 'pp.16–19' },
  ]
  const sessions: CurriculumSession[] = modules.flatMap((m) =>
    Array.from({ length: SESSIONS_PER_MODULE }, (_, i) => ({ moduleCode: m.code, no: i + 1, title: m.code === 'I1' && i === 0 ? 'From a health idea to a real health problem' : '' })),
  )
  const assessments: Assessment[] = [
    ...modules.flatMap((m): Assessment[] => [
      { code: `${m.code}-A1`, kind: 'assignment', title: m.code === 'I1' ? 'Priority Health Problem Statement' : '', moduleCode: m.code, dueAfter: DUE_AFTER.A1 },
      { code: `${m.code}-A2`, kind: 'assignment', title: '', moduleCode: m.code, dueAfter: DUE_AFTER.A2 },
      { code: `${m.code}-A3`, kind: 'assignment', title: '', moduleCode: m.code, dueAfter: DUE_AFTER.A3 },
      { code: `${m.code}-FINAL`, kind: 'final_brief', title: '', moduleCode: m.code, dueAfter: DUE_AFTER.FINAL },
    ]),
    { code: 'QUIZ-intake', kind: 'skills_quiz', title: 'Skills quiz', timepoint: 'intake', maxScore: 20 },
    { code: 'QUIZ-end_i1', kind: 'skills_quiz', title: 'Skills quiz', timepoint: 'end_i1', maxScore: 20 },
    { code: 'QUIZ-end_i4', kind: 'skills_quiz', title: 'Skills quiz', timepoint: 'end_i4', maxScore: 20 },
    { code: 'CONF-intake', kind: 'confidence_survey', title: 'Confidence survey', timepoint: 'intake', maxScore: 5 },
    { code: 'CONF-end_i4', kind: 'confidence_survey', title: 'Confidence survey', timepoint: 'end_i4', maxScore: 5 },
    { code: 'GATE', kind: 'gate_portfolio', title: 'Gate portfolio', timepoint: 'gate' },
  ]
  const criteria = Object.fromEntries(modules.map((m) => [m.code, Array.from({ length: CRITERIA_COUNT[m.code] }, (_, i) => (m.code === 'I1' && i === 0 ? 'Specificity of the health problem' : ''))]))
  return { version: '2026-11', modules, sessions, assessments, criteria, scaleMax: 4 }
}

/* ---------- Display helpers: blanks show as "to add" ---------- */

export const moduleTitle = (c: Curriculum, code: string) => c.modules.find((m) => m.code === code)?.title || ''
export const moduleLabel = (c: Curriculum, code: string) => {
  const t = moduleTitle(c, code)
  return t ? `${code} · ${t}` : code
}
export const sessionTitle = (c: Curriculum, code: string, no: number) => c.sessions.find((s) => s.moduleCode === code && s.no === no)?.title || ''
export const sessionCode = (code: string, no: number) => `${code} S${String(no).padStart(2, '0')}`

const SHORT: Record<string, string> = { A1: 'Assignment 1', A2: 'Assignment 2', A3: 'Assignment 3', FINAL: 'Final brief' }
/** "Assignment 2" when the compendium title hasn't been added. */
export function assessmentName(c: Curriculum, code: string) {
  const a = c.assessments.find((x) => x.code === code)
  if (!a) return code
  if (a.title && a.kind !== 'skills_quiz' && a.kind !== 'confidence_survey') return a.title
  if (a.moduleCode) return SHORT[code.split('-')[1]] ?? code
  return a.title || code
}
/** Short column label for the gradebook: A1, A2, A3, Final. */
export const assessmentShort = (code: string) => {
  const part = code.split('-')[1]
  return part === 'FINAL' ? 'Final' : part ?? code
}

/** The 16 assessed pieces of work (assignments and final briefs), in module order. */
export const moduleWork = (c: Curriculum, moduleCode?: string) => c.assessments.filter((a) => (a.kind === 'assignment' || a.kind === 'final_brief') && (!moduleCode || a.moduleCode === moduleCode))
export const criteriaFor = (c: Curriculum, code: string) => {
  const a = c.assessments.find((x) => x.code === code)
  return a?.moduleCode ? c.criteria[a.moduleCode] ?? [] : []
}
export const criterionLabel = (name: string, i: number) => name || `Criterion ${i + 1}`

/** How much of the template still needs the compendium's text. */
export function missingText(c: Curriculum) {
  return {
    modules: c.modules.filter((m) => !m.title).length,
    sessions: c.sessions.filter((s) => !s.title).length,
    assessments: moduleWork(c).filter((a) => !a.title).length,
    criteria: Object.values(c.criteria).flat().filter((x) => !x).length,
  }
}
