/**
 * Sample answers drawn from a template, for the prototype's sample cohorts. Deterministic (the
 * same key always gives the same answers), skewed the way real responses usually are (ratings
 * lean positive, most applicants are available). Never contains names or emails: identity
 * questions are left empty.
 */
import type { Answers, FormTemplate, Question } from './templates'

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  // Final mix, so keys that differ only at the end (e.g. response 1, 2, 3) still spread out.
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Short written answers, by question id; anything else gets a general line. */
const TEXT: Record<string, string[]> = {
  valuable_visits: ['The Kibera community clinic and the county health office.', 'The rural dispensary visit in Machakos.', 'The session with the national supply agency.', 'The informal settlement health walk and the hospital tour.'],
  week2_takeaway: [
    'Community health workers hold the system together, often without enough support.',
    'Data only helps when the people collecting it see it used.',
    'Stock-outs are usually an ordering and transport problem, not a supply problem.',
    'Patients navigate several systems at once; services rarely talk to each other.',
  ],
  why_resonate: ['They work on last-mile access, which is exactly my mission.', 'Their focus on maternal health matches what I want to do.', 'They combine technology with community work, which I want to learn.'],
  mission_orgs: ['The county medical stores.', 'A digital health startup in Nairobi.', 'The community health unit in Kibera.', 'The national health insurance office.'],
  most_impactful: ['The rural site visits.', 'Talking with community health workers.', 'The reflection sessions with my cohort.', 'Seeing a referral system from start to finish.'],
  recommendations: ['More time for reflection each evening.', 'Shorter travel days between sites.', 'Meet host organisations before the visits.', 'Share reading on the Kenyan health system before arrival.'],
  mission: ['Make essential medicines available in rural clinics.', 'Improve maternal health outcomes in my community.', 'Use data to strengthen primary care.'],
  // Career Workshops feedback
  most_valuable: ['The CV clinic with recruiters.', 'Mock interviews with feedback.', 'Hearing how alumni found their first health jobs.', 'The session on freelancing and self-employment.'],
  orgs_met: ['A hospital HR team and a health startup.', 'Two NGOs and a pharmaceutical distributor.', 'The ministry’s internship office.'],
  orgs_next: ['The health startup I met at the employer fair.', 'An NGO working on maternal health.', 'A digital health company in Kigali.'],
  suggestions: ['Share the list of employers beforehand.', 'More one-to-one time with recruiters.', 'Run it again before the internship season.', 'Record the talks for people who missed them.'],
  why_sie: [
    'I want to understand how health systems work in practice before I build anything. SIE Kenya would let me see county health teams, clinics and suppliers up close, and learn from professionals in the field.',
  ],
}

function pick<T>(xs: T[], r: number) {
  return xs[Math.min(xs.length - 1, Math.floor(r * xs.length))]
}

function answerFor(q: Question, key: string, i: number): string | string[] | undefined {
  if (q.identity || q.fromRecords || q.auto) return undefined
  const r = hash(`${key}|${q.id}|${i}`)
  switch (q.type) {
    case 'radio':
    case 'select': {
      const opts = q.options ?? []
      // Most people answer the first option (Yes / available); a minority the rest.
      if (q.warnIf || opts[0]?.startsWith('Yes')) return r < 0.85 ? opts[0] : pick(opts.slice(1), (r - 0.85) / 0.15)
      return pick(opts, r)
    }
    case 'checkboxes': {
      const opts = q.options ?? []
      const n = Math.max(q.minSelect ?? 1, 2 + Math.floor(r * 2))
      const start = Math.floor(hash(`${key}|${q.id}|s|${i}`) * opts.length)
      return Array.from({ length: Math.min(n, opts.length) }, (_, k) => opts[(start + k * 2) % opts.length]).filter((x, k, a) => a.indexOf(x) === k)
    }
    case 'scale': {
      const sc = q.scale!
      // Leans positive: about 70% in the top two points.
      const v = r < 0.05 ? sc.min + 1 : r < 0.3 ? sc.max - 2 : r < 0.62 ? sc.max - 1 : sc.max
      return String(Math.max(sc.min, Math.min(sc.max, v)))
    }
    case 'textarea':
      return pick(TEXT[q.id] ?? ['It was useful, thank you.'], r)
    case 'text':
      return q.pattern?.startsWith('^SIE26') ? `SIE26-${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i * 7) % 26))}` : undefined
    case 'country':
      return pick(['Kenya', 'Rwanda', 'Nigeria', 'Ghana', 'Uganda', 'Tanzania', 'Ethiopia', 'South Africa'], r)
    default:
      return undefined
  }
}

export function sampleAnswers(t: FormTemplate, key: string, i = 0): Answers {
  const a: Answers = {}
  for (const q of t.questions) {
    if (q.showIf) continue
    a[q.id] = answerFor(q, key, i)
  }
  // Conditional questions, once the answers they depend on are known.
  for (const q of t.questions.filter((x) => x.showIf)) {
    const v = a[q.showIf!.id]
    const asked = 'oneOf' in q.showIf! ? typeof v === 'string' && q.showIf!.oneOf.includes(v) : v === q.showIf!.equals
    if (asked) a[q.id] = answerFor(q, key, i)
  }
  return a
}

/** `n` sample responses to a form, e.g. a cohort's feedback survey. */
export const sampleResponses = (t: FormTemplate, n: number, key: string) => Array.from({ length: n }, (_, i) => sampleAnswers(t, key, i))
