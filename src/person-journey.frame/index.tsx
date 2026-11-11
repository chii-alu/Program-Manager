import React, { useState } from 'react'
import { Modal } from '../shared/components/Modal'
import { ExportModal } from '../shared/components/ExportModal'
import { ArrowLeft, Check, Copy, Download, EyeOff, Lock, MessageSquareText, UserX } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, Panel, PillarTag } from '../shared/components/ui'
import { JourneyStep, Portal, Role, canSeeIdentity, feedbackGiven, journey, participants, portalMeta } from '../shared/data/mela'

export const args = {
  role: 'admin',
  portal: 'admin',
  chiiId: 'CHII-000214',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onBack?: () => void
}

export default function Person(props: Props) {
  const { role: r, portal: p, chiiId, onNavigate, onPortalChange, onSignOut, onBack } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const person = participants.find((x) => x.id === chiiId) ?? participants[0]
  const showId = canSeeIdentity(role)
  const completed = journey.filter((j) => j.status === 'Completed').length
  const finished = journey.filter((j) => j.status === 'Completed' || j.status === 'Not completed').length
  const [exporting, setExporting] = useState(false)
  const [anon, setAnon] = useState(false)
  const [anonymised, setAnonymised] = useState(false)

  return (
    <AppShell role={role} portal={portal} active="participants" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <ExportModal
        open={exporting}
        onClose={() => setExporting(false)}
        title={`${person.id} journey`}
        columns={[
          { key: 'chiiId', label: 'CHII ID' },
          { key: 'name', label: 'Name', restricted: true },
          { key: 'session', label: 'Session' },
          { key: 'intervention', label: 'Intervention' },
          { key: 'pillar', label: 'Pillar' },
          { key: 'dates', label: 'Dates' },
          { key: 'status', label: 'Status' },
          { key: 'attendance', label: 'Attendance' },
          { key: 'feedback', label: 'Feedback given' },
        ]}
        rows={journey.map((j) => ({ ...j, chiiId: person.id, name: person.name, feedback: j.feedback ? 'Yes' : 'No' }))}
        canSeeRestricted={showId}
      />
      <Modal
        open={anon}
        onClose={() => setAnon(false)}
        title="Anonymise this person?"
        description="Use only on a data-deletion request. This can't be undone."
        size="sm"
        icon={<UserX className="h-4 w-4" />}
        footer={
          <>
            <Button onClick={() => setAnon(false)}>Cancel</Button>
            <button type="button" onClick={() => (setAnonymised(true), setAnon(false))} className="h-9 rounded-lg bg-bad px-4 text-sm font-semibold text-white">
              Anonymise
            </button>
          </>
        }
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-body">
          <li>Name, email, phone and student ID are erased.</li>
          <li>The CHII ID, attendance and scores stay, so aggregate counts don't change.</li>
          <li>The action is recorded with your name.</li>
        </ul>
      </Modal>
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-5">
        {anonymised && (
          <div className="mb-4 rounded-lg border border-warn/20 bg-warn-bg px-3.5 py-2.5 text-sm text-warn">This person was anonymised. Their identity fields are now empty.</div>
        )}
        <button type="button" onClick={onBack} className="-ml-1 flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> CHII Participants
        </button>

        {/* Identity header */}
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-semibold text-brand sm:h-14 sm:w-14 sm:text-lg">
              {showId ? person.name.split(' ').map((n) => n[0]).join('').slice(0, 2) : <EyeOff className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{showId ? person.name : 'Identity restricted'}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <button type="button" className="inline-flex items-center gap-1 font-mono text-[13px] font-medium text-brand-600 hover:underline" title="Copy CHII ID">
                  {person.id} <Copy className="h-3 w-3" />
                </button>
                <span className="text-faint">·</span>
                <span className="flex gap-1">
                  {person.pillars.map((pl) => (
                    <PillarTag key={pl} pillar={pl} />
                  ))}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 sm:flex-none" onClick={() => setExporting(true)}>
              <Download className="h-4 w-4" /> Export
            </Button>
            {role === 'admin' && !anonymised && (
              <Button className="flex-1 text-bad sm:flex-none" onClick={() => setAnon(true)}>
                <UserX className="h-4 w-4" /> Anonymise
              </Button>
            )}
          </div>
        </div>

        {/* Summary line, not tiles */}
        <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-4">
          {[
            ['Interventions', person.interventions.length + 1],
            ['Sessions', journey.length],
            ['Completed', `${completed} of ${finished}`],
            ['Feedback given', feedbackGiven.length],
          ].map(([k, v], i) => (
            <div
              key={k as string}
              className={`px-4 py-3 sm:px-5 ${i % 2 === 1 ? 'border-l border-line' : ''} ${i > 1 ? 'border-t border-line sm:border-t-0 sm:border-l' : ''}`}
            >
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Profile */}
          <Panel className="lg:self-start">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold sm:px-5">Profile</h2>
            <dl className="divide-y divide-line text-sm">
              <Field label="Email" value={person.email} restricted={!showId} />
              <Field label="Phone" value="+234 803 555 0142" restricted={!showId} />
              <Field label="Student ID" value="ALU-2022-0871" restricted={role !== 'admin'} />
              <Field label="Standing" value="Good standing" restricted={role !== 'admin'} />
              <Field label="Gender" value={person.gender === 'F' ? 'Female' : 'Male'} />
              <Field label="Age" value={String(person.age)} />
              <Field label="Country" value={person.country} />
              <Field label="First seen" value="14 Aug 2025 · Masterclass" />
              <Field label="Consent" value="Given · 14 Aug 2025" />
            </dl>
            {role !== 'admin' && (
              <p className="flex gap-2 border-t border-line px-4 py-3 text-xs leading-5 text-muted sm:px-5">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Student ID and standing are visible to MELA admins only.
              </p>
            )}
          </Panel>

          <div className="min-w-0 space-y-5">
            {/* Journey */}
            <Panel>
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold">Journey across interventions</h2>
                <span className="text-xs text-muted">Newest first</span>
              </div>
              <ol className="relative px-4 py-2 sm:px-5">
                {journey.map((j, i) => (
                  <JourneyRow key={j.session} step={j} last={i === journey.length - 1} />
                ))}
              </ol>
            </Panel>

            {/* Feedback */}
            <Panel>
              <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold sm:px-5">
                <MessageSquareText className="h-4 w-4 text-muted" /> Feedback given
              </h2>
              <ul className="divide-y divide-line">
                {feedbackGiven.map((f) => (
                  <li key={f.session} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{f.session}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <PillarTag pillar={f.pillar} /> {f.date}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs sm:flex sm:gap-5">
                      <Score label="Satisfaction" value={`${f.satisfaction}/5`} />
                      <Score label="Relevance" value={`${f.relevance}/5`} />
                      <Score label="NPS" value={String(f.nps)} />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
        <p className="mt-6 text-xs text-faint">Viewing in {portalMeta[portal].label} portal. Opening this page is not logged; exports are.</p>
      </div>
    </AppShell>
  )
}

function Field({ label, value, restricted }: { label: string; value: string; restricted?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-4 py-2.5 sm:px-5">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium lg:text-left">
        {restricted ? (
          <span className="inline-flex items-center gap-1 text-faint">
            <Lock className="h-3 w-3" /> Restricted
          </span>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

const statusTone: Record<JourneyStep['status'], string> = {
  Completed: 'bg-good-bg text-good',
  'In progress': 'bg-brand-50 text-brand-600',
  Selected: 'bg-brand-50 text-brand-600',
  Registered: 'bg-canvas text-muted',
  'Not completed': 'bg-bad-bg text-bad',
}

const JourneyRow: React.FC<{ step: JourneyStep; last: boolean }> = ({ step, last }) => {
  const dot = step.status === 'Completed' ? 'bg-good' : step.status === 'Not completed' ? 'bg-bad' : step.status === 'Registered' ? 'bg-line-strong' : 'bg-brand-600'
  return (
    <li className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-3 py-3">
      {!last && <span className="absolute bottom-0 left-[7px] top-[26px] w-px bg-line" />}
      <span className={`relative mt-1.5 h-[9px] w-[9px] justify-self-center rounded-full ring-4 ring-surface ${dot}`} />
      <div className="min-w-0">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{step.session}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <PillarTag pillar={step.pillar} /> {step.dates}
            </div>
          </div>
          <span className={`inline-flex h-6 w-fit shrink-0 items-center whitespace-nowrap rounded-full px-2 text-xs font-medium ${statusTone[step.status]}`}>
            {step.status}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-body">
          <span>
            <span className="text-muted">Attendance </span>
            {step.attendance}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-muted">Feedback </span>
            {step.feedback ? (
              <>
                <Check className="h-3.5 w-3.5 text-good" /> Given
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>
    </li>
  )
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:text-right">
      <div className="text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}
