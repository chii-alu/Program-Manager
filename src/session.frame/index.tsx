import React, { useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink, Eye, Link2, QrCode, Search, Trash2, UserPlus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AppShell } from '../shared/components/AppShell'
import { Button, Panel, PanelHeader, PillarTag, StatusBadge } from '../shared/components/ui'
import { Modal } from '../shared/components/Modal'
import { Field, inputClass } from '../shared/components/NewSessionModal'
import { ChartTooltip, axisProps, gridProps, valueAxisProps, categoryAxisProps, valueLabelProps } from '../shared/components/charts'
import { QrMark } from '../shared/components/QrMark'
import { Participant, Portal, Role, canSeeIdentity, feedbackRows, participants, sessions } from '../shared/data/mela'
import { Column, DataTable } from '../shared/components/DataTable'
import { EmptyState } from '../shared/components/EmptyState'
import { notify, toast } from '../shared/lib/notify'
import { CheckCheck, UserRound, Users, XCircle } from 'lucide-react'

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
  onOpenForm?: () => void
}

const tabs = ['forms', 'people', 'attendance', 'feedback', 'details'] as const

export default function Session(props: Props) {
  const { role: r, portal: p, sessionId, tab: initialTab, onNavigate, onPortalChange, onSignOut, onBack, onOpenPerson, onOpenForm } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const s = sessions.find((x) => x.id === sessionId) ?? sessions[1]
  const [tab, setTab] = useState(initialTab)
  const [share, setShare] = useState<string | null>(null)

  return (
    <AppShell role={role} portal={portal} active="interventions" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <ShareModal form={share} onClose={() => setShare(null)} />
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
          {tab === 'forms' && <FormsTab kind={s.kind} registered={s.registered} attended={s.attended} feedback={s.feedback} onPreview={onOpenForm} onShare={setShare} />}
          {tab === 'people' && <PeopleTab role={role} selective={s.kind === 'selective'} intervention={s.intervention} session={s.name} onOpenPerson={onOpenPerson} />}
          {tab === 'attendance' && <AttendanceTab role={role} intervention={s.intervention} onQr={() => setShare('Attendance check-in')} />}
          {tab === 'feedback' && <FeedbackTab attended={s.attended} feedback={s.feedback} />}
          {tab === 'details' && <DetailsTab name={s.name} onDeleted={onBack} />}
        </div>
      </div>
    </AppShell>
  )
}

/* ---------------- Forms ---------------- */

function FormsTab({ kind, registered, attended, feedback, onPreview, onShare }: { kind: string; registered: number; attended: number; feedback: number; onPreview?: () => void; onShare: (f: string) => void }) {
  const [status, setStatus] = useState<Record<string, string>>({ a: 'open', b: 'open', c: 'draft' })
  const forms = [
    { id: 'a', name: kind === 'selective' ? 'Application' : 'Registration', code: 'SIE4-REG', responses: registered, questions: 14 },
    { id: 'b', name: 'Attendance check-in', code: 'SIE4-ATT', responses: attended, questions: 3 },
    { id: 'c', name: 'Feedback', code: 'SIE4-FBK', responses: feedback, questions: 11 },
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
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-0.5 rounded-lg bg-canvas p-0.5">
                {['draft', 'open', 'closed'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus({ ...status, [f.id]: st })}
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
              <Button className="h-8 px-3 text-xs" onClick={onPreview}>
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

function ShareModal({ form, onClose }: { form: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = `mela.chii.alu.edu/f/${form === 'Attendance check-in' ? 'SIE4-ATT' : form === 'Feedback' ? 'SIE4-FBK' : 'SIE4-REG'}`
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

type Entry = Participant & { score: number | null; submitted: string; st: string }

function PeopleTab({ role, selective, intervention, session, onOpenPerson }: { role: Role; selective: boolean; intervention: string; session: string; onOpenPerson?: (id: string) => void }) {
  const showId = canSeeIdentity(role)
  const statuses = selective ? ['Applied', 'Selected', 'Waitlisted', 'Not selected'] : ['Registered', 'Confirmed', 'Cancelled']
  const [state, setState] = useState<Record<string, string>>({})
  const [only, setOnly] = useState<string | null>(null)
  const pool = participants.filter((x) => x.interventions.includes(intervention))
  const base = (pool.length >= 8 ? pool : participants.slice(0, 24)).map((x, i) => {
    const score = selective ? ((i * 7) % 5 === 0 ? null : 9 + ((i * 13) % 12)) : null
    return { ...x, score, submitted: x.joined, def: selective ? (score != null && score >= 16 ? 'Selected' : 'Applied') : i % 9 === 4 ? 'Cancelled' : i % 3 === 0 ? 'Confirmed' : 'Registered' }
  })
  const all: Entry[] = base.map((x) => ({ ...x, st: state[x.id] ?? x.def }))
  const rows = only ? all.filter((x) => x.st === only) : all
  const setStatus = (ids: string[], st: string) => {
    setState((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, st])) }))
    toast({ title: `${ids.length === 1 ? (showId ? all.find((x) => x.id === ids[0])?.name : ids[0]) : `${ids.length} people`} → ${st}`, tone: st === 'Selected' || st === 'Confirmed' ? 'good' : 'info' })
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

function AttendanceTab({ role, intervention, onQr }: { role: Role; intervention: string; onQr: () => void }) {
  const dates = ['3 Nov', '10 Nov', '17 Nov', '24 Nov', '1 Dec', '15 Dec']
  const [day, setDay] = useState(1)
  const showId = canSeeIdentity(role)
  const pool = participants.filter((x) => x.interventions.includes(intervention))
  const everyone = pool.length >= 8 ? pool : participants.slice(0, 24)
  const [byDay, setByDay] = useState<Record<number, Record<string, boolean>>>(() => ({
    0: Object.fromEntries(everyone.map((x, i) => [x.id, i % 6 !== 2])),
    1: Object.fromEntries(everyone.map((x, i) => [x.id, i % 4 !== 1])),
  }))
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
            <Button className="h-9 shrink-0 px-3 text-xs" onClick={() => (setPresent(Object.fromEntries(everyone.map((x) => [x.id, true]))), toast({ title: `All ${everyone.length} marked present`, body: dates[day], tone: 'good' }))}>
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

/* ---------------- Details ---------------- */

function DetailsTab({ name, onDeleted }: { name: string; onDeleted?: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Session name">
              <input defaultValue={name} className={inputClass} />
            </Field>
          </div>
          <Field label="Start date">
            <input type="date" defaultValue="2025-11-03" className={inputClass} />
          </Field>
          <Field label="End date">
            <input type="date" defaultValue="2025-12-15" className={inputClass} />
          </Field>
          <Field label="Venue">
            <input defaultValue="ALU Kigali campus · Room 4" className={inputClass} />
          </Field>
          <Field label="Completion threshold">
            <select defaultValue="75" className={inputClass}>
              <option value="50">50% of dates</option>
              <option value="75">75% of dates</option>
              <option value="100">All dates</option>
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end border-t border-line pt-4">
          <Button variant="primary">Save changes</Button>
        </div>
      </Panel>
      <Panel className="self-start border-bad/30 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-bad">Delete session</h3>
        <p className="mt-1 text-sm leading-6 text-muted">Removes its forms and check-ins. People keep their CHII IDs and other sessions.</p>
        <Button className="mt-4 w-full text-bad" onClick={() => setConfirm(true)}>
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
            <button
              type="button"
              disabled={typed !== 'DELETE'}
              onClick={() => (setConfirm(false), onDeleted?.())}
              className="h-9 rounded-lg bg-bad px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
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

