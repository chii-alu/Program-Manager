/**
 * Form templates. A template is the list of questions a form asks, in order, with the rules
 * each answer must meet. The public form renders it, the session's Forms tab counts it, and the
 * Applications page shows reviewers the answers that aren't identity data.
 *
 * SIE (HEMP) application: the questions HEMP uses for the Health Skills Immersive Experience,
 * Kenya 2026. The timestamp is recorded automatically, so it isn't a question.
 */

export type QuestionType = 'email' | 'text' | 'year' | 'select' | 'radio' | 'checkboxes' | 'country' | 'textarea' | 'file'

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
  showIf?: { id: string; equals: string }
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
}

export type FormTemplate = {
  id: string
  pillar: 'HENT' | 'HEMP' | 'HECO'
  intervention: string
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

function intakes() {
  const out: string[] = []
  for (let y = YEAR_NOW; y >= YEAR_NOW - 5; y--) for (const t of ['September', 'May', 'January']) out.push(`${t} ${y}`)
  return out
}

export const FORM_TEMPLATES: FormTemplate[] = [SIE_APPLICATION]

/** The application template for an intervention, if it has its own. */
export const applicationTemplateFor = (intervention: string) => FORM_TEMPLATES.find((t) => t.kind === 'application' && t.intervention === intervention) ?? null

/* ---------- Answers ---------- */

export type Answers = Record<string, string | string[] | undefined>

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/** Whether a question is asked, given the answers so far. */
export const isAsked = (q: Question, a: Answers) => !q.showIf || a[q.showIf.id] === q.showIf.equals

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
export const reviewQuestions = (t: FormTemplate) => t.questions.filter((q) => !q.identity && !q.demographic)
