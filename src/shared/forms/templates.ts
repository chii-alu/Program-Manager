/**
 * Form templates. A template is the list of questions a form asks, in order, with the rules
 * each answer must meet. The public form renders it, the session's Forms tab counts it, and the
 * Applications page shows reviewers the answers that aren't identity data.
 *
 * SIE (HEMP) application: the questions HEMP uses for the Health Skills Immersive Experience,
 * Kenya 2026. The timestamp is recorded automatically, so it isn't a question.
 *
 * SIE (HEMP) feedback: HEMP's end-of-programme survey for the Kenya immersion. It's anonymous:
 * people give the participant code they were assigned, never their name or email.
 */

export type QuestionType = 'email' | 'text' | 'year' | 'select' | 'radio' | 'checkboxes' | 'country' | 'textarea' | 'file' | 'scale'

export type Question = {
  id: string
  label: string
  type: QuestionType
  required?: boolean
  help?: string
  options?: string[]
  /** Checkboxes: the fewest options to tick. */
  minSelect?: number
  /** Long answers: the word range asked for. */
  words?: [number, number]
  /** Year questions: the allowed range. */
  range?: [number, number]
  /** Files: accepted types and the size limit. */
  accept?: string
  maxMb?: number
  /** Only asked when another answer has this value. */
  showIf?: { id: string; equals: string } | { id: string; oneOf: string[] }
  /** Shown under the answer when it has this value (e.g. "only fully available students are selected"). */
  warnIf?: { equals: string; message: string }
  /**
   * Identity or contact data. Kept in the restricted tables, hidden from reviewers (who score
   * blind) and left out of de-identified exports.
   */
  identity?: boolean
  /** About who the applicant is (gender, nationality, funding…): kept for reporting, not shown to reviewers. */
  demographic?: boolean
  /** Options not given by HEMP yet: provisional until confirmed. */
  provisional?: boolean
  /** Starts a new section of the form, with this heading. */
  section?: string
  /** Rating scales: the points and what the two ends mean. */
  scale?: { min: number; max: number; minLabel: string; maxLabel: string; /** A label for every point, e.g. 1 – Poor … 5 – Excellent. */ labels?: string[] }
  /** Text answers that must follow a format, e.g. a participant code. */
  pattern?: string
  patternMessage?: string
  /** Long answers: how many lines the box shows. */
  rows?: number
  /** Sensitive personal data (disability, humanitarian status…): restricted, and hidden in Public reports. */
  sensitive?: boolean
  /**
   * Not asked on the form: filled from ALU's student records, matched on Student ID
   * (e.g. financial, academic and disciplinary standing). Restricted.
   */
  fromRecords?: boolean
  /** Not asked on the form: filled in automatically, e.g. the session's period. */
  auto?: 'period'
}

export type FormTemplate = {
  id: string
  pillar: 'HENT' | 'HEMP' | 'HECO'
  intervention: string
  /**
   * A named programme inside the intervention whose cohorts all share this form (e.g. the SFH
   * internship under Internships). Matched against the cohort's name; without it the template
   * covers every cohort of the intervention.
   */
  programme?: string
  kind: 'application' | 'registration' | 'feedback' | 'attendance'
  title: string
  intro: string
  version: number
  questions: Question[]
}

const YEAR_NOW = 2026

