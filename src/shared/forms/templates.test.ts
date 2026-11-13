import { describe, expect, it } from 'vitest'
import { applications } from '../data/mela'
import { SIE_APPLICATION, SIE_FEEDBACK, templateFor, applicationTemplateFor, checkAnswers, isAsked, reviewQuestions, wordCount, type Answers } from './templates'

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

describe('SIE feedback survey (HEMP)', () => {
  const answers: Answers = {
    participant_code: 'SIE26-AB',
    discipline: 'Health and life sciences',
    origin: 'Kenya',
    valuable_visits: 'Kibera clinic and the county health office.',
    week2_takeaway: 'Community health workers hold the system together.',
    why_resonate: 'They work on last-mile supply, my mission.',
    mission_orgs: 'The county medical stores.',
    clarified_direction: '4',
    deepened_understanding: '5',
    site_diversity: '5',
    confidence: '4',
    connections: '5',
    overall_rating: '5',
    most_impactful: 'The rural site visits.',
    recommendations: 'More time for reflection each evening.',
  }

  it('asks HEMP’s 15 questions in 6 sections, and is the SIE feedback form', () => {
    expect(templateFor('SIE', 'feedback')).toBe(SIE_FEEDBACK)
    expect(SIE_FEEDBACK.questions).toHaveLength(15)
    expect(SIE_FEEDBACK.questions.filter((q) => q.section).length).toBe(6)
    expect(checkAnswers(SIE_FEEDBACK, answers)).toEqual({})
  })

  it('is anonymous: a participant code, never a name or email', () => {
    expect(SIE_FEEDBACK.questions.some((q) => q.type === 'email' || q.identity)).toBe(false)
    expect(checkAnswers(SIE_FEEDBACK, { ...answers, participant_code: 'wanjiku' }).participant_code).toMatch(/SIE26-AA/)
    expect(checkAnswers(SIE_FEEDBACK, { ...answers, participant_code: 'sie26-ab' })).toEqual({})
  })

  it('rating questions take 1–5 only', () => {
    expect(checkAnswers(SIE_FEEDBACK, { ...answers, overall_rating: '7' }).overall_rating).toBe('Choose 1 to 5.')
    expect(checkAnswers(SIE_FEEDBACK, { ...answers, confidence: '' }).confidence).toBe('Answer this question.')
  })
})

describe('SFH internship application (HEMP · Internships)', () => {
  it('every SFH cohort uses it; other internships and SIE keep their own', async () => {
    const { SFH_APPLICATION } = await import('./templates')
    expect(templateFor('Internships', 'application', 'SFH Internship · Cohort 4')).toBe(SFH_APPLICATION)
    expect(templateFor('Internships', 'application', 'SFH Internship · Cohort 7')).toBe(SFH_APPLICATION)
    expect(templateFor('Internships', 'application', 'Hospital Internship · Cohort 1')).toBeNull()
    expect(templateFor('SIE', 'application', 'SIE Cohort 4')).toBe(SIE_APPLICATION)
  })

  it('asks HEMP’s questions once each (one email), with the mission only after “Yes”', async () => {
    const { SFH_APPLICATION } = await import('./templates')
    expect(SFH_APPLICATION.questions.map((q) => q.id)).toEqual(['full_name', 'email', 'degree', 'has_mission', 'mission', 'si_term', 'department', 'cv'])
    const a: Answers = { full_name: 'A B', email: 'a.b@alustudent.com', degree: 'BSc (Hons) Global Challenges', has_mission: 'No', si_term: 'Yes', department: 'Programmes' }
    expect(checkAnswers(SFH_APPLICATION, a, { cv: { name: 'cv.pdf', size: 1000 } })).toEqual({})
    expect(checkAnswers(SFH_APPLICATION, a, { cv: { name: 'cv.docx', size: 1000 } }).cv).toBe('Upload a PDF file.')
  })

  it('sample SFH applications answer every programme question, and reviewers see no identity', async () => {
    const { SFH_APPLICATION } = await import('./templates')
    const sfh = applications.filter((x) => x.session.startsWith('SFH'))
    expect(sfh.length).toBeGreaterThan(0)
    for (const app of sfh) for (const q of reviewQuestions(SFH_APPLICATION).filter((q) => isAsked(q, app.answers!))) expect(app.answers![q.id], `${app.id} ${q.id}`).toBeTruthy()
    expect(reviewQuestions(SFH_APPLICATION).map((q) => q.id)).not.toContain('email')
  })
})

describe('Career Workshop registration (HEMP)', () => {
  it('follows HEMP’s columns, titled Career Workshop (not HealthX)', async () => {
    const { CAREER_WORKSHOP_REGISTRATION: t } = await import('./templates')
    expect(templateFor('Career Workshops', 'registration', 'Career Workshop · CV & interview skills')).toBe(t)
    expect(t.title).toMatch(/^Career Workshop/)
    expect(JSON.stringify(t)).not.toMatch(/healthx/i)
    expect(t.questions.map((q) => q.label)).toEqual([
      'Email', 'Full name', 'Enrollment status', 'Gender identity', 'Year group', 'Primary academic programme', 'Nationality', 'Primary educational institution',
      'Country of residence', 'City of residence', 'Student ID', 'Gender', 'Financial standing', 'Academic standing', 'Disciplinary standing',
      'Country of birth', 'Do you have humanitarian status?', 'Do you have a disability?', 'Period',
    ])
  })

  it('standing comes from student records and Period from the session: neither is asked', async () => {
    const { CAREER_WORKSHOP_REGISTRATION: t, askedOnForm } = await import('./templates')
    const asked = askedOnForm(t).map((q) => q.id)
    for (const id of ['financial_standing', 'academic_standing', 'disciplinary_standing', 'period']) expect(asked).not.toContain(id)
    expect(asked).toHaveLength(15)
    const a: Answers = {
      email: 'a@alustudent.com', full_name: 'A B', enrollment: 'Currently enrolled', gender_identity: 'Woman', year_group: 'Year 2', program: 'Other', nationality: 'Ghana',
      institution: 'ALU Rwanda', residence: 'Rwanda', city: 'Kigali', gender: 'Female', birth_country: 'Ghana', humanitarian: 'No', disability: 'Prefer not to say',
    }
    expect(checkAnswers(t, a)).toEqual({}) // Student ID is optional; record fields aren't checked
  })

  it('disability and humanitarian status are sensitive; standing is restricted', async () => {
    const { CAREER_WORKSHOP_REGISTRATION: t } = await import('./templates')
    const by = (id: string) => t.questions.find((q) => q.id === id)!
    expect(by('disability').sensitive && by('humanitarian').sensitive).toBe(true)
    expect(by('disciplinary_standing').sensitive && by('disciplinary_standing').fromRecords).toBe(true)
  })
})
