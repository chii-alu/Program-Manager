import React, { useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink, Eye, Link2, QrCode, Search, Trash2, UserPlus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AppShell } from '../shared/components/AppShell'
import { Button, Panel, PanelHeader, PillarTag, StatusBadge } from '../shared/components/ui'
import { Modal } from '../shared/components/Modal'
import { Field, inputClass } from '../shared/components/NewSessionModal'
import { ChartTooltip, axisProps, gridProps, valueAxisProps, categoryAxisProps, valueLabelProps } from '../shared/components/charts'
import { QrMark } from '../shared/components/QrMark'
import { Participant, Portal, Role, applications, canSeeIdentity, interventions, feedbackRows, participants, sessions } from '../shared/data/mela'
import { Column, DataTable } from '../shared/components/DataTable'
import { EmptyState } from '../shared/components/EmptyState'
import { applicationTemplateFor, askedOnForm, reviewQuestions, templateFor, type Answers, type FormTemplate } from '../shared/forms/templates'
import { sampleAnswers, sampleResponses } from '../shared/forms/samples'
import { notify, toast } from '../shared/lib/notify'
import { logAction, type LogAction } from '../shared/lib/interventionLog'
import { userFor } from '../shared/lib/auth'

type Log = (action: LogAction, detail: string) => void
import { CheckCheck, UserRound, Users, XCircle } from 'lucide-react'
import { addSampleResponses, deleteSession, recordAttendance, updateSession, recordSelected, setFormStatus, useLifecycle, useSessions, type FormStatus, type SessionRun } from '../shared/data/sessionStore'

export const args = {
  role: 'admin',
  portal: 'admin',
  sessionId: 's2',
  tab: 'forms',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onBack?: () => void
  onOpenPerson?: (id: string) => void
  /** Opens the form preview: application/registration, attendance or feedback. */
  onOpenForm?: (kind: 'application' | 'registration' | 'attendance' | 'feedback') => void
}

const tabs = ['forms', 'people', 'attendance', 'feedback', 'details'] as const

