export type Role = 'admin' | 'pillar_lead' | 'pillar_staff' | 'reviewer' | 'none'
export type Portal = 'admin' | 'hent' | 'hemp' | 'heco'
export type Pillar = 'HENT' | 'HEMP' | 'HECO'

export const roleMeta: Record<Role, { label: string; user: string; initials: string; email: string }> = {
  admin: { label: 'MELA admin', user: 'Amara Okafor', initials: 'AO', email: 'amara.okafor@chii.alu.edu' },
  pillar_lead: { label: 'Pillar lead', user: 'Tendai Moyo', initials: 'TM', email: 'tendai.moyo@chii.alu.edu' },
  pillar_staff: { label: 'Pillar staff', user: 'Grace Wanjiru', initials: 'GW', email: 'grace.wanjiru@chii.alu.edu' },
  reviewer: { label: 'Reviewer', user: 'Kofi Mensah', initials: 'KM', email: 'kofi.mensah@chii.alu.edu' },
  none: { label: 'No staff role', user: 'Lina Haddad', initials: 'LH', email: 'lina.haddad@alu.edu' },
}

export const portalMeta: Record<Portal, { label: string; full: string }> = {
  admin: { label: 'MELA', full: 'MELA · All pillars' },
  hent: { label: 'HENT', full: 'Health entrepreneurship' },
  hemp: { label: 'HEMP', full: 'Health employment' },
  heco: { label: 'HECO', full: 'Health economics' },
}

export const canSeeIdentity = (role: Role) => role === 'admin' || role === 'pillar_lead' || role === 'pillar_staff'

export const pillarsFor = (portal: Portal): Pillar[] =>
  portal === 'admin' ? ['HENT', 'HEMP', 'HECO'] : [portal.toUpperCase() as Pillar]

export const pillarStats: Record<Pillar, { sessions: number; people: number; attendances: number; health: 'good' | 'warn' | 'bad'; open: number }> = {
  HENT: { sessions: 18, people: 642, attendances: 1904, health: 'good', open: 3 },
  HEMP: { sessions: 24, people: 1188, attendances: 3120, health: 'warn', open: 5 },
  HECO: { sessions: 9, people: 214, attendances: 486, health: 'bad', open: 1 },
}

export type SessionStatus = 'open' | 'upcoming' | 'completed' | 'draft'
export type Session = {
  id: string
  name: string
  intervention: string
  pillar: Pillar
  kind: 'open' | 'selective'
  dates: string
  status: SessionStatus
  registered: number
  attended: number
  feedback: number
}

export const sessions: Session[] = [
  { id: 's1', name: 'Masterclass · Pitching to investors', intervention: 'Masterclass', pillar: 'HENT', kind: 'open', dates: '12–13 Nov', status: 'open', registered: 148, attended: 0, feedback: 0 },
  { id: 's2', name: 'SIE Cohort 4', intervention: 'SIE', pillar: 'HEMP', kind: 'selective', dates: '3 Nov – 15 Dec', status: 'open', registered: 312, attended: 186, feedback: 41 },
  { id: 's3', name: 'Career Exposure · Kigali', intervention: 'Career Exposure', pillar: 'HEMP', kind: 'open', dates: '28 Oct', status: 'completed', registered: 96, attended: 74, feedback: 19 },
  { id: 's4', name: 'Public Sector Fellowship 2026', intervention: 'Public Sector Fellowship', pillar: 'HECO', kind: 'selective', dates: '20 Nov – 30 Jan', status: 'upcoming', registered: 58, attended: 0, feedback: 0 },
  { id: 's5', name: 'HealthTech Hackathon', intervention: 'Hackathon', pillar: 'HENT', kind: 'open', dates: '18–20 Oct', status: 'completed', registered: 204, attended: 167, feedback: 88 },
  { id: 's6', name: 'Internship Placement · Q4', intervention: 'Internships', pillar: 'HEMP', kind: 'selective', dates: '1 Oct – 20 Dec', status: 'open', registered: 64, attended: 61, feedback: 0 },
  { id: 's7', name: 'Exec Course · Health financing', intervention: 'Executive Courses', pillar: 'HECO', kind: 'open', dates: '2 Dec', status: 'draft', registered: 0, attended: 0, feedback: 0 },
  { id: 's8', name: 'Mentorship Circle · Founders', intervention: 'Mentorship', pillar: 'HENT', kind: 'selective', dates: '6 Nov – 18 Dec', status: 'open', registered: 42, attended: 38, feedback: 12 },
]