export const SIE_APPLICATION: FormTemplate = {
  id: 'sie-application',
  pillar: 'HEMP',
  intervention: 'SIE',
  kind: 'application',
  title: 'Health Skills Immersive Experience (SIE) · Kenya 2026',
  intro: 'Apply for SIE Kenya 2026: a virtual phase from 22 June to 4 July 2026, then a two-week immersion in Kenya from 6 to 20 July 2026.',
  version: 1,
  questions: [
    { id: 'email', label: 'Email address', type: 'email', required: true, identity: true, help: 'Your ALU email. We use it to match you to your CHII ID.' },
    { id: 'full_name', label: 'Full name', type: 'text', required: true, identity: true },
    { id: 'birth_year', label: 'Year of birth', type: 'year', required: true, identity: true, range: [YEAR_NOW - 45, YEAR_NOW - 15] },
    { id: 'gender', demographic: true, label: 'Gender', type: 'radio', required: true, options: ['Female', 'Male', 'Prefer not to say'] },
    { id: 'nationality', demographic: true, label: 'Nationality', type: 'country', required: true },
    { id: 'residence', demographic: true, label: 'Current country of residence', type: 'country', required: true },
    { id: 'funding', demographic: true, label: 'Scholar or fee paying', type: 'radio', required: true, options: ['Scholar', 'Fee paying'] },
    { id: 'campus', demographic: true, label: 'Campus', type: 'radio', required: true, options: ['ALU Rwanda (Kigali)', 'ALU Mauritius'], provisional: true },
    {
      id: 'degree',
      label: 'Degree programme',
      type: 'select',
      required: true,
      provisional: true,
      options: ['BSc (Hons) Software Engineering', 'BSc (Hons) Entrepreneurial Leadership', 'BSc (Hons) Global Challenges', 'BA (Hons) International Business & Trade', 'Other'],
    },
    { id: 'intake', label: 'Intake', type: 'select', required: true, help: 'The term and year you started, e.g. September 2025.', options: intakes() },
    { id: 'has_mission', label: 'Do you have a declared Health Mission?', type: 'radio', required: true, options: ['Yes', 'No'] },
    { id: 'mission', label: 'State your health mission', type: 'textarea', required: true, showIf: { id: 'has_mission', equals: 'Yes' } },
    {
      id: 'why_sie',
      label: 'Why are you interested in participating in the Health Skills Immersive Experience (SIE) · Kenya 2026?',
      type: 'textarea',
      required: true,
      words: [150, 200],
      help: '150–200 words.',
    },
    {
      id: 'interests',
      label: 'What specific aspect of health systems interests you the most?',
      type: 'checkboxes',
      required: true,
      minSelect: 2,
      help: 'Select at least 2.',
      provisional: true,
      options: [
        'Health service delivery',
        'Health workforce',
        'Health financing and insurance',
        'Medicines, supply chains and logistics',
        'Health information systems and digital health',
        'Leadership, governance and policy',
        'Community and public health',
      ],
    },
    {
      id: 'available',
      label: 'Are you available for the full duration of the programme?',
      type: 'radio',
      required: true,
      help: 'Virtual phase: 22 June – 4 July 2026. Kenya immersion: 6 – 20 July 2026. Only enrolled students who are available for the whole programme will be selected.',
      options: ['Yes, I’m available for the full programme', 'No'],
      warnIf: { equals: 'No', message: 'Only students available for the whole programme can be selected. You can still apply, but your application is unlikely to go ahead.' },
    },
    {
      id: 'credit',
      label: 'Skills Immersion credit',
      type: 'radio',
      required: true,
      help: 'Are you signing up for this Signature Immersive Experience to serve as your chosen option to fulfil Skills Immersion 1 or Skills Immersion 2 credits for the January 2026 trimester?',
      options: ['Yes, for Skills Immersion 1', 'Yes, for Skills Immersion 2', 'No, not for credit'],
    },
    { id: 'cv', label: 'Upload CV / résumé', type: 'file', required: true, identity: true, accept: '.pdf,.doc,.docx', maxMb: 5, help: 'PDF or Word, up to 5 MB.' },
  ],
}

/**
 * SFH internship (HEMP · Internships): one application form shared by every SFH cohort.
 * "Score" in HEMP's sheet is the reviewers' score, set on the Applications page, not a question;
 * the second email column was Google Forms' collected address, so email is asked once.
 */
