import { describe, expect, it } from 'vitest'
import { applications } from '../data/mela'
import { SIE_APPLICATION, applicationTemplateFor, checkAnswers, isAsked, reviewQuestions, wordCount, type Answers } from './templates'

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')
const good: Answers = {
  email: 'w.kamau@alustudent.com',
  full_name: 'Wanjiku Kamau',
  birth_year: '2003',
  gender: 'Female',
  nationality: 'Kenya',
  residence: 'Rwanda',
  funding: 'Scholar',
  campus: 'ALU Rwanda (Kigali)',
  degree: 'BSc (Hons) Global Challenges',
  intake: 'September 2023',
  has_mission: 'No',
  why_sie: words(170),
  interests: ['Health workforce', 'Health financing and insurance'],
  available: 'Yes, I’m available for the full programme',
  credit: 'No, not for credit',
}
const cv = { cv: { name: 'cv.pdf', size: 200_000 } }

describe('SIE application template (HEMP)', () => {
  it('asks HEMP’s questions in order', () => {
    expect(applicationTemplateFor('SIE')).toBe(SIE_APPLICATION)
    expect(SIE_APPLICATION.questions.map((q) => q.id)).toEqual([
      'email', 'full_name', 'birth_year', 'gender', 'nationality', 'residence', 'funding', 'campus', 'degree', 'intake',
      'has_mission', 'mission', 'why_sie', 'interests', 'available', 'credit', 'cv',
    ])
  })

  it('a complete application passes', () => {
    expect(checkAnswers(SIE_APPLICATION, good, cv)).toEqual({})
  })

  it('the health mission is asked only when the applicant has one', () => {
    const mission = SIE_APPLICATION.questions.find((q) => q.id === 'mission')!
    expect(isAsked(mission, good)).toBe(false)
    expect(checkAnswers(SIE_APPLICATION, { ...good, has_mission: 'Yes' }, cv).mission).toBe('Answer this question.')
  })

  it('checks the 150–200 words, at least 2 interests, the year and the CV', () => {
    const e = checkAnswers(SIE_APPLICATION, { ...good, why_sie: words(120), interests: ['Health workforce'], birth_year: '1950' }, { cv: { name: 'cv.png', size: 10 } })
    expect(e.why_sie).toBe('Write 150–200 words (you have 120).')
    expect(e.interests).toBe('Select at least 2.')
    expect(e.birth_year).toMatch(/Enter a year between/)
    expect(e.cv).toBe('Upload a PDF or DOC or DOCX file.')
    expect(checkAnswers(SIE_APPLICATION, good, { cv: { name: 'cv.pdf', size: 6 * 1024 * 1024 } }).cv).toBe('The file is larger than 5 MB.')
    expect(checkAnswers(SIE_APPLICATION, good, {}).cv).toBe('Attach your CV.')
  })

  it('reviewers never see identity or demographic answers', () => {
    const ids = reviewQuestions(SIE_APPLICATION).map((q) => q.id)
    for (const hidden of ['email', 'full_name', 'birth_year', 'cv', 'gender', 'nationality', 'residence', 'funding', 'campus']) expect(ids).not.toContain(hidden)
    expect(ids).toContain('why_sie')
  })

  it('sample SIE applications meet the template’s rules', () => {
    const sie = applications.filter((a) => a.session === 'SIE Cohort 4')
    expect(sie.every((a) => a.answers)).toBe(true)
    for (const a of sie) {
      const n = wordCount(String(a.answers!.why_sie))
      expect(n, a.id).toBeGreaterThanOrEqual(150)
      expect(n, a.id).toBeLessThanOrEqual(200)
      expect((a.answers!.interests as string[]).length).toBeGreaterThanOrEqual(2)
    }
  })
})
