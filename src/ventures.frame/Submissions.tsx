/**
 * Ventures registered through the public form (on the Registry page): waiting for staff, accepted,
 * declined, and the activity log. Accepting one creates the venture, with founders matched to
 * (or given) CHII IDs.
 */
import React, { useMemo, useState } from 'react'
import { AlertTriangle, Check, Inbox, Link2, UserPlus, X } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { Button, Panel } from '../shared/components/ui'
import { toast } from '../shared/lib/notify'
import { countryName, TRACKS } from '../shared/ventures/lists'
import { personById, resolveBeneficiary } from '../shared/ventures/people'
import { similar } from '../shared/ventures/quality'
import { VentureValidationError, acceptSubmission, rejectSubmission } from '../shared/ventures/store'
import type { RegistryData, VentureSubmission } from '../shared/ventures/types'
import { Field, fmtDate, inputCls, money, StagePill } from './parts'
import { ActivityLog } from './ActivityLog'
import { toUsd } from '../shared/ventures/lists'

type Tab = 'waiting' | 'accepted' | 'declined' | 'log'

/**
 * Registrations through the public form: the ones waiting for review, the ones accepted (with
 * the Venture ID they became) and declined (with the reason), and the log of who did what.
 */
export function SubmissionsPanel({ data, me, showIdentity, onOpen }: { data: RegistryData; me: string; showIdentity: boolean; onOpen: (id: string) => void }) {
  const all = [...(data.submissions ?? [])].sort((a, b) => (b.reviewedAt ?? b.receivedAt).localeCompare(a.reviewedAt ?? a.receivedAt))
  const pending = all.filter((s) => s.status === 'pending')
  const accepted = all.filter((s) => s.status === 'accepted')
  const declined = all.filter((s) => s.status === 'rejected')
  const [tab, setTab] = useState<Tab>(pending.length ? 'waiting' : 'log')
  const [review, setReview] = useState<VentureSubmission | null>(null)
  const code = (id?: string) => data.ventures.find((v) => v.id === id)?.code
  const day = (iso?: string) => (iso ? fmtDate(iso) : '—')

  const tabs: [Tab, string, number | null][] = [
    ['waiting', 'Waiting for review', pending.length],
    ['accepted', 'Accepted', accepted.length],
    ['declined', 'Declined', declined.length],
    ['log', 'Activity log', null],
  ]

  return (
    <Panel
      title="Registrations"
      sub={pending.length ? `${pending.length} venture${pending.length === 1 ? '' : 's'} registered through the form ${pending.length === 1 ? 'is' : 'are'} waiting for review.` : 'Ventures registered through the public form, and what happened to them.'}
      accentBorder={pending.length > 0}
    >
      <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3">
        {tabs.map(([k, label, n]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`relative flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] font-medium ${tab === k ? 'text-ink' : 'text-muted hover:text-ink'}`}
          >
            {label}
            {n != null && <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${tab === k ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-muted'}`}>{n}</span>}
            {tab === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
          </button>
        ))}
      </div>

      {tab === 'waiting' &&
        (pending.length ? (
          <ul className="divide-y divide-line">
            {pending.map((s) => {
              const dup = duplicates(data, s)
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Inbox className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {s.name} <StagePill stage={s.stage} />
                    </span>
                    <span className="block text-xs text-muted">
                      {s.healthSector} · {s.countries.map(countryName).join(', ')} · {showIdentity ? `${s.founders[0]?.name} · ` : ''}received {day(s.receivedAt)}
                      {dup.length > 0 && <span className="font-semibold text-warn"> · possible duplicate</span>}
                    </span>
                  </span>
                  <Button variant="primary" onClick={() => setReview(s)}>
                    Review
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>Nothing is waiting. New registrations from the form appear here.</Empty>
        ))}

      {tab === 'accepted' &&
        (accepted.length ? (
          <ul className="divide-y divide-line">
            {accepted.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Check className="h-4 w-4 shrink-0 text-good" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{s.name}</span>
                  <span className="block text-xs text-muted">
                    Received {day(s.receivedAt)} · accepted {day(s.reviewedAt)} by <b className="font-semibold text-body">{s.reviewedBy ?? 'unknown'}</b>
                  </span>
                </span>
                {code(s.ventureId) && (
                  <Button onClick={() => onOpen(s.ventureId!)}>
                    <span className="font-mono text-xs">{code(s.ventureId)}</span> Open
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No registrations accepted yet.</Empty>
        ))}

      {tab === 'declined' &&
        (declined.length ? (
          <ul className="divide-y divide-line">
            {declined.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{s.name}</span>
                  <span className="block text-xs text-muted">
                    Received {day(s.receivedAt)} · declined {day(s.reviewedAt)} by <b className="font-semibold text-body">{s.reviewedBy ?? 'unknown'}</b>
                  </span>
                  {s.rejectReason && <span className="mt-1 block rounded-md bg-canvas px-2 py-1 text-xs text-body">“{s.rejectReason}”</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No registrations declined.</Empty>
        ))}

      {tab === 'log' && (
        <ActivityLog
          data={data}
          area="registrations"
          onOpen={onOpen}
          filters={[
            { key: 'received', label: 'Received', actions: ['registration_received'] },
            { key: 'accepted', label: 'Accepted', actions: ['registration_accepted'] },
            { key: 'declined', label: 'Declined', actions: ['registration_declined'] },
            { key: 'form', label: 'Form opened / closed', actions: ['form_opened', 'form_closed'] },
          ]}
        />
      )}

      {review && <ReviewModal data={data} s={review} me={me} showIdentity={showIdentity} onClose={() => setReview(null)} onOpen={onOpen} />}
    </Panel>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-4 py-5 text-sm text-muted">{children}</p>

function duplicates(d: RegistryData, s: VentureSubmission) {
  const prim = new Map(d.countries.filter((c) => c.isPrimary).map((c) => [c.ventureId, c.countryCode]))
  return d.ventures.filter((v) => v.name.trim().toLowerCase() === s.name.trim().toLowerCase() || (prim.get(v.id) === s.countries[0] && similar(v.name, s.name)))
}

function ReviewModal({ data, s, me, showIdentity, onClose, onOpen }: { data: RegistryData; s: VentureSubmission; me: string; showIdentity: boolean; onClose: () => void; onOpen: (id: string) => void }) {
  const [intakeYear, setIntakeYear] = useState(Number(s.receivedAt.slice(0, 4)) > 2025 ? 2025 : Number(s.receivedAt.slice(0, 4)))
  const [track, setTrack] = useState(TRACKS[0])
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const dup = duplicates(data, s)
  const matches = useMemo(() => s.founders.map((f) => resolveBeneficiary(f, { create: false })), [s])

  const accept = () => {
    try {
      const v = acceptSubmission(s.id, { intakeYear, track }, me)
      toast({ title: `${v.code} added to the registry`, body: s.name, tone: 'good' })
      onClose()
      onOpen(v.id)
    } catch (e) {
      if (e instanceof VentureValidationError) setErrors(e.messages)
      else throw e
    }
  }
  const reject = () => {
    if (!reason.trim()) return setErrors(['Say why, so the team knows later.'])
    rejectSubmission(s.id, reason.trim(), me)
    toast({ title: 'Registration declined', body: s.name, tone: 'info' })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Review: ${s.name}`}
      description="Check the details, then add it to the registry. Founders are matched to existing CHII IDs by email."
      footer={
        rejecting ? (
          <>
            <Button onClick={() => setRejecting(false)}>Back</Button>
            <Button onClick={reject} className="border-bad/40 text-bad">
              <X className="h-4 w-4" /> Decline registration
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setRejecting(true)}>Decline…</Button>
            <Button variant="primary" onClick={accept}>
              <Check className="h-4 w-4" /> Add to registry
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-sm">
        {errors.length > 0 && (
          <div role="alert" className="rounded-lg border border-bad/30 bg-bad-bg px-3 py-2 text-bad">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        {dup.length > 0 && (
          <p className="flex gap-2 rounded-lg border border-warn/30 bg-warn-bg px-3 py-2 text-warn">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Looks like {dup.map((v) => `${v.name} (${v.code})`).join(', ')} already in the registry. If it’s the same venture, decline this and record an update there instead.
            </span>
          </p>
        )}
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {(
            [
              ['What it does', s.description],
              ['Countries', s.countries.map(countryName).join(', ')],
              ['Health sector', s.healthSector],
              ['Stage', s.stage],
              ['Year founded', String(s.yearFounded)],
              ['Came to CHII through', s.source],
              ['Institution', s.institution],
              ['Legal status', s.legalStatus],
              ['Jobs (women / PWD / displaced)', `${s.jobsTotal} (${s.jobsWomen} / ${s.jobsPwd} / ${s.jobsDisplaced})`],
              ['Funding raised', `${s.fundingCurrency} ${s.fundingAmount.toLocaleString()} (${money(toUsd(s.fundingAmount, s.fundingCurrency))})`],
              ['Revenue, last 12 months', s.revenueAmount == null ? 'Not given' : `${s.revenueCurrency} ${s.revenueAmount.toLocaleString()}`],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.06em] text-muted">Founders</p>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {s.founders.map((f, i) => (
              <li key={f.email} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{showIdentity ? f.name : `Founder ${i + 1}`}</span>
                  <span className="ml-1.5 text-xs text-muted">{i === 0 ? 'Lead founder' : 'Co-founder'}</span>
                  {showIdentity && <span className="block text-xs text-muted">{f.email}</span>}
                </span>
                {matches[i].chiiId ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-good">
                    <Link2 className="h-3.5 w-3.5" /> Matches {showIdentity ? personById(matches[i].chiiId)?.name : 'an existing person'} ({matches[i].chiiId})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <UserPlus className="h-3.5 w-3.5" /> New CHII ID
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        {rejecting ? (
          <Field label="Why is it declined?" hint="Kept with the registration.">
            <textarea className={`${inputCls} h-20 py-2`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not a health venture; duplicate of VEN-0015" />
          </Field>
        ) : (
          <div className="grid gap-3 rounded-lg bg-canvas p-3 sm:grid-cols-2">
            <Field label="Intake year" hint="The year it joins the CHII portfolio.">
              <input type="number" className={inputCls} value={intakeYear} min={2015} max={2025} onChange={(e) => setIntakeYear(Number(e.target.value))} />
            </Field>
            <Field label="Track">
              <select className={inputCls} value={track} onChange={(e) => setTrack(e.target.value)}>
                {TRACKS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}