export const attention: { id: string; pillar: Pillar; title: string; detail: string; tone: 'warn' | 'bad' }[] = [
  { id: 'a1', pillar: 'HECO', title: 'Feedback form still in draft', detail: 'Public Sector Fellowship 2026 starts in 10 days', tone: 'bad' },
  { id: 'a2', pillar: 'HEMP', title: 'Low feedback rate · 26%', detail: 'Career Exposure · Kigali, 19 of 74 attendees', tone: 'warn' },
  { id: 'a3', pillar: 'HEMP', title: '23 applications unscored', detail: 'SIE Cohort 4 · selection closes Friday', tone: 'warn' },
  { id: 'a4', pillar: 'HENT', title: 'Attendance not taken for day 2', detail: 'HealthTech Hackathon · 20 Oct', tone: 'warn' },
]

export type Participant = {
  id: string
  name: string
  email: string
  gender: 'F' | 'M'
  age: number
  country: string
  pillars: Pillar[]
  interventions: string[]
  sessions: number
  attendance: number
  /** First registration, e.g. "8 Nov 2025". */
  joined: string
  /** Most recent attendance or submission. */
  lastActive: string
  status: 'Active' | 'Alumni' | 'Inactive'
}

type SeedParticipant = Omit<Participant, 'joined' | 'lastActive' | 'status'>

const seedParticipants: SeedParticipant[] = [
  { id: 'CHII-000214', name: 'Aisha Bello', email: 'a.bello@alustudent.com', gender: 'F', age: 23, country: 'Nigeria', pillars: ['HENT', 'HEMP'], interventions: ['Masterclass', 'SIE', 'Hackathon'], sessions: 5, attendance: 92 },
  { id: 'CHII-000215', name: 'Jean-Paul Habimana', email: 'jp.habimana@alustudent.com', gender: 'M', age: 25, country: 'Rwanda', pillars: ['HEMP'], interventions: ['Career Exposure'], sessions: 1, attendance: 100 },
  { id: 'CHII-000231', name: 'Wanjiku Kamau', email: 'w.kamau@alustudent.com', gender: 'F', age: 22, country: 'Kenya', pillars: ['HEMP'], interventions: ['SIE', 'Internships'], sessions: 3, attendance: 78 },
  { id: 'CHII-000248', name: 'Chinedu Eze', email: 'c.eze@gmail.com', gender: 'M', age: 27, country: 'Nigeria', pillars: ['HENT'], interventions: ['Hackathon', 'Mentorship'], sessions: 4, attendance: 88 },
  { id: 'CHII-000263', name: 'Fatou Diallo', email: 'f.diallo@alustudent.com', gender: 'F', age: 24, country: 'Senegal', pillars: ['HECO'], interventions: ['Public Sector Fellowship'], sessions: 1, attendance: 0 },
  { id: 'CHII-000279', name: 'Thabo Nkosi', email: 't.nkosi@outlook.com', gender: 'M', age: 29, country: 'South Africa', pillars: ['HENT', 'HECO'], interventions: ['Masterclass', 'Executive Courses'], sessions: 2, attendance: 50 },
  { id: 'CHII-000284', name: 'Mariam Said', email: 'm.said@alustudent.com', gender: 'F', age: 21, country: 'Tanzania', pillars: ['HEMP'], interventions: ['Career Exposure', 'SIE'], sessions: 2, attendance: 100 },
  { id: 'CHII-000302', name: 'Kwame Asante', email: 'k.asante@alustudent.com', gender: 'M', age: 23, country: 'Ghana', pillars: ['HENT'], interventions: ['Masterclass'], sessions: 1, attendance: 100 },
  { id: 'CHII-000317', name: 'Nadia Uwase', email: 'n.uwase@alustudent.com', gender: 'F', age: 22, country: 'Rwanda', pillars: ['HEMP', 'HECO'], interventions: ['Internships', 'Public Sector Fellowship'], sessions: 3, attendance: 67 },
  { id: 'CHII-000325', name: 'Samuel Okello', email: 's.okello@gmail.com', gender: 'M', age: 26, country: 'Uganda', pillars: ['HENT'], interventions: ['Hackathon'], sessions: 1, attendance: 100 },
  { id: 'CHII-000341', name: 'Lerato Mokoena', email: 'l.mokoena@alustudent.com', gender: 'F', age: 24, country: 'South Africa', pillars: ['HEMP'], interventions: ['SIE'], sessions: 2, attendance: 83 },
]