export default function Session(props: Props) {
  const { role: r, portal: p, sessionId, tab: initialTab, onNavigate, onPortalChange, onSignOut, onBack, onOpenPerson, onOpenForm } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const all = useSessions()
  const s = all.find((x) => x.id === sessionId) ?? all[1]
  // Every change on this page goes in the pillar's Interventions activity log, as the signed-in person.
  const log: Log = (action, detail) => logAction({ by: userFor(role, portal).user, pillar: s.pillar, action, session: s.name, detail })
  const [tab, setTab] = useState(initialTab)
  const [share, setShare] = useState<string | null>(null)

  return (
    <AppShell role={role} portal={portal} active="interventions" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <ShareModal form={share} code={formCode(s.name)} onClose={() => setShare(null)} />
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-5">
        <button type="button" onClick={onBack} className="-ml-1 flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Interventions
        </button>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{s.name}</h1>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <PillarTag pillar={s.pillar} />
              <span>{s.intervention}</span>
              <span className="text-faint">·</span>
              <span className="capitalize">{s.kind}</span>
              <span className="text-faint">·</span>
              <span>{s.dates}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 sm:flex-none" onClick={() => setShare('Attendance check-in')}>
              <QrCode className="h-4 w-4" /> Check-in QR
            </Button>
            <Button variant="primary" className="flex-1 sm:flex-none" onClick={() => setShare(s.kind === 'selective' ? 'Application' : 'Registration')}>
              <Link2 className="h-4 w-4" /> Share form
            </Button>
          </div>
        </div>

        <SessionProcess s={s} log={log} onTab={setTab} onNavigate={onNavigate} />

        <nav className="no-scrollbar -mx-4 mt-5 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-5">
            {tabs.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => setTab(t)}
                  className={`relative h-10 text-sm font-medium capitalize transition-colors duration-150 ease-out ${tab === t ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {t === 'people' ? (s.kind === 'selective' ? 'Applications' : 'Registrations') : t}
                  {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-5">
          {tab === 'forms' && <FormsTab sessionId={s.id} log={log} kind={s.kind} intervention={s.intervention} cohort={s.name} registered={s.registered} attended={s.attended} feedback={s.feedback} onPreview={onOpenForm} onShare={setShare} />}
          {tab === 'people' && <PeopleTab sessionId={s.id} limit={s.created ? s.registered : undefined} log={log} role={role} selective={s.kind === 'selective'} intervention={s.intervention} session={s.name} onOpenPerson={onOpenPerson} />}
          {tab === 'attendance' && <AttendanceTab sessionDates={s.dateList} sessionId={s.id} limit={s.created ? s.registered : undefined} log={log} role={role} intervention={s.intervention} onQr={() => setShare('Attendance check-in')} />}
          {tab === 'feedback' &&
            (templateFor(s.intervention, 'feedback', s.name) ? (
              <TemplateFeedbackTab template={templateFor(s.intervention, 'feedback', s.name)!} attended={s.attended} feedback={s.feedback} cohort={s.name} intervention={s.intervention} />
            ) : (
              <FeedbackTab attended={s.attended} feedback={s.feedback} />
            ))}
          {tab === 'details' && <DetailsTab key={s.id} s={s} log={log} onDeleted={onBack} />}
        </div>
      </div>
    </AppShell>
  )
}

/* ---------------- The session's process ---------------- */

type Step = { key: string; title: string; done: boolean; body: string; action?: { label: string; run: () => void }; extra?: { label: string; run: () => void } }

/**
 * The whole process, from registration forms to feedback, as one tracker: what's done, what's
 * next and the button that does it. Every action goes through the same store and activity log
 * as the tabs below, so the tracker and the tabs always agree.
 */
function SessionProcess({ s, log, onTab, onNavigate }: { s: SessionRun; log: Log; onTab: (t: (typeof tabs)[number]) => void; onNavigate?: (to: string) => void }) {
  const life = useLifecycle(s.id)
  const selective = s.kind === 'selective'
  const regName = selective ? 'Application' : 'Registration'
  const code = formCode(s.name)
  const regT = templateFor(s.intervention, selective ? 'application' : 'registration', s.name)
  const fbkT = templateFor(s.intervention, 'feedback', s.name)
  const form = (k: 'reg' | 'att' | 'fbk', st: FormStatus, name: string, suffix: string, extra = '') => {
    setFormStatus(s.id, k, st)
    log(st === 'open' ? 'form_opened' : st === 'closed' ? 'form_closed' : 'form_draft', `${st === 'open' ? 'Opened' : 'Closed'} the ${name} form (${code}-${suffix})${extra}`)
  }
  const rate = s.attended ? Math.round((s.feedback / s.attended) * 100) : 0

  const steps: Step[] = [
    {
      key: 'forms',
      title: 'Forms ready',
      done: true,
      body: `${regName}${regT ? ` (${regT.title})` : ''}, attendance check-in and feedback${fbkT ? ` (${fbkT.title})` : ''}, created as drafts.`,
    },
    {
      key: 'open',
      title: `Open ${selective ? 'applications' : 'registration'}`,
      done: life.forms.reg !== 'draft',
      body: life.forms.reg === 'draft' ? `Open the ${regName.toLowerCase()} form, then share its link (/f/${code}-REG).` : `${s.registered.toLocaleString()} ${selective ? 'applications' : 'registrations'} so far.`,
      action: { label: `Open the ${regName.toLowerCase()} form`, run: () => form('reg', 'open', regName, 'REG') },
    },
    ...(selective
      ? [
          {
            key: 'select',
            title: 'Review and select',
            done: life.selected > 0,
            body: life.selected ? `${life.selected} selected.` : 'Reviewers score the applications; then select who joins.',
            action: { label: 'Go to applications', run: () => onTab('people') },
          },
        ]
      : []),
    {
      key: 'close',
      title: `Close ${selective ? 'applications' : 'registration'}`,
      done: life.forms.reg === 'closed',
      body: `Stop new ${selective ? 'applications' : 'registrations'} before the session starts.`,
      action: { label: `Close the ${regName.toLowerCase()} form`, run: () => form('reg', 'closed', regName, 'REG', `: ${s.registered.toLocaleString()} responses`) },
    },
    {
      key: 'attendance',
      title: 'Take attendance',
      done: life.attendanceDays > 0,
      body: life.attendanceDays ? `${s.attended.toLocaleString()} attended · ${life.attendanceDays} date${life.attendanceDays === 1 ? '' : 's'} marked.` : 'Open the check-in on the day, or mark attendance by hand.',
      action: {
        label: life.forms.att === 'open' ? 'Go to attendance' : 'Open check-in',
        run: () => {
          if (life.forms.att !== 'open') form('att', 'open', 'Attendance check-in', 'ATT')
          onTab('attendance')
        },
      },
    },
    {
      key: 'feedback',
      title: 'Collect feedback',
      done: life.forms.fbk !== 'draft',
      body: life.forms.fbk === 'draft' ? 'Open the feedback form after the last session date.' : `${s.feedback.toLocaleString()} responses · ${rate}% of those who attended.`,
      action: { label: 'Open the feedback form', run: () => form('fbk', 'open', 'Feedback', 'FBK') },
    },
    {
      key: 'wrap',
      title: 'Wrap up',
      done: life.forms.fbk === 'closed',
      body: life.forms.fbk === 'closed' ? `${s.attended.toLocaleString()} attended · ${s.feedback.toLocaleString()} feedback responses (${rate}%). Every step is in the Activity log.` : 'Close the feedback form once responses stop coming in. The session is then completed.',
      action: {
        label: 'Close feedback and finish',
        run: () => {
          if (life.forms.att === 'open') form('att', 'closed', 'Attendance check-in', 'ATT')
          form('fbk', 'closed', 'Feedback', 'FBK', `: ${s.feedback.toLocaleString()} responses`)
        },
      },
    },
  ]

  // Prototype only: a new session can't get real responses, so it can be filled with sample ones.
  const cur = steps.find((x) => !x.done)
  if (s.created && cur?.key === (selective ? 'select' : 'close') && s.registered === 0)
    cur.extra = { label: 'Add sample responses', run: () => addSampleResponses(s.id, 'registered', 24) }
  if (s.created && cur?.key === 'wrap' && s.feedback === 0 && s.attended > 0)
    cur.extra = { label: 'Add sample feedback', run: () => addSampleResponses(s.id, 'feedback', Math.max(1, Math.round(s.attended * 0.45))) }

  const doneCount = steps.filter((x) => x.done).length
  return (
    <section aria-label="Session process" className="mt-5 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5 sm:px-5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">Session process</h2>
        <span className="text-xs text-muted">
          {doneCount} of {steps.length} steps done
        </span>
      </div>
      <ol className="no-scrollbar flex overflow-x-auto px-2 py-3 sm:px-3">
        {steps.map((x, i) => {
          const now = x === cur
          return (
            <li key={x.key} className="flex min-w-[124px] flex-1 items-start gap-2 px-2">
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${x.done ? 'bg-good text-white' : now ? 'bg-brand text-white ring-4 ring-brand-100' : 'bg-canvas text-muted'}`}
              >
                {x.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`text-[12.5px] leading-snug ${now ? 'font-semibold text-ink' : x.done ? 'text-body' : 'text-muted'}`}>{x.title}</span>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-col gap-3 border-t border-line bg-canvas/60 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        {cur ? (
          <>
            <p className="min-w-0 flex-1 text-sm text-body">
              <span className="font-semibold text-ink">Next: {cur.title}.</span> {cur.body}
            </p>
            <div className="flex flex-wrap gap-2">
              {cur.extra && (
                <Button className="h-9 text-xs" onClick={cur.extra.run}>
                  {cur.extra.label} <span className="font-normal text-muted">(prototype)</span>
                </Button>
              )}
              {cur.action && (
                <Button variant="primary" className="h-9 text-xs" onClick={cur.action.run}>
                  {cur.action.label}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-sm text-body">
              <span className="font-semibold text-good">Completed.</span> {steps[steps.length - 1].body}
            </p>
            <Button variant="primary" className="h-9 text-xs" onClick={() => onNavigate?.('reports')}>
              Write the report
            </Button>
          </>
        )}
      </div>
    </section>
  )
}

/* ---------------- Forms ---------------- */

/**
 * Short form code from the cohort name: an acronym it starts with ("SIE Cohort 4" → SIE4,
 * "SFH Internship · Cohort 4" → SFH4), otherwise the initials of its main name
 * ("Career Workshop · CV & interview skills" → CW), plus the cohort number if there is one.
 */
export const formCode = (cohort: string) => {
  const main = cohort.split('·')[0].trim()
  const first = main.split(/\s+/)[0]
  const head = /^[A-Z]{2,}$/.test(first) ? first : main.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^cohort$/i.test(w)).map((w) => w[0].toUpperCase()).join('')
  return `${head.slice(0, 4)}${cohort.match(/(\d+)\s*$/)?.[1] ?? ''}`
}

function FormsTab({ sessionId, log, kind, intervention, cohort, registered, attended, feedback, onPreview, onShare }: { sessionId: string; log: Log; kind: string; intervention: string; cohort: string; registered: number; attended: number; feedback: number; onPreview?: (k: 'application' | 'registration' | 'attendance' | 'feedback') => void; onShare: (f: string) => void }) {
  // Form statuses are part of the session's process, so they're kept (and drive the tracker above).
  const life = useLifecycle(sessionId)
  const KEYS = { a: 'reg', b: 'att', c: 'fbk' } as const
  const status: Record<string, string> = { a: life.forms.reg, b: life.forms.att, c: life.forms.fbk }
  const setStatus = (next: Record<string, string>) => {
    for (const k of ['a', 'b', 'c'] as const) if (next[k] !== status[k]) setFormStatus(sessionId, KEYS[k], next[k] as FormStatus)
  }
  const forms = [
    {
      id: 'a',
      name: kind === 'selective' ? 'Application' : 'Registration',
      code: `${formCode(cohort)}-REG`,
      responses: registered,
      // Selective interventions with their own application template (e.g. SIE) count its questions.
      // A cohort with its own template (SIE, SFH, Career Workshops…) counts the questions people answer.
      questions: (() => {
        const t = templateFor(intervention, kind === 'selective' ? 'application' : 'registration', cohort)
        return t ? askedOnForm(t).length : 14
      })(),
      template: templateFor(intervention, kind === 'selective' ? 'application' : 'registration', cohort),
      preview: (kind === 'selective' && applicationTemplateFor(intervention, cohort) ? 'application' : 'registration') as 'application' | 'registration',
    },
    { id: 'b', name: 'Attendance check-in', code: `${formCode(cohort)}-ATT`, responses: attended, questions: 3, template: null, preview: 'attendance' as const },
    { id: 'c', name: 'Feedback', code: `${formCode(cohort)}-FBK`, responses: feedback, questions: (() => { const t = templateFor(intervention, 'feedback', cohort); return t ? askedOnForm(t).length : 11 })(), template: templateFor(intervention, 'feedback', cohort), preview: 'feedback' as const },
  ]
  return (
    <Panel>
      <ul className="divide-y divide-line">
        {forms.map((f) => (
          <li key={f.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{f.name}</span>
                <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-muted">/f/{f.code}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {f.questions} questions · consent required · {f.responses.toLocaleString()} responses
                {f.template && <> · template: {f.template.title} (v{f.template.version})</>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-0.5 rounded-lg bg-canvas p-0.5">
                {['draft', 'open', 'closed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      if (status[f.id] === st) return
                      setStatus({ ...status, [f.id]: st })
                      log(st === 'open' ? 'form_opened' : st === 'closed' ? 'form_closed' : 'form_draft', `${st === 'open' ? 'Opened' : st === 'closed' ? 'Closed' : 'Set to draft'} the ${f.name} form (${f.code})${st === 'closed' ? `: ${f.responses.toLocaleString()} responses` : ''}`)
                    }}
                    className={`h-7 rounded-md px-2.5 text-xs font-medium capitalize transition-colors duration-150 ease-out ${
                      status[f.id] === st
                        ? st === 'open'
                          ? 'bg-good-bg text-good'
                          : st === 'draft'
                            ? 'bg-warn-bg text-warn'
                            : 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <Button className="h-8 px-3 text-xs" onClick={() => onPreview?.(f.preview)}>
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
              <Button className="h-8 px-3 text-xs" onClick={() => onShare(f.name)}>
                <Link2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">Only open forms accept responses. Draft and closed forms show “This form is not accepting responses”.</p>
    </Panel>
  )
}

function ShareModal({ form, code, onClose }: { form: string | null; code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = `mela.chii.alu.edu/f/${code}-${form === 'Attendance check-in' ? 'ATT' : form === 'Feedback' ? 'FBK' : 'REG'}`
  return (
    <Modal open={!!form} onClose={() => (setCopied(false), onClose())} title={`Share ${form?.toLowerCase() ?? ''} form`} description="Anyone with the link can respond while the form is open." size="sm" icon={<QrCode className="h-4 w-4" />}>
      <div className="flex flex-col items-center">
        <div className="rounded-xl border border-line bg-white p-4">
          <QrMark seed={url} />
        </div>
        <div className="mt-4 flex w-full gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-line-strong bg-canvas px-3 font-mono text-xs text-body">
            <span className="truncate">{url}</span>
          </div>
          <Button className="h-10" onClick={() => setCopied(true)}>
            {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div className="mt-3 grid w-full grid-cols-2 gap-2">
          <Button className="h-10">Download QR</Button>
          <Button className="h-10">
            <ExternalLink className="h-4 w-4" /> Open
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- People ---------------- */

type Entry = Participant & { score: number | null; submitted: string; st: string; answers?: Answers }

/** Short column headings and values for application answers in the applicant table. */
const SHORT: Record<string, string> = {
  degree: 'Degree',
  intake: 'Intake',
  has_mission: 'Health mission',
  available: 'Full programme',
  credit: 'SI credit',
  si_term: 'SI term',
  department: 'SFH department',
  enrollment: 'Enrollment',
  year_group: 'Year group',
  program: 'Programme',
  institution: 'Institution',
}
const SHORT_VALUE: Record<string, string> = {
  'Yes, I’m available for the full programme': 'Available',
  No: 'No',
  'Yes, for Skills Immersion 1': 'SI 1',
  'Yes, for Skills Immersion 2': 'SI 2',
  'No, not for credit': 'Not for credit',
  'BSc (Hons) Software Engineering': 'Software Engineering',
  'BSc (Hons) Entrepreneurial Leadership': 'Entrepreneurial Leadership',
  'BSc (Hons) Global Challenges': 'Global Challenges',
  'BA (Hons) International Business & Trade': 'International Business & Trade',
}

function PeopleTab({ sessionId, limit, log, role, selective, intervention, session, onOpenPerson }: { sessionId: string; limit?: number; log: Log; role: Role; selective: boolean; intervention: string; session: string; onOpenPerson?: (id: string) => void }) {
  const showId = canSeeIdentity(role)
  const statuses = selective ? ['Applied', 'Selected', 'Waitlisted', 'Not selected'] : ['Registered', 'Confirmed', 'Cancelled']
  const [state, setState] = useState<Record<string, string>>({})
  const [only, setOnly] = useState<string | null>(null)
  const pool = participants.filter((x) => x.interventions.includes(intervention))
  // A new session only lists the responses it has (none until its form is open).
  const base = (pool.length >= 8 ? pool : participants.slice(0, 24)).slice(0, limit ?? undefined).map((x, i) => {
    const score = selective ? ((i * 7) % 5 === 0 ? null : 9 + ((i * 13) % 12)) : null
    return { ...x, score, submitted: x.joined, def: selective ? (score != null && score >= 16 ? 'Selected' : 'Applied') : i % 9 === 4 ? 'Cancelled' : i % 3 === 0 ? 'Confirmed' : 'Registered' }
  })
  // A cohort with its own application template (SIE, SFH…) shows each applicant's answers to it:
  // the real ones where we have them, otherwise sample answers. Identity answers never appear.
  // Open interventions use their registration template the same way (e.g. Career Workshops).
  const tpl = selective ? applicationTemplateFor(intervention, session) : templateFor(intervention, 'registration', session)
  const answerCols = !tpl
    ? []
    : selective
      ? reviewQuestions(tpl).filter((q) => (q.type === 'radio' || q.type === 'select') && !q.showIf)
      : // Registrations: the programme answers staff use, never identity or sensitive ones (disability, humanitarian status, standing).
        tpl.questions.filter((q) => (q.type === 'radio' || q.type === 'select') && !q.identity && !q.sensitive && !q.fromRecords && !q.auto && !q.showIf && !['gender', 'gender_identity'].includes(q.id))
  const all: Entry[] = base.map((x) => ({ ...x, st: state[x.id] ?? x.def, answers: tpl ? (applications.find((a) => a.id === x.id)?.answers ?? sampleAnswers(tpl, x.id)) : undefined }))
  const rows = only ? all.filter((x) => x.st === only) : all
  const setStatus = (ids: string[], st: string) => {
    const wasSelected = ids.filter((id) => all.find((x) => x.id === id)?.st === 'Selected').length
    const nowSelected = st === 'Selected' ? ids.length : 0
    if (nowSelected !== wasSelected) recordSelected(sessionId, nowSelected - wasSelected)
    setState((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, st])) }))
    toast({ title: `${ids.length === 1 ? (showId ? all.find((x) => x.id === ids[0])?.name : ids[0]) : `${ids.length} people`} → ${st}`, tone: st === 'Selected' || st === 'Confirmed' ? 'good' : 'info' })
    // The log names applicants by CHII ID only, never by name.
    log('applicants_decided', `${ids.length === 1 ? ids[0] : `${ids.length} ${selective ? 'applicants' : 'people'}`} → ${st}${st === 'Selected' ? ' · offer emails queued' : ''}`)
    if (st === 'Selected') notify({ title: `Selected for ${session}`, body: `${ids.length} applicant${ids.length === 1 ? '' : 's'} · offer emails queued`, tone: 'good' }, { toast: false })
  }

  const columns: Column<Entry>[] = [
    { key: 'id', label: 'CHII ID', render: (x) => <span className="whitespace-nowrap font-mono text-[13px] font-medium text-brand-600">{x.id}</span> },
    { key: 'name', label: 'Name', restricted: true, filterable: false, render: (x) => <span className="block max-w-[200px] truncate font-medium">{x.name}</span> },
    { key: 'email', label: 'Email', restricted: true, exportOnly: true },
    { key: 'gender', label: 'Gender', hideBelow: 'lg' },
    { key: 'country', label: 'Country' },
    { key: 'age', label: 'Age', numeric: true, hideBelow: 'xl' },
    { key: 'submitted', className: 'whitespace-nowrap', label: selective ? 'Applied' : 'Registered', filterable: false, hideBelow: 'lg' },
    ...answerCols.map(
      (q, k): Column<Entry> => ({
        key: `a_${q.id}`,
        label: SHORT[q.id] ?? q.label,
        value: (x) => String(x.answers?.[q.id] ?? ''),
        hideBelow: k > 1 ? 'xl' : undefined,
        render: (x) => {
          const v = String(x.answers?.[q.id] ?? '')
          const flag = q.warnIf && v === q.warnIf.equals
          return <span className={`block max-w-[200px] truncate ${flag ? 'font-semibold text-bad' : 'text-body'}`} title={v}>{v ? (SHORT_VALUE[v] ?? v) : '—'}</span>
        },
      }),
    ),
    ...(selective
      ? [{ key: 'score', label: 'Score /20', numeric: true, value: (x: Entry) => x.score ?? '', render: (x: Entry) => (x.score != null ? <span className={`font-semibold ${x.score >= 16 ? 'text-good' : ''}`}>{x.score}</span> : <span className="text-xs text-warn">Unscored</span>) } as Column<Entry>]
      : []),
    {
      key: 'st',
      label: 'Status',
      render: (x) => (
        <select
          value={x.st}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setStatus([x.id], e.target.value)}
          aria-label={`Status for ${x.id}`}
          className="h-8 rounded-lg border border-line-strong bg-surface px-2 text-sm outline-none focus:border-brand-600"
        >
          {statuses.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Status counts double as a filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setOnly(null)} aria-pressed={!only} className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors duration-150 ease-out ${!only ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line-strong text-body hover:bg-canvas'}`}>
          All <span className="tabular-nums">{all.length}</span>
        </button>
        {statuses.map((st) => {
          const n = all.filter((x) => x.st === st).length
          return (
            <button key={st} type="button" onClick={() => setOnly(only === st ? null : st)} aria-pressed={only === st} className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors duration-150 ease-out ${only === st ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line-strong text-body hover:bg-canvas'}`}>
              {st} <span className="tabular-nums text-muted">{n}</span>
            </button>
          )
        })}
        {selective && <span className="ml-auto hidden text-xs text-muted sm:block">Scores are the reviewers’ average, out of 20</span>}
      </div>
      <DataTable
        title={`${session} · ${selective ? 'Applications' : 'Registrations'}`}
        rows={rows}
        columns={columns}
        rowKey={(x) => x.id}
        canSeeRestricted={showId}
        onRowClick={(x) => onOpenPerson?.(x.id)}
        searchPlaceholder={showId ? 'Search name, CHII ID or country' : 'Search CHII ID or country'}
        emptyIcon={Users}
        empty={{ title: only ? `No one is ${only.toLowerCase()} yet` : 'No registrations yet', body: 'Share the form link to start collecting responses.' }}
        rowActions={[
          ...(selective
            ? [
                { label: 'Select', icon: CheckCheck, onClick: (x: Entry) => setStatus([x.id], 'Selected') },
                { label: 'Not selected', icon: XCircle, onClick: (x: Entry) => setStatus([x.id], 'Not selected') },
                { label: 'Waitlist', icon: Users, onClick: (x: Entry) => setStatus([x.id], 'Waitlisted') },
              ]
            : [
                { label: 'Confirm', icon: CheckCheck, onClick: (x: Entry) => setStatus([x.id], 'Confirmed') },
                { label: 'Cancel registration', icon: XCircle, tone: 'bad' as const, onClick: (x: Entry) => setStatus([x.id], 'Cancelled') },
              ]),
          { label: 'Open person', icon: UserRound, onClick: (x: Entry) => onOpenPerson?.(x.id) },
        ]}
        mobileRow={(x) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{showId ? x.name : x.id}</div>
              <div className="mt-0.5 truncate text-xs text-muted">
                {x.st} · {x.country}
                {selective && ` · ${x.score != null ? `${x.score}/20` : 'unscored'}`}
              </div>
            </div>
          </div>
        )}
      />
    </div>
  )
}

/* ---------------- Attendance ---------------- */

function AttendanceTab({ sessionDates, sessionId, limit, log, role, intervention, onQr }: { sessionDates?: string[]; sessionId: string; limit?: number; log: Log; role: Role; intervention: string; onQr: () => void }) {
  // A created session takes attendance on its own dates; the sample sessions keep theirs.
  const dates = sessionDates?.length ? sessionDates.map((d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) : ['3 Nov', '10 Nov', '17 Nov', '24 Nov', '1 Dec', '15 Dec']
  const [day, setDay] = useState(sessionDates?.length ? 0 : 1)
  const showId = canSeeIdentity(role)
  const pool = participants.filter((x) => x.interventions.includes(intervention))
  const everyone = (pool.length >= 8 ? pool : participants.slice(0, 24)).slice(0, limit ?? undefined)
  // A new session starts with nobody marked; the sample sessions have earlier check-ins.
  const [byDay, setByDay] = useState<Record<number, Record<string, boolean>>>((): Record<number, Record<string, boolean>> =>
    sessionDates?.length
      ? {}
      : {
          0: Object.fromEntries(everyone.map((x, i) => [x.id, i % 6 !== 2])),
          1: Object.fromEntries(everyone.map((x, i) => [x.id, i % 4 !== 1])),
        },
  )
  const present = byDay[day] ?? {}
  const setPresent = (next: Record<string, boolean>) => setByDay((b) => ({ ...b, [day]: next }))
  const [walkIn, setWalkIn] = useState(false)
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'all' | 'present' | 'absent'>('all')
  const count = everyone.filter((x) => present[x.id]).length
  const rows = everyone.filter((x) => (show === 'all' || (show === 'present') === !!present[x.id]) && `${x.id} ${showId ? x.name : ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-4">
      <Modal
        open={walkIn}
        onClose={() => setWalkIn(false)}
        title="Add a walk-in"
        description="We'll match them to an existing CHII ID by email, student ID or phone, or create one."
        icon={<UserPlus className="h-4 w-4" />}
        size="sm"
        footer={
          <>
            <Button onClick={() => setWalkIn(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setWalkIn(false)}>
              Check in
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name">
            <input className={inputClass} placeholder="e.g. Ama Boateng" />
          </Field>
          <Field label="Email, student ID or phone">
            <input className={inputClass} placeholder="ama.b@alustudent.com" />
          </Field>
          <label className="flex items-start gap-2 text-sm text-body">
            <input type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 accent-brand" /> They consent to their data being recorded by CHII.
          </label>
        </div>
      </Modal>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1.5">
            {dates.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(i)}
                className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 ease-out ${
                  day === i ? 'border-brand-600 bg-brand-50 text-brand-600' : i > 1 ? 'border-line text-faint' : 'border-line-strong bg-surface text-body hover:bg-canvas'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 sm:flex-none" onClick={onQr}>
            <QrCode className="h-4 w-4" /> QR
          </Button>
          <Button variant="primary" className="flex-1 sm:flex-none" onClick={() => setWalkIn(true)}>
            <UserPlus className="h-4 w-4" /> Walk-in
          </Button>
        </div>
      </div>

      <Panel>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <span className="text-sm">
            <span className="font-semibold tabular-nums">{count}</span>
            <span className="text-muted"> of {everyone.length} checked in · {dates[day]}</span>
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-canvas sm:w-32">
            <div className="h-full rounded-full bg-good transition-[width] duration-200 ease-out" style={{ width: `${(count / (everyone.length || 1)) * 100}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:px-5">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={showId ? 'Search name or CHII ID' : 'Search CHII ID'} className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100" />
          </label>
          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="flex flex-1 gap-0.5 rounded-lg bg-canvas p-0.5 sm:flex-none">
              {(['all', 'present', 'absent'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setShow(k)} className={`h-8 flex-1 rounded-md px-3 text-xs font-medium capitalize transition-colors duration-150 ease-out ${show === k ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink'}`}>
                  {k}
                </button>
              ))}
            </div>
            <Button className="h-9 shrink-0 px-3 text-xs" onClick={() => (setPresent(Object.fromEntries(everyone.map((x) => [x.id, true]))), log('attendance_marked', `Marked all ${everyone.length} present · ${dates[day]}`), recordAttendance(sessionId, everyone.length), toast({ title: `All ${everyone.length} marked present`, body: dates[day], tone: 'good' }))}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all
            </Button>
          </div>
        </div>
        {rows.length === 0 && (
          <EmptyState
            compact
            icon={show === 'present' ? Users : Search}
            title={q ? `No one matches “${q}”` : show === 'present' ? `No check-ins yet for ${dates[day]}` : 'Everyone is checked in'}
            body={show === 'present' && !q ? 'Share the check-in QR, or tick people as they arrive.' : undefined}
            action={q || show !== 'all' ? { label: 'Show everyone', onClick: () => (setQ(''), setShow('all')) } : undefined}
          />
        )}
        <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
          {rows.map((x) => {
            const on = !!present[x.id]
            return (
              <li key={x.id}>
                <button type="button" onClick={() => setPresent({ ...present, [x.id]: !on })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-canvas sm:px-5">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-150 ease-out ${on ? 'border-good bg-good text-white' : 'border-line-strong'}`}>
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{showId ? x.name : x.id}</span>
                    {showId && <span className="block font-mono text-xs text-muted">{x.id}</span>}
                  </span>
                  <span className={`text-xs font-medium ${on ? 'text-good' : 'text-faint'}`}>{on ? '09:12' : 'Absent'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}

/* ---------------- Feedback ---------------- */

function FeedbackTab({ attended, feedback }: { attended: number; feedback: number }) {
  const dist = [
    { score: '1', n: 1 },
    { score: '2', n: 2 },
    { score: '3', n: 6 },
    { score: '4', n: 17 },
    { score: '5', n: 15 },
  ]
  const rate = attended ? Math.round((feedback / attended) * 100) : 0
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel className="p-4 sm:p-5">
        <PanelHeader title="Feedback summary" sub="Scores from this session's feedback form" className="-mx-4 -mt-4 mb-4 sm:-mx-5 sm:-mt-5" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          {[
            ['Response rate', `${rate}%`, rate < 40 ? 'text-warn' : ''],
            ['Satisfaction', '4.1/5', ''],
            ['Relevance', '4.3/5', ''],
            ['NPS', '+49', ''],
          ].map(([k, v, c]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold">Satisfaction scores</h3>
          <div className="-ml-4 mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} {...gridProps} />
                <XAxis dataKey="score" {...categoryAxisProps} />
                <YAxis {...valueAxisProps} width={32} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
                <Bar dataKey="n" name="Responses" fill="var(--color-navy)" radius={[4, 4, 0, 0]} barSize={30}>
                  <LabelList dataKey="n" position="top" {...valueLabelProps} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>
      <Panel>
        <h3 className="border-b border-line px-4 py-3 text-sm font-semibold sm:px-5">Latest comments</h3>
        <ul className="divide-y divide-line">
          {feedbackRows.slice(0, 5).map((f) => (
            <li key={f.id} className="px-4 py-3 sm:px-5">
              <p className="text-sm leading-6 text-body">“{f.comment}”</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                <span className="font-mono text-brand-600">{f.chiiId}</span> · {f.date} · {f.satisfaction}/5
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

/**
 * Feedback for a cohort whose survey has its own template (e.g. SIE Kenya 2026): the average of
 * each rating question, the spread of the overall rating, and the written answers. Anonymous
 * surveys show participant codes, never CHII IDs or names.
 */
function TemplateFeedbackTab({ template, attended, feedback, cohort, intervention }: { template: FormTemplate; attended: number; feedback: number; cohort: string; intervention: string }) {
  const responses = React.useMemo(() => sampleResponses(template, feedback, cohort), [template, feedback, cohort])
  const scales = template.questions.filter((q) => q.type === 'scale')
  const texts = template.questions.filter((q) => q.type === 'textarea')
  const [textQ, setTextQ] = useState(texts[texts.length - 2]?.id ?? texts[0]?.id)
  const rate = attended ? Math.round((feedback / attended) * 100) : 0
  const avg = (id: string) => {
    const xs = responses.map((r) => Number(r[id])).filter((n) => n > 0)
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null
  }
  const overall = scales.find((q) => /overall/.test(q.id)) ?? scales[scales.length - 1]
  const dist = overall
    ? Array.from({ length: overall.scale!.max - overall.scale!.min + 1 }, (_, k) => {
        const v = overall.scale!.min + k
        return { score: overall.scale!.labels?.[k] ? `${v} · ${overall.scale!.labels[k]}` : String(v), n: responses.filter((r) => Number(r[overall.id]) === v).length }
      })
    : []
  const anonymous = !template.questions.some((q) => q.type === 'email')
  const codeQ = template.questions.find((q) => q.pattern)
  // Named surveys show the respondent's CHII ID (never a name); anonymous ones their participant code.
  const pool = participants.filter((x) => x.interventions.includes(intervention))
  const whoOf = (r: Answers, i: number) => (codeQ ? String(r[codeQ.id]) : (pool[i % Math.max(pool.length, 1)]?.id ?? `Response ${i + 1}`))
  const answers = responses.map((r, i) => ({ who: whoOf(r, i), text: String(r[textQ] ?? '') })).filter((x) => x.text)
  // Choice questions (which session, opportunities, skills…): how many picked each option.
  const choices = template.questions.filter((q) => (q.type === 'radio' || q.type === 'select' || q.type === 'checkboxes') && !q.identity && !q.sensitive)

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel className="p-4 sm:p-5">
        <PanelHeader title="Feedback summary" sub={`${template.title} (v${template.version}) · ${feedback} responses`} className="-mx-4 -mt-4 mb-4 sm:-mx-5 sm:-mt-5" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Responses</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{feedback}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Response rate</dt>
            <dd className={`mt-1 text-xl font-semibold tabular-nums ${rate < 40 ? 'text-warn' : ''}`}>{rate}%</dd>
          </div>
          {overall && (
            <div>
              <dt className="text-xs text-muted">Overall rating</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {avg(overall.id) ?? '—'}/{overall.scale!.max}
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold">Average rating per question</h3>
          <ul className="mt-3 space-y-3">
            {scales.map((q) => {
              const a = avg(q.id)
              return (
                <li key={q.id}>
                  <div className="flex items-start justify-between gap-3 text-[13px]">
                    <span className="text-body">{q.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink">{a ?? '—'}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-canvas">
                    <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${a ? ((a - q.scale!.min) / (q.scale!.max - q.scale!.min)) * 100 : 0}%` }} />
                  </div>
                  <div className="mt-0.5 flex justify-between text-[10.5px] text-faint">
                    <span>{q.scale!.minLabel}</span>
                    <span>{q.scale!.maxLabel}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
        {choices.map((q) => {
          const asked = responses.filter((r) => r[q.id] != null && r[q.id] !== '')
          const counts = q.options!.map((o) => ({ o, n: asked.filter((r) => (Array.isArray(r[q.id]) ? (r[q.id] as string[]).includes(o) : r[q.id] === o)).length }))
          const top = Math.max(1, ...counts.map((c) => c.n))
          return (
            <div key={q.id} className="mt-5 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">{q.label}</h3>
              <p className="text-xs text-muted">
                {asked.length} answered{q.type === 'checkboxes' ? ' · could pick more than one' : ''}
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {counts.map((c) => (
                  <li key={c.o} className="grid grid-cols-[minmax(0,1fr)_120px_32px] items-center gap-2 text-[13px]">
                    <span className="truncate text-body" title={c.o}>
                      {c.o}
                    </span>
                    <span className="h-1.5 rounded-full bg-canvas">
                      <span className="block h-1.5 rounded-full bg-brand-600" style={{ width: `${(c.n / top) * 100}%` }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums text-ink">{c.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        {overall && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="text-sm font-semibold">{overall.label}</h3>
            <div className="-ml-4 mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dist} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...gridProps} />
                  <XAxis dataKey="score" {...categoryAxisProps} tick={{ fontSize: 10, fill: 'var(--color-muted)' }} interval={0} />
                  <YAxis {...valueAxisProps} width={32} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
                  <Bar dataKey="n" name="Responses" fill="var(--color-navy)" radius={[4, 4, 0, 0]} barSize={30}>
                    <LabelList dataKey="n" position="top" {...valueLabelProps} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Panel>
      <Panel>
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold">Written answers</h3>
          <select value={textQ} onChange={(e) => setTextQ(e.target.value)} aria-label="Question" className="h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-brand-600">
            {texts.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
        <ul className="max-h-[640px] divide-y divide-line overflow-y-auto">
          {answers.slice(0, 25).map((x, i) => (
            <li key={i} className="px-4 py-3 sm:px-5">
              <p className="text-sm leading-6 text-body">“{x.text}”</p>
              <div className="mt-1 font-mono text-xs text-brand-600">{x.who}</div>
            </li>
          ))}
        </ul>
        {anonymous && <p className="border-t border-line px-4 py-2.5 text-xs text-faint sm:px-5">Anonymous survey: answers show participant codes, not CHII IDs or names.</p>}
      </Panel>
    </div>
  )
}

/* ---------------- Details ---------------- */

/**
 * A session's details. Sessions created here can be renamed, moved to another intervention (if
 * they were started under the wrong one), re-dated and deleted; the sample sessions are read-only.
 */
function DetailsTab({ s, log, onDeleted }: { s: SessionRun; log: Log; onDeleted?: () => void }) {
  const editable = !!s.created
  const options = interventions.filter((i) => i.pillar === s.pillar)
  const current = interventions.find((i) => i.name === s.intervention)
  const [name, setName] = useState(s.name)
  const [ivId, setIvId] = useState(current?.id ?? '')
  const [start, setStart] = useState(s.startDate ?? '2025-11-03')
  const [end, setEnd] = useState(s.endDate ?? '2025-12-15')
  const [venue, setVenue] = useState(s.venue ?? 'ALU Kigali campus · Room 4')
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')
  const moved = editable && ivId !== current?.id
  const dirty = editable && (moved || name !== s.name || start !== s.startDate || end !== s.endDate || venue !== (s.venue ?? ''))

  const save = () => {
    const dates = s.dateList && s.dateList.length > 2 && start === s.startDate && end === s.endDate ? s.dateList : [start, end].filter((d, k, a) => d && a.indexOf(d) === k)
    const next = updateSession(s.id, { name, interventionId: moved ? ivId : undefined, dates, venue })
    log('session_changed', moved ? `Moved ${next.name} from ${current?.name} to ${next.intervention}; its forms now use ${next.intervention}’s templates` : `Changed the details of ${next.name}`)
    toast({ title: moved ? `Moved to ${next.intervention}` : 'Session saved', body: next.name, tone: 'good' })
  }
  const remove = () => {
    deleteSession(s.id)
    log('session_deleted', `Deleted ${s.name}`)
    toast({ title: 'Session deleted', body: s.name, tone: 'info' })
    setConfirm(false)
    onDeleted?.()
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel className="p-4 sm:p-5">
        {!editable && <p className="mb-4 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">This is a sample session, so its details can’t be changed in the prototype. Sessions you create can be edited here.</p>}
        <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Session name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Intervention">
              <select value={ivId} onChange={(e) => setIvId(e.target.value)} className={inputClass}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.pillar} · {o.name}
                  </option>
                ))}
              </select>
            </Field>
            {moved && (
              <p className="mt-1.5 rounded-md bg-warn-bg px-2.5 py-1.5 text-xs text-warn">
                It will move to {options.find((o) => o.id === ivId)?.name}, and its forms will use that intervention’s templates.
              </p>
            )}
          </div>
          <Field label="Start date">
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
          </Field>
          <Field label="End date">
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Venue">
            <input value={venue} onChange={(e) => setVenue(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Completion threshold">
            <select defaultValue="75" className={inputClass}>
              <option value="50">50% of dates</option>
              <option value="75">75% of dates</option>
              <option value="100">All dates</option>
            </select>
          </Field>
        </fieldset>
        {editable && (
          <div className="mt-5 flex justify-end border-t border-line pt-4">
            <Button variant="primary" onClick={() => dirty && save()} className={dirty ? '' : 'pointer-events-none opacity-50'}>
              {moved ? 'Move and save' : 'Save changes'}
            </Button>
          </div>
        )}
      </Panel>
      <Panel className="self-start border-bad/30 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-bad">Delete session</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{editable ? 'Removes its forms and check-ins. People keep their CHII IDs and other sessions.' : 'Sample sessions can’t be deleted in the prototype.'}</p>
        <Button className={`mt-4 w-full text-bad ${editable ? '' : 'pointer-events-none opacity-50'}`} onClick={() => editable && setConfirm(true)}>
          <Trash2 className="h-4 w-4" /> Delete session
        </Button>
      </Panel>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this session?"
        description="This can't be undone."
        size="sm"
        icon={<Trash2 className="h-4 w-4" />}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <button type="button" disabled={typed !== 'DELETE'} onClick={remove} className="h-9 rounded-lg bg-bad px-4 text-sm font-semibold text-white disabled:opacity-40">
              Delete session
            </button>
          </>
        }
      >
        <Field label="Type DELETE to confirm">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} placeholder="DELETE" />
        </Field>
      </Modal>
    </div>
  )
}

