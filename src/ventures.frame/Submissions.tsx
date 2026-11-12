/**
 * Ventures registered through the public form, waiting for staff (on the Registry page).
 * Accepting one creates the venture, with founders matched to (or given) CHII IDs.
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
import { Field, inputCls, money, StagePill } from './parts'
import { toUsd } from '../shared/ventures/lists'

export function SubmissionsPanel({ data, me, showIdentity, onOpen }: { data: RegistryData; me: string; showIdentity: boolean; onOpen: (id: string) => void }) {
  const pending = (data.submissions ?? []).filter((s) => s.status === 'pending').sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  const [review, setReview] = useState<VentureSubmission | null>(null)
  if (!pending.length) return null
  return (
    <Panel title="Registered through the form" sub={`${pending.length} venture${pending.length === 1 ? '' : 's'} waiting for review. They join the registry once accepted.`} accentBorder>
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
                  {s.healthSector} · {s.countries.map(countryName).join(', ')} · {showIdentity ? `${s.founders[0]?.name} · ` : ''}received {new Date(s.receivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
      {review && <ReviewModal data={data} s={review} me={me} showIdentity={showIdentity} onClose={() => setReview(null)} onOpen={onOpen} />}
    </Panel>
  )
}

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