/* Deterministic generator so filters, charts and time ranges have real volume. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** A date `daysAgo` before 10 Nov 2025, written "8 Nov 2025". */
export function dayString(daysAgo: number) {
  const d = new Date(2025, 10, 10 - daysAgo)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const first = { F: ['Amina', 'Zainab', 'Esther', 'Ngozi', 'Akosua', 'Halima', 'Ruth', 'Imani', 'Chiamaka', 'Thandiwe', 'Awa', 'Yaa', 'Neema', 'Salma', 'Adaeze', 'Furaha'], M: ['Emeka', 'Kwabena', 'Moses', 'Ibrahim', 'Tunde', 'Brian', 'Eric', 'Sipho', 'Ousmane', 'Yaw', 'Patrick', 'Daniel', 'Musa', 'Kelvin', 'Joseph', 'Abdoul'] }
const last = ['Okoro', 'Mensah', 'Uwimana', 'Njoroge', 'Adeyemi', 'Banda', 'Mugisha', 'Ndlovu', 'Sow', 'Kariuki', 'Boateng', 'Nyirenda', 'Abubakar', 'Ochieng', 'Mutesi', 'Diop', 'Iradukunda', 'Owusu']
const countryPool = ['Rwanda', 'Rwanda', 'Rwanda', 'Nigeria', 'Nigeria', 'Kenya', 'Kenya', 'Ghana', 'Uganda', 'Tanzania', 'South Africa', 'Senegal', 'Ethiopia', 'Zimbabwe', 'Cameroon']
const byPillar: Record<Pillar, string[]> = {
  HENT: ['Masterclass', 'Hackathon', 'Mentorship', 'Venture Funding'],
  HEMP: ['SIE', 'Career Exposure', 'Internships', 'Career Workshops'],
  HECO: ['Public Sector Fellowship', 'Health Expert in Residence', 'Executive Courses'],
}

function generatePeople(n: number): Participant[] {
  const r = rng(42)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  return Array.from({ length: n }, (_, i) => {
    const gender = r() < 0.56 ? 'F' : 'M'
    const fn = pick(first[gender])
    const ln = pick(last)
    const roll = r()
    const main: Pillar = roll < 0.32 ? 'HENT' : roll < 0.84 ? 'HEMP' : 'HECO'
    const pillars: Pillar[] = r() < 0.18 ? Array.from(new Set([main, pick(['HENT', 'HEMP', 'HECO'] as Pillar[])])) : [main]
    const ints = Array.from(new Set(pillars.flatMap((p) => [pick(byPillar[p]), ...(r() < 0.35 ? [pick(byPillar[p])] : [])])))
    const joinedAgo = Math.floor(Math.pow(r(), 1.6) * 520)
    const activeAgo = Math.floor(r() * Math.min(joinedAgo + 1, 120))
    const sessionsN = ints.length + Math.floor(r() * 3)
    const attendance = r() < 0.08 ? 0 : Math.round(45 + r() * 55)
    return {
      id: `CHII-${String(400 + i * 7).padStart(6, '0')}`,
      name: `${fn} ${ln}`,
      email: `${fn[0].toLowerCase()}.${ln.toLowerCase()}@${r() < 0.7 ? 'alustudent.com' : 'gmail.com'}`,
      gender,
      age: 19 + Math.floor(r() * 14),
      country: pick(countryPool),
      pillars,
      interventions: ints,
      sessions: sessionsN,
      attendance,
      joined: dayString(joinedAgo),
      lastActive: dayString(activeAgo),
      status: activeAgo < 45 ? 'Active' : attendance >= 70 ? 'Alumni' : 'Inactive',
    }
  })
}

const seedJoin = [5, 330, 120, 95, 18, 210, 40, 4, 160, 25, 70]
export const participants: Participant[] = [
  ...seedParticipants.map((p, i) => ({
    ...p,
    joined: dayString(seedJoin[i] ?? 60),
    lastActive: dayString(Math.min(seedJoin[i] ?? 60, i * 3 + 1)),
    status: (i * 3 + 1 < 45 ? 'Active' : 'Alumni') as Participant['status'],
  })),
  ...generatePeople(168),
]

export type JourneyStep = {
  session: string
  intervention: string
  pillar: Pillar
  dates: string
  status: 'Completed' | 'In progress' | 'Selected' | 'Registered' | 'Not completed'
  attendance: string
  feedback: boolean
}

export const journey: JourneyStep[] = [
  { session: 'SIE Cohort 4', intervention: 'SIE', pillar: 'HEMP', dates: '3 Nov – 15 Dec 2025', status: 'In progress', attendance: '5 of 6 dates', feedback: false },
  { session: 'Masterclass · Pitching to investors', intervention: 'Masterclass', pillar: 'HENT', dates: '12–13 Nov 2025', status: 'Registered', attendance: '—', feedback: false },
  { session: 'HealthTech Hackathon', intervention: 'Hackathon', pillar: 'HENT', dates: '18–20 Oct 2025', status: 'Completed', attendance: '3 of 3 dates', feedback: true },
  { session: 'Masterclass · Market sizing', intervention: 'Masterclass', pillar: 'HENT', dates: '14 Aug 2025', status: 'Completed', attendance: '1 of 1 date', feedback: true },
  { session: 'Career Exposure · Lagos', intervention: 'Career Exposure', pillar: 'HEMP', dates: '2 May 2025', status: 'Not completed', attendance: '0 of 1 date', feedback: false },
]

export const feedbackGiven = [
  { date: '21 Oct 2025', session: 'HealthTech Hackathon', pillar: 'HENT' as Pillar, satisfaction: 5, relevance: 4, nps: 9 },
  { date: '15 Aug 2025', session: 'Masterclass · Market sizing', pillar: 'HENT' as Pillar, satisfaction: 4, relevance: 5, nps: 8 },
]

/* ---------- Interventions ---------- */
export type Intervention = { id: string; name: string; pillar: Pillar; kind: 'open' | 'selective'; sessions: number; people: number; completion: number; last: string }
export const interventions: Intervention[] = [
  { id: 'i1', name: 'Masterclass', pillar: 'HENT', kind: 'open', sessions: 7, people: 412, completion: 81, last: '12 Nov' },
  { id: 'i2', name: 'Hackathon', pillar: 'HENT', kind: 'open', sessions: 2, people: 298, completion: 76, last: '20 Oct' },
  { id: 'i3', name: 'Mentorship', pillar: 'HENT', kind: 'selective', sessions: 4, people: 96, completion: 88, last: '6 Nov' },
  { id: 'i4', name: 'Venture Funding', pillar: 'HENT', kind: 'selective', sessions: 5, people: 61, completion: 92, last: '30 Sep' },
  { id: 'i5', name: 'SIE', pillar: 'HEMP', kind: 'selective', sessions: 4, people: 520, completion: 71, last: '3 Nov' },
  { id: 'i6', name: 'Career Exposure', pillar: 'HEMP', kind: 'open', sessions: 9, people: 604, completion: 77, last: '28 Oct' },
  { id: 'i7', name: 'Internships', pillar: 'HEMP', kind: 'selective', sessions: 3, people: 142, completion: 95, last: '1 Oct' },
  { id: 'i8', name: 'Career Workshops', pillar: 'HEMP', kind: 'open', sessions: 8, people: 388, completion: 69, last: '22 Oct' },
  { id: 'i9', name: 'Public Sector Fellowship', pillar: 'HECO', kind: 'selective', sessions: 2, people: 58, completion: 0, last: '20 Nov' },
  { id: 'i10', name: 'Health Expert in Residence', pillar: 'HECO', kind: 'selective', sessions: 3, people: 24, completion: 83, last: '15 Sep' },
  { id: 'i11', name: 'Executive Courses', pillar: 'HECO', kind: 'open', sessions: 4, people: 132, completion: 74, last: '2 Dec' },
]

/* ---------- Notifications ---------- */
export const notifications = [
  { id: 'n1', title: 'Feedback form is still in draft', body: 'Public Sector Fellowship 2026', time: '12m', unread: true, tone: 'bad' as const },
  { id: 'n2', title: 'Import finished · 214 rows added', body: 'SIE Cohort 4 registrations.xlsx', time: '1h', unread: true, tone: 'good' as const },
  { id: 'n3', title: 'Grace Wanjiru exported a sheet', body: 'HEMP participants · de-identified', time: '3h', unread: false, tone: 'info' as const },
  { id: 'n4', title: '23 applications awaiting scores', body: 'SIE Cohort 4 · closes Friday', time: '1d', unread: false, tone: 'warn' as const },
]

/* ---------- Feedback responses ---------- */
export type FeedbackRow = { id: string; chiiId: string; date: string; pillar: Pillar; intervention: string; session: string; satisfaction: number; relevance: number; nps: number; comment: string }
export const feedbackRows: FeedbackRow[] = [
  { id: 'f1', chiiId: 'CHII-000231', date: '8 Nov 2025', pillar: 'HEMP', intervention: 'SIE', session: 'SIE Cohort 4', satisfaction: 5, relevance: 5, nps: 10, comment: 'The mock interviews were the most useful part.' },
  { id: 'f2', chiiId: 'CHII-000341', date: '8 Nov 2025', pillar: 'HEMP', intervention: 'SIE', session: 'SIE Cohort 4', satisfaction: 4, relevance: 4, nps: 8, comment: 'More time for group work, please.' },
  { id: 'f3', chiiId: 'CHII-000248', date: '7 Nov 2025', pillar: 'HENT', intervention: 'Mentorship', session: 'Mentorship Circle · Founders', satisfaction: 5, relevance: 4, nps: 9, comment: 'My mentor connected me to two investors.' },
  { id: 'f4', chiiId: 'CHII-000284', date: '29 Oct 2025', pillar: 'HEMP', intervention: 'Career Exposure', session: 'Career Exposure · Kigali', satisfaction: 3, relevance: 4, nps: 6, comment: 'Hospital visit was short; would like longer.' },
  { id: 'f5', chiiId: 'CHII-000215', date: '29 Oct 2025', pillar: 'HEMP', intervention: 'Career Exposure', session: 'Career Exposure · Kigali', satisfaction: 4, relevance: 5, nps: 9, comment: 'Clear picture of what pharmacists do day to day.' },
  { id: 'f6', chiiId: 'CHII-000214', date: '21 Oct 2025', pillar: 'HENT', intervention: 'Hackathon', session: 'HealthTech Hackathon', satisfaction: 5, relevance: 4, nps: 9, comment: 'Brilliant judges and real problem statements.' },
  { id: 'f7', chiiId: 'CHII-000325', date: '21 Oct 2025', pillar: 'HENT', intervention: 'Hackathon', session: 'HealthTech Hackathon', satisfaction: 4, relevance: 3, nps: 7, comment: 'Wi-fi struggled on day two.' },
  { id: 'f8', chiiId: 'CHII-000279', date: '16 Sep 2025', pillar: 'HECO', intervention: 'Health Expert in Residence', session: 'HEiR · Health financing', satisfaction: 5, relevance: 5, nps: 10, comment: 'Exactly the policy depth I was missing.' },
  { id: 'f9', chiiId: 'CHII-000317', date: '16 Sep 2025', pillar: 'HECO', intervention: 'Health Expert in Residence', session: 'HEiR · Health financing', satisfaction: 4, relevance: 5, nps: 8, comment: 'Would love reading material in advance.' },
  ...generateFeedback(150),
]

function generateFeedback(n: number): FeedbackRow[] {
  const r = rng(7)
  const good = ['Practical and well paced.', 'Facilitators knew the sector well.', 'I left with a clear next step.', 'Great peers in the room.', 'The case studies were very relevant.', 'Loved the site visit.', 'Useful templates I can reuse.']
  const mid = ['Good, but sessions ran over time.', 'Some content repeated earlier modules.', 'Would like more Q&A time.', 'Venue was hard to reach.', 'Slides arrived late.']
  const bad = ['Too theoretical for me.', 'Sound was poor online.', 'Not what the description promised.', 'Session was cancelled twice.']
  return Array.from({ length: n }, (_, i) => {
    const person = participants[Math.floor(r() * participants.length)]
    const pillar = person.pillars[0]
    const intervention = person.interventions.find((x) => byPillar[pillar].includes(x)) ?? byPillar[pillar][0]
    const nps = Math.max(0, Math.min(10, Math.round(5.2 + r() * 5.6 - (intervention === 'Career Exposure' ? 1.2 : 0))))
    const satisfaction = Math.max(1, Math.min(5, Math.round(nps / 2.2 + r())))
    const relevance = Math.max(1, Math.min(5, Math.round(nps / 2.3 + r() * 1.3)))
    return {
      id: `fg${i}`,
      chiiId: person.id,
      date: dayString(Math.floor(Math.pow(r(), 1.3) * 400)),
      pillar,
      intervention,
      session: `${intervention} · ${['Cohort A', 'Cohort B', 'Kigali', 'Lagos', 'Nairobi', 'Online'][Math.floor(r() * 6)]}`,
      satisfaction,
      relevance,
      nps,
      comment: (nps >= 9 ? good : nps >= 7 ? mid : bad)[Math.floor(r() * (nps >= 9 ? good.length : nps >= 7 ? mid.length : bad.length))],
    }
  })
}

/* ---------- Staff ---------- */
export type StaffRow = { id: string; name: string; email: string; role: Exclude<Role, 'none'>; pillars: Pillar[]; lastSeen: string }
export const staff: StaffRow[] = [
  { id: 'u1', name: 'Amara Okafor', email: 'amara.okafor@chii.alu.edu', role: 'admin', pillars: ['HENT', 'HEMP', 'HECO'], lastSeen: 'Now' },
  { id: 'u2', name: 'Daniel Mutua', email: 'daniel.mutua@chii.alu.edu', role: 'admin', pillars: ['HENT', 'HEMP', 'HECO'], lastSeen: '2h ago' },
  { id: 'u3', name: 'Tendai Moyo', email: 'tendai.moyo@chii.alu.edu', role: 'pillar_lead', pillars: ['HENT'], lastSeen: 'Yesterday' },
  { id: 'u4', name: 'Grace Wanjiru', email: 'grace.wanjiru@chii.alu.edu', role: 'pillar_staff', pillars: ['HEMP'], lastSeen: '3h ago' },
  { id: 'u5', name: 'Yusuf Abdi', email: 'yusuf.abdi@chii.alu.edu', role: 'pillar_lead', pillars: ['HEMP'], lastSeen: '4 Nov' },
  { id: 'u6', name: 'Esi Owusu', email: 'esi.owusu@chii.alu.edu', role: 'pillar_lead', pillars: ['HECO'], lastSeen: '1 Nov' },
  { id: 'u7', name: 'Kofi Mensah', email: 'kofi.mensah@chii.alu.edu', role: 'reviewer', pillars: ['HEMP', 'HECO'], lastSeen: 'Today' },
]
export const roleLabel: Record<Exclude<Role, 'none'>, string> = { admin: 'MELA admin', pillar_lead: 'Pillar lead', pillar_staff: 'Pillar staff', reviewer: 'Reviewer' }

/* ---------- Data & exports ---------- */
export const tableCounts = [
  { table: 'beneficiary', model: 'CHII', rows: 2044 },
  { table: 'participation', model: 'CHII', rows: 5318 },
  { table: 'session_attendance', model: 'CHII', rows: 5510 },
  { table: 'cohort_feedback', model: 'CHII', rows: 1406 },
  { table: 'application', model: 'CHII', rows: 1214 },
  { table: 'placement', model: 'CHII', rows: 142 },
  { table: 'sessions', model: 'Session', rows: 51 },
  { table: 'forms', model: 'Session', rows: 148 },
  { table: 'entries', model: 'Session', rows: 6022 },
  { table: 'attendance', model: 'Session', rows: 5510 },
]
export const exportLog = [
  { id: 'e1', who: 'Grace Wanjiru', what: 'HEMP · Participants sheet', when: '10 Nov, 11:42', filters: 'Intervention = SIE', rows: 312, restricted: false, format: 'xlsx' },
  { id: 'e2', who: 'Amara Okafor', what: 'CHII Participants', when: '10 Nov, 09:15', filters: 'None', rows: 2044, restricted: true, format: 'csv' },
  { id: 'e3', who: 'Tendai Moyo', what: 'HENT · Feedback sheet', when: '9 Nov, 16:03', filters: 'Date ≥ 1 Oct', rows: 188, restricted: true, format: 'pdf' },
  { id: 'e4', who: 'Daniel Mutua', what: 'cohort_feedback (table)', when: '8 Nov, 14:20', filters: 'None', rows: 1406, restricted: false, format: 'csv' },
  { id: 'e5', who: 'Esi Owusu', what: 'HECO · Participants sheet', when: '7 Nov, 10:51', filters: 'Pillar = HECO', rows: 214, restricted: true, format: 'xlsx' },
]

/* ---------- Analytics ---------- */
export const reachTrend = [
  { m: 'Dec', HENT: 22, HEMP: 41, HECO: 6 },
  { m: 'Jan', HENT: 38, HEMP: 64, HECO: 9 },
  { m: 'Feb', HENT: 41, HEMP: 88, HECO: 14 },
  { m: 'Mar', HENT: 57, HEMP: 92, HECO: 12 },
  { m: 'Apr', HENT: 49, HEMP: 110, HECO: 18 },
  { m: 'May', HENT: 63, HEMP: 104, HECO: 21 },
  { m: 'Jun', HENT: 44, HEMP: 71, HECO: 16 },
  { m: 'Jul', HENT: 39, HEMP: 66, HECO: 19 },
  { m: 'Aug', HENT: 72, HEMP: 118, HECO: 24 },
  { m: 'Sep', HENT: 81, HEMP: 139, HECO: 27 },
  { m: 'Oct', HENT: 96, HEMP: 151, HECO: 22 },
  { m: 'Nov', HENT: 70, HEMP: 144, HECO: 26 },
]
export const weekly = [
  { w: 'W36', registered: 120, attended: 96 },
  { w: 'W37', registered: 148, attended: 117 },
  { w: 'W38', registered: 102, attended: 85 },
  { w: 'W39', registered: 176, attended: 131 },
  { w: 'W40', registered: 210, attended: 162 },
  { w: 'W41', registered: 188, attended: 150 },
  { w: 'W42', registered: 264, attended: 214 },
  { w: 'W43', registered: 231, attended: 172 },
  { w: 'W44', registered: 198, attended: 160 },
  { w: 'W45', registered: 242, attended: 189 },
]
export const funnel = [
  { stage: 'Registered', value: 6022 },
  { stage: 'Attended', value: 4710 },
  { stage: 'Completed', value: 3586 },
  { stage: 'Gave feedback', value: 1406 },
]
export const countries = [
  { name: 'Rwanda', value: 612 },
  { name: 'Nigeria', value: 344 },
  { name: 'Kenya', value: 281 },
  { name: 'Ghana', value: 196 },
  { name: 'Uganda', value: 158 },
  { name: 'Other (19)', value: 453 },
]
export const gender = [
  { name: 'Female', value: 1124 },
  { name: 'Male', value: 891 },
  { name: 'Not stated', value: 29 },
]
export const npsByIntervention = [
  { name: 'Internships', nps: 71 },
  { name: 'HEiR', nps: 68 },
  { name: 'Mentorship', nps: 62 },
  { name: 'Hackathon', nps: 54 },
  { name: 'SIE', nps: 49 },
  { name: 'Masterclass', nps: 41 },
  { name: 'Career Exposure', nps: 33 },
]

/* ---------- Applications (reviewer) ---------- */
export const applications = [
  { id: 'CHII-000231', session: 'SIE Cohort 4', submitted: '2 Nov', motivation: 'I want to build a career in digital health supply chains after seeing medicine stock-outs in rural Kenya.', score: null as number | null },
  { id: 'CHII-000284', session: 'SIE Cohort 4', submitted: '2 Nov', motivation: 'My goal is to work in hospital administration and improve patient flow in Dar es Salaam.', score: null },
  { id: 'CHII-000317', session: 'Public Sector Fellowship 2026', submitted: '4 Nov', motivation: 'I have researched community health insurance uptake and want to bring evidence into ministry policy.', score: null },
  { id: 'CHII-000341', session: 'SIE Cohort 4', submitted: '5 Nov', motivation: 'I run a student health club and want structured exposure to employers in the sector.', score: 14 },
  { id: 'CHII-000263', session: 'Public Sector Fellowship 2026', submitted: '6 Nov', motivation: 'I am interested in how health budgets are set and want to support Senegal’s UHC agenda.', score: null },
  { id: 'CHII-000215', session: 'SIE Cohort 4', submitted: '6 Nov', motivation: 'After Career Exposure I want hands-on experience in a health startup.', score: 17 },
]
