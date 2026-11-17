/**
 * Standard operating procedures (SOPs): how each pillar runs its work, step by step, with each
 * step pointing to where it's done in the app. CHII-wide SOPs apply to every pillar.
 *
 * These are drafts written from the processes the platform supports. Each pillar lead reviews
 * and approves their own; until then they show as drafts.
 */
import { useSyncExternalStore } from 'react'
import type { Pillar } from './mela'

export type SopStep = { title: string; detail: string; /** App page where the step is done. */ to?: string; toLabel?: string }

export type Sop = {
  id: string
  title: string
  /** Pillar it belongs to, or CHII for every pillar. */
  pillar: Pillar | 'CHII'
  owner: string
  purpose: string
  appliesTo: string[]
  steps: SopStep[]
  version: number
  status: 'Draft' | 'Approved'
  reviewedBy?: string
  reviewedAt?: string
}

const S = (id: string, x: Omit<Sop, 'id' | 'version' | 'status'>): Sop => ({ id, version: 1, status: 'Draft', ...x })

export function seedSops(): Sop[] {
  return [
    // CHII-wide
    S('sop-consent', {
      title: 'Consent and personal data',
      pillar: 'CHII',
      owner: 'MELA',
      purpose: 'Collect only what we need, with consent, and keep names and contacts out of reports and shared files.',
      appliesTo: ['Every form', 'Every export', 'Every report'],
      steps: [
        { title: 'Use a form with the consent statement', detail: 'Every CHII form ends with the consent box; never collect data on a form without it.', to: 'interventions', toLabel: 'Interventions' },
        { title: 'Match people to their CHII ID', detail: 'Use email so each person is counted once. Don’t create duplicate people by hand.' },
        { title: 'Share de-identified data by default', detail: 'Exports leave out names and contacts unless you tick “Include restricted columns”, which is logged.', to: 'db-participants', toLabel: 'Participants sheet' },
        { title: 'Keep sensitive answers sensitive', detail: 'Disability, humanitarian status and standing are never shown in Public reports or to reviewers.' },
        { title: 'Report a data incident the same day', detail: 'If a file with names goes to the wrong place, tell MELA immediately.' },
      ],
    }),
    S('sop-attendance', {
      title: 'Taking attendance',
      pillar: 'CHII',
      owner: 'Pillar staff',
      purpose: 'Every session date has attendance taken, so completion, reach and reports are right.',
      appliesTo: ['Every session'],
      steps: [
        { title: 'Open the check-in before the session', detail: 'Session → Attendance check-in form → Open. Put the QR on screen or at the door.', to: 'interventions', toLabel: 'Interventions' },
        { title: 'Add walk-ins on the day', detail: 'Use Walk-in on the Attendance tab for people who didn’t register.' },
        { title: 'Check the list before you leave', detail: 'Mark anyone present who couldn’t scan. Absent stays absent.' },
        { title: 'Close the check-in after the last date', detail: 'So late scans don’t count towards the wrong session.' },
      ],
    }),
    S('sop-feedback', {
      title: 'Collecting feedback',
      pillar: 'CHII',
      owner: 'Pillar staff',
      purpose: 'Get feedback from at least 40% of attendees, while the session is fresh.',
      appliesTo: ['Every session'],
      steps: [
        { title: 'Open the feedback form at the last session', detail: 'Give people 5 minutes in the room to answer; response rates fall fast after.', to: 'interventions', toLabel: 'Interventions' },
        { title: 'Send one reminder after 3 days', detail: 'Only to people who attended and haven’t answered.' },
        { title: 'Close it after two weeks', detail: 'Then the session process shows Completed.' },
        { title: 'Read the written answers', detail: 'CHII Feedbacks and the session’s Feedback tab; note anything to fix next time.', to: 'feedback', toLabel: 'CHII Feedbacks' },
      ],
    }),
    S('sop-report', {
      title: 'Writing a quarterly report',
      pillar: 'CHII',
      owner: 'Pillar lead',
      purpose: 'Quarterly reports use the same numbers as the dashboard and pass the data check before they’re final.',
      appliesTo: ['Pillar quarterly report', 'Donor reports'],
      steps: [
        { title: 'Start from the template', detail: 'Reports → New report → Pillar quarterly report.', to: 'reports', toLabel: 'Reports' },
        { title: 'Fix the data check first', detail: 'Missing attendance and low feedback rates show in the data check; fix them before writing.' },
        { title: 'Write the summary last', detail: 'Use the live numbers; replace every starter sentence.' },
        { title: 'Submit for review', detail: 'Staff submit; the pillar lead finalises internal reports. Partner and Public reports need MELA.' },
      ],
    }),
    // HEMP
    S('sop-hemp-selective', {
      title: 'Running a selective cohort (SIE)',
      pillar: 'HEMP',
      owner: 'HEMP lead',
      purpose: 'Take an SIE cohort from applications to feedback the same way every time.',
      appliesTo: ['SIE', 'Internships'],
      steps: [
        { title: 'Create the session', detail: 'Interventions → SIE → New session. The application, check-in and feedback forms come from the SIE templates.', to: 'interventions', toLabel: 'Interventions' },
        { title: 'Open applications and share the link', detail: 'Share the mission-statement guide from Resources with the call for applications.', to: 'resources', toLabel: 'Resources' },
        { title: 'Assign reviewers and score blind', detail: 'Reviewers see programme answers only; at least two scores per application.', to: 'applications', toLabel: 'Applications' },
        { title: 'Select, waitlist and notify', detail: 'Only students available for the full programme can be selected.' },
        { title: 'Close applications', detail: 'Before the virtual phase starts.' },
        { title: 'Run the programme and take attendance', detail: 'Follow the Taking attendance SOP for each date.' },
        { title: 'Collect anonymous feedback with participant codes', detail: 'Give each participant their SIE26-XX code at the start.' },
        { title: 'Wrap up and report', detail: 'Close feedback; the session shows Completed and offers Write the report.' },
      ],
    }),
    S('sop-hemp-workshops', {
      title: 'Career workshops: registration to feedback',
      pillar: 'HEMP',
      owner: 'HEMP staff',
      purpose: 'Run open workshops with clean registration data and a feedback rate above 40%.',
      appliesTo: ['Career Workshops', 'Career Exposure'],
      steps: [
        { title: 'Create the session and open registration', detail: 'Interventions → Career Workshops → New session → Open the registration form.', to: 'interventions', toLabel: 'Interventions' },
        { title: 'Close registration the day before', detail: 'Confirm the room and numbers from the Registrations tab.' },
        { title: 'Take attendance on the day', detail: 'QR check-in at the door, walk-ins added by hand.' },
        { title: 'Open feedback before people leave', detail: 'Ask which session they attended so answers land in the right place.' },
      ],
    }),
    // HECO
    S('sop-heco-fellowship', {
      title: 'Public Sector Fellowship selection',
      pillar: 'HECO',
      owner: 'HECO lead',
      purpose: 'Select fellows fairly and on time, with host ministries agreed before offers go out.',
      appliesTo: ['Public Sector Fellowship'],
      steps: [
        { title: 'Agree host placements first', detail: 'Confirm the number of placements with each host before opening applications.' },
        { title: 'Open applications', detail: 'Interventions → Public Sector Fellowship → the session → open the application form.', to: 'interventions', toLabel: 'Interventions' },
        { title: 'Blind review by two reviewers', detail: 'Reviewers score on the Applications page; disagreements over 4 points go to the lead.', to: 'applications', toLabel: 'Applications' },
        { title: 'Interview the shortlist', detail: 'Record the decision on the Applications tab of the session.' },
        { title: 'Send offers and waitlist', detail: 'Offers go once hosts confirm; keep a short waitlist for drop-outs.' },
      ],
    }),
    S('sop-heco-courses', {
      title: 'Delivering an executive course',
      pillar: 'HECO',
      owner: 'HECO staff',
      purpose: 'Deliver short executive courses with complete attendance and feedback.',
      appliesTo: ['Executive Courses', 'Health Expert in Residence'],
      steps: [
        { title: 'Create the session with every date', detail: 'Add each teaching day so attendance can be taken per day.', to: 'interventions', toLabel: 'Interventions' },
        { title: 'Open registration and confirm participants', detail: 'Confirm on the Registrations tab once fees or nominations are settled.' },
        { title: 'Take attendance each day', detail: 'Completion needs 75% of dates by default.' },
        { title: 'Collect feedback on the last day', detail: 'Then close the session.' },
      ],
    }),
    // HENT
    S('sop-hent-registry', {
      title: 'Adding and updating ventures',
      pillar: 'HENT',
      owner: 'HENT lead',
      purpose: 'Keep one record per venture, with founders linked to CHII IDs and updates every six months.',
      appliesTo: ['Venture Registry'],
      steps: [
        { title: 'Review registrations from the form', detail: 'Ventures → Registry → Registrations. Check for duplicates before adding.', to: 'ventures', toLabel: 'Venture Registry' },
        { title: 'Add or import ventures', detail: 'Add one at a time, or import the venture sheet with a dry run first.', to: 'ventures-import', toLabel: 'Import' },
        { title: 'Run the update round', detail: 'Ventures → Updates: create links, send, remind after a week.', to: 'ventures-updates', toLabel: 'Updates' },
        { title: 'Accept founder updates', detail: 'Compare with the last update; query big jumps before accepting.' },
        { title: 'Clear “Needs attention”', detail: 'The data quality rules flag missing founders, stale updates and duplicates.' },
      ],
    }),
    S('sop-hent-hackathon', {
      title: 'Running a hackathon',
      pillar: 'HENT',
      owner: 'HENT staff',
      purpose: 'Run hackathons that feed promising teams into Mentorship and Venture Funding.',
      appliesTo: ['Hackathon', 'Masterclass'],
      steps: [
        { title: 'Create the session and open registration', detail: 'Teams register individually so everyone gets a CHII ID.', to: 'interventions', toLabel: 'Interventions' },
        { title: 'Take attendance each day', detail: 'QR at the door; judges and mentors don’t check in.' },
        { title: 'Record winning teams as ventures', detail: 'Add teams that continue to the Venture Registry, with their founders.', to: 'ventures', toLabel: 'Venture Registry' },
        { title: 'Collect feedback before prizes', detail: 'Response rates are highest before the closing ceremony.' },
      ],
    }),
  ]
}

const KEY = 'mela-sops-v1'
let cache: Sop[] | null = null
const listeners = new Set<() => void>()
function load(): Sop[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Sop[]) : seedSops()
  } catch {
    cache = seedSops()
  }
  return cache
}
function persist(next: Sop[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* keep in memory */
  }
  listeners.forEach((l) => l())
}
export const useSops = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), load, load)
export const getSops = load

/** SOPs a portal sees: its own pillar's and the CHII-wide ones (MELA sees all). */
export const sopsFor = (all: Sop[], pillars: Pillar[]) => all.filter((x) => x.pillar === 'CHII' || pillars.includes(x.pillar))

/** A pillar lead (or MELA) approves an SOP after reviewing it; the version goes up. */
export function approveSop(id: string, by: string) {
  persist(load().map((x) => (x.id === id ? { ...x, status: 'Approved', reviewedBy: by, reviewedAt: new Date().toISOString().slice(0, 10), version: x.status === 'Approved' ? x.version + 1 : x.version } : x)))
}

export function resetSops() {
  persist(seedSops())
}