export const SFH_APPLICATION: FormTemplate = {
  id: 'sfh-internship-application',
  pillar: 'HEMP',
  intervention: 'Internships',
  programme: 'SFH',
  kind: 'application',
  title: 'SFH Internship · Application',
  intro: 'Apply for an internship with SFH. One application per cohort; the HEMP team will be in touch after the selection.',
  version: 1,
  questions: [
    { id: 'full_name', label: 'Full name', type: 'text', required: true, identity: true },
    { id: 'email', label: 'Email', type: 'email', required: true, identity: true, help: 'Your ALU email. We use it to match you to your CHII ID.' },
    {
      id: 'degree',
      label: 'Programme',
      type: 'select',
      required: true,
      provisional: true,
      help: 'Your degree programme.',
      options: ['BSc (Hons) Software Engineering', 'BSc (Hons) Entrepreneurial Leadership', 'BSc (Hons) Global Challenges', 'BA (Hons) International Business & Trade', 'Other'],
    },
    { id: 'has_mission', label: 'Do you have a mission in healthcare?', type: 'radio', required: true, options: ['Yes', 'No'] },
    { id: 'mission', label: 'Kindly state your mission', type: 'textarea', required: true, showIf: { id: 'has_mission', equals: 'Yes' } },
    { id: 'si_term', label: 'Are you in the Skills Immersion Internship term?', type: 'radio', required: true, options: ['Yes', 'No'] },
    {
      id: 'department',
      label: 'Which SFH department are you interested in?',
      type: 'select',
      required: true,
      provisional: true,
      options: ['Programmes', 'Monitoring, evaluation and research', 'Finance and grants', 'Supply chain and logistics', 'Communications and marketing', 'Human resources and administration'],
    },
    { id: 'cv', label: 'Kindly upload your CV in PDF format', type: 'file', required: true, identity: true, accept: '.pdf', maxMb: 5, help: 'PDF only, up to 5 MB.' },
  ],
}

/**
 * Career Workshops (HEMP) registration. Open: anyone with the link can register for a workshop.
 * Columns follow HEMP's registration sheet (it was titled HealthX). Standing fields come from
 * student records and Period from the session, so neither is asked.
 */
export const CAREER_WORKSHOP_REGISTRATION: FormTemplate = {
  id: 'career-workshop-registration',
  pillar: 'HEMP',
  intervention: 'Career Workshops',
  kind: 'registration',
  title: 'Career Workshop · Registration',
  intro: 'Register for this Career Workshop. It takes about 3 minutes; answers marked optional can be skipped.',
  version: 1,
  questions: [
    { id: 'email', label: 'Email', type: 'email', required: true, identity: true, help: 'We use it to match you to your CHII ID and send you the joining details.' },
    { id: 'full_name', label: 'Full name', type: 'text', required: true, identity: true },
    { id: 'enrollment', label: 'Enrollment status', type: 'radio', required: true, demographic: true, provisional: true, options: ['Currently enrolled', 'On leave', 'Alumni', 'Not an ALU student'] },
    { id: 'gender_identity', label: 'Gender identity', type: 'radio', required: true, demographic: true, options: ['Woman', 'Man', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say'] },
    { id: 'year_group', label: 'Year group', type: 'select', required: true, demographic: true, provisional: true, options: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Graduate'] },
    {
      id: 'program',
      label: 'Primary academic programme',
      type: 'select',
      required: true,
      provisional: true,
      options: ['BSc (Hons) Software Engineering', 'BSc (Hons) Entrepreneurial Leadership', 'BSc (Hons) Global Challenges', 'BA (Hons) International Business & Trade', 'Other'],
    },
    { id: 'nationality', label: 'Nationality', type: 'country', required: true, demographic: true },
    { id: 'institution', label: 'Primary educational institution', type: 'select', required: true, provisional: true, options: ['ALU Rwanda', 'ALU Mauritius', 'ALX', 'Other'] },
    { id: 'residence', label: 'Country of residence', type: 'country', required: true, demographic: true },
    { id: 'city', label: 'City of residence', type: 'text', required: true, demographic: true },
    { id: 'student_id', label: 'Student ID', type: 'text', identity: true, help: 'If you’re an ALU student. Optional.' },
    { id: 'gender', label: 'Gender', type: 'radio', required: true, demographic: true, options: ['Female', 'Male', 'Prefer not to say'] },
    { id: 'financial_standing', label: 'Financial standing', type: 'text', fromRecords: true, sensitive: true },
    { id: 'academic_standing', label: 'Academic standing', type: 'text', fromRecords: true, sensitive: true },
    { id: 'disciplinary_standing', label: 'Disciplinary standing', type: 'text', fromRecords: true, sensitive: true },
    { id: 'birth_country', label: 'Country of birth', type: 'country', required: true, demographic: true },
    {
      id: 'humanitarian',
      label: 'Do you have humanitarian status?',
      type: 'radio',
      required: true,
      sensitive: true,
      help: 'For example refugee, asylum seeker or internally displaced. This helps CHII report on inclusion; it is kept confidential.',
      options: ['Yes', 'No', 'Prefer not to say'],
    },
    { id: 'disability', label: 'Do you have a disability?', type: 'radio', required: true, sensitive: true, help: 'This helps CHII make sessions accessible and report on inclusion; it is kept confidential.', options: ['Yes', 'No', 'Prefer not to say'] },
    { id: 'period', label: 'Period', type: 'text', auto: 'period' },
  ],
}

/**
 * Career Workshops (HEMP) feedback. HEMP's sheet (titled HealthX 2026) branches on the session:
 * each session repeats the same questions, and the later sessions add two questions about the
 * organisations met. Here they're asked once, with the organisation questions shown only for
 * those sessions, so answers from every session land in the same columns.
 */
const CW_SESSIONS = ['Session 1', 'Session 2', 'Session 3']
const CW_ORG_SESSIONS = ['Session 2', 'Session 3']

export const CAREER_WORKSHOP_FEEDBACK: FormTemplate = {
  id: 'career-workshop-feedback',
  pillar: 'HEMP',
  intervention: 'Career Workshops',
  kind: 'feedback',
  title: 'Career Workshop · Feedback',
  intro: 'Tell us how the Career Workshop went for you. It takes about 4 minutes, and your answers shape the next workshops.',
  version: 1,
  questions: [
    { id: 'email', label: 'Email address', type: 'email', required: true, identity: true, help: 'We use it to match you to your CHII ID.' },
    { id: 'session', label: 'Which Career Workshop session are you providing feedback on?', type: 'radio', required: true, provisional: true, options: CW_SESSIONS },
    {
      id: 'overall',
      label: 'Overall, how would you rate your experience at the Career Workshop?',
      type: 'scale',
      required: true,
      scale: { min: 1, max: 5, minLabel: 'Poor', maxLabel: 'Excellent', labels: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] },
    },
    {
      id: 'career_value',
      label: 'How valuable was the Career Workshop session for your career development?',
      type: 'scale',
      required: true,
      scale: { min: 1, max: 5, minLabel: 'Not valuable', maxLabel: 'Extremely valuable', labels: ['Not valuable', 'Slightly valuable', 'Moderately valuable', 'Very valuable', 'Extremely valuable'] },
    },
    {
      id: 'employment_relevance',
      label: 'On a scale of 1 to 5, how relevant and helpful was the Career Workshop session in preparing you to secure either self-employment or wage employment?',
      type: 'scale',
      required: true,
      scale: { min: 1, max: 5, minLabel: 'Not at all relevant', maxLabel: 'Extremely relevant', labels: ['Not at all relevant', 'Slightly relevant', 'Moderately relevant', 'Very relevant', 'Extremely relevant'] },
    },
    { id: 'most_valuable', label: 'What was the most valuable part of the Career Workshop session for you?', type: 'textarea', rows: 3, required: true },
    { id: 'orgs_met', label: 'Which organisations did you interact with during the Career Workshop?', type: 'textarea', rows: 2, required: true, showIf: { id: 'session', oneOf: CW_ORG_SESSIONS } },
    { id: 'orgs_next', label: 'Which organisations would you be interested in engaging with after the Career Workshop?', type: 'textarea', rows: 2, required: true, showIf: { id: 'session', oneOf: CW_ORG_SESSIONS } },
    {
      id: 'opportunity',
      label: 'Which of the following opportunities are you currently most interested in?',
      type: 'radio',
      required: true,
      provisional: true,
      options: ['Internship', 'Full-time job', 'Part-time or freelance work', 'Starting or growing my own venture', 'Fellowship', 'Further study'],
    },
    {
      id: 'skills',
      label: 'Which skills or areas of expertise best describe you?',
      type: 'checkboxes',
      required: true,
      minSelect: 1,
      provisional: true,
      help: 'Select all that apply.',
      options: ['Clinical or health sciences', 'Public health and research', 'Data and analytics', 'Software and technology', 'Business, finance and operations', 'Policy and advocacy', 'Communications and design', 'Entrepreneurship'],
    },
    { id: 'mission', label: 'What health issue or mission are you most passionate about, and why?', type: 'textarea', rows: 3, required: true },
    { id: 'suggestions', label: 'What suggestions do you have to improve future Career Workshop sessions?', type: 'textarea', rows: 3, required: true },
    { id: 'follow_up', label: 'Would you like the Career Workshop team to share relevant follow-up opportunities with you?', type: 'radio', required: true, options: ['Yes', 'No'] },
  ],
}

const AGREE = { min: 1, max: 5, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' }

export const SIE_FEEDBACK: FormTemplate = {
  id: 'sie-feedback',
  pillar: 'HEMP',
  intervention: 'SIE',
  kind: 'feedback',
  title: 'SIE Kenya 2026 · Feedback survey',
  intro: 'Your reflections on the field visits and on the whole 2-week SIE in Kenya. This survey is anonymous: use your participant code, not your name.',
  version: 1,
  questions: [
    {
      id: 'participant_code',
      section: 'Participant code',
      label: 'Enter your assigned participant code',
      type: 'text',
      required: true,
      help: 'For example SIE26-AA. It links your answers across surveys without your name.',
      pattern: '^SIE26-[A-Z]{2}$',
      patternMessage: 'Use the code you were given, in the form SIE26-AA.',
    },
    {
      id: 'discipline',
      section: 'About you (non-identifying)',
      label: 'What is your disciplinary background?',
      type: 'select',
      required: true,
      provisional: true,
      demographic: true,
      options: ['Health and life sciences', 'Software engineering and computing', 'Business and entrepreneurship', 'Global challenges and social sciences', 'Other'],
    },
    { id: 'origin', label: 'What is your country of origin?', type: 'country', required: true, demographic: true },
    {
      id: 'valuable_visits',
      section: 'Field visits this week',
      label: 'Which of last week’s field visits and sessions were most valuable to you?',
      type: 'textarea',
      rows: 3,
      required: true,
      help: 'Name the visits or sessions.',
    },
    { id: 'week2_takeaway', label: 'In one or two sentences, what was your single biggest key takeaway from Week 2’s field visits?', type: 'textarea', rows: 3, required: true },
    {
      id: 'why_resonate',
      section: 'Alignment with your personal and career mission',
      label: 'Why did this particular organisation (or organisations) resonate so strongly with your mission?',
      type: 'textarea',
      rows: 4,
      required: true,
    },
    { id: 'mission_orgs', label: 'Which organisation(s) across the 2-week experience spoke MOST directly to your personal mission or career goals?', type: 'textarea', rows: 2, required: true },
    {
      id: 'clarified_direction',
      label: 'To what extent did the overall 2-week SIE help you clarify your future direction or mission in the health sector?',
      type: 'scale',
      required: true,
      scale: { min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'To a great extent' },
    },
    {
      id: 'deepened_understanding',
      section: 'Overall 2-week experience',
      label: 'Looking back over the full 2 weeks, the SIE has deepened my practical understanding of health systems in Kenya.',
      type: 'scale',
      required: true,
      scale: AGREE,
    },
    { id: 'site_diversity', label: 'The diversity of site visits across urban, rural and informal settlement settings added significant value to my learning.', type: 'scale', required: true, scale: AGREE },
    { id: 'confidence', label: 'I feel more confident in my ability to identify and address healthcare delivery challenges.', type: 'scale', required: true, scale: AGREE },
    { id: 'connections', label: 'The connections built with peers, host organisations and leaders over these 2 weeks will be valuable for my career.', type: 'scale', required: true, scale: AGREE },
    {
      id: 'overall_rating',
      section: 'Final reflections and future improvements',
      label: 'Overall, how would you rate your entire 2-week on-ground SIE experience in Kenya?',
      type: 'scale',
      required: true,
      scale: { min: 1, max: 5, minLabel: 'Poor', maxLabel: 'Excellent' },
    },
    { id: 'most_impactful', label: 'What was the single most impactful part of the entire 2-week programme for you?', type: 'textarea', rows: 3, required: true },
    { id: 'recommendations', label: 'What recommendations do you have for the SIE team to improve future on-ground cohorts?', type: 'textarea', rows: 4, required: true },
  ],
}

function intakes() {
  const out: string[] = []
  for (let y = YEAR_NOW; y >= YEAR_NOW - 5; y--) for (const t of ['September', 'May', 'January']) out.push(`${t} ${y}`)
  return out
}

export const FORM_TEMPLATES: FormTemplate[] = [SIE_APPLICATION, SIE_FEEDBACK, SFH_APPLICATION, CAREER_WORKSHOP_REGISTRATION, CAREER_WORKSHOP_FEEDBACK]

/** The questions people actually answer on the form (not filled from records or automatically). */
export const askedOnForm = (t: FormTemplate) => t.questions.filter((q) => !q.fromRecords && !q.auto)

/**
 * A cohort's own template for a kind of form, if it has one: a programme's template (matched on
 * the cohort's name, e.g. "SFH Internship · Cohort 4") before the intervention's general one.
 */
export function templateFor(intervention: string, kind: FormTemplate['kind'], cohortName = ''): FormTemplate | null {
  const mine = FORM_TEMPLATES.filter((t) => t.kind === kind && t.intervention === intervention)
  return mine.find((t) => t.programme && cohortName.split(/[\s·]+/).includes(t.programme)) ?? mine.find((t) => !t.programme) ?? null
}

/** The application template for a cohort, if it has its own. */
export const applicationTemplateFor = (intervention: string, cohortName = '') => templateFor(intervention, 'application', cohortName)

/* ---------- Answers ---------- */

export type Answers = Record<string, string | string[] | undefined>

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** Whether a question is asked, given the answers so far. Record and automatic fields never are. */
export const isAsked = (q: Question, a: Answers) => {
  if (q.fromRecords || q.auto) return false
  if (!q.showIf) return true
  const v = a[q.showIf.id]
  return 'oneOf' in q.showIf ? typeof v === 'string' && q.showIf.oneOf.includes(v) : v === q.showIf.equals
}

/** Problems with a set of answers, keyed by question id. Empty when the form can be sent. */
export function checkAnswers(t: FormTemplate, a: Answers, files: Record<string, { name: string; size: number } | undefined> = {}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const q of t.questions) {
    if (!isAsked(q, a)) continue
    const v = a[q.id]
    const empty = q.type === 'file' ? !files[q.id] : Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim()
    if (empty) {
      if (q.required) out[q.id] = q.type === 'checkboxes' ? `Select at least ${q.minSelect ?? 1}.` : q.type === 'file' ? 'Attach your CV.' : 'Answer this question.'
      continue
    }
    if (q.pattern && !new RegExp(q.pattern, 'i').test(String(v).trim())) out[q.id] = q.patternMessage ?? 'Check the format of this answer.'
    if (q.type === 'scale' && q.scale) {
      const n = Number(v)
      if (!Number.isInteger(n) || n < q.scale.min || n > q.scale.max) out[q.id] = `Choose ${q.scale.min} to ${q.scale.max}.`
    }
    if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())) out[q.id] = 'Enter a valid email address.'
    if (q.type === 'year' && q.range) {
      const y = Number(v)
      if (!Number.isInteger(y) || y < q.range[0] || y > q.range[1]) out[q.id] = `Enter a year between ${q.range[0]} and ${q.range[1]}.`
    }
    if (q.type === 'checkboxes' && q.minSelect && (v as string[]).length < q.minSelect) out[q.id] = `Select at least ${q.minSelect}.`
    if (q.words) {
      const n = wordCount(String(v))
      if (n < q.words[0] || n > q.words[1]) out[q.id] = `Write ${q.words[0]}–${q.words[1]} words (you have ${n}).`
    }
    if (q.type === 'file') {
      const f = files[q.id]!
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
      if (q.accept && !q.accept.split(',').includes(ext)) out[q.id] = `Upload a ${q.accept.replace(/\./g, '').toUpperCase().split(',').join(' or ')} file.`
      else if (q.maxMb && f.size > q.maxMb * 1024 * 1024) out[q.id] = `The file is larger than ${q.maxMb} MB.`
    }
  }
  return out
}

/** The questions reviewers see: no identity or demographic data, so they score blind. */
export const reviewQuestions = (t: FormTemplate) => t.questions.filter((q) => !q.identity && !q.demographic && !q.sensitive && !q.fromRecords && !q.auto)
