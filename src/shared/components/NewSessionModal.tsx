import React, { useState } from 'react'
import { CalendarPlus, Plus, X } from 'lucide-react'
import { Modal } from './Modal'
import { Pillar, interventions } from '../data/mela'
import { notify } from '../lib/notify'
import { logAction } from '../lib/interventionLog'
import { createSession } from '../data/sessionStore'

/** `by`: the signed-in staff member, for the Interventions activity log. */
export function NewSessionModal({ open, onClose, pillars, onCreate, by }: { open: boolean; onClose: () => void; pillars: Pillar[]; onCreate?: (id: string) => void; by?: string }) {
  const options = interventions.filter((i) => pillars.includes(i.pillar))
  const [intervention, setIntervention] = useState(options[0]?.id ?? '')
  const [dates, setDates] = useState(['2025-11-24'])
  const chosen = options.find((o) => o.id === intervention)
  const [name, setName] = useState('')
  const [venue, setVenue] = useState('ALU Kigali campus')
  const suggested = chosen ? `${chosen.name} · Cohort ${chosen.sessions + 1}` : ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New session"
      description="A session is one run of an intervention. Forms are created as drafts."
      icon={<CalendarPlus className="h-4 w-4" />}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-canvas">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!chosen) return
              // The session is created with its forms as drafts (from the intervention's templates),
              // then opens on its process so staff can take it from registration to feedback.
              const run = createSession({ interventionId: chosen.id, name: name || suggested, dates, venue })
              if (by) logAction({ by, pillar: chosen.pillar, action: 'session_created', session: run.name, detail: `Created ${run.name} (${run.dates}), forms saved as drafts` })
              notify({ title: `Session created · ${run.name}`, body: `${dates.length} date${dates.length === 1 ? '' : 's'} · forms saved as drafts`, tone: 'good', to: 'interventions' })
              setName('')
              onClose()
              onCreate?.(run.id)
            }}
            className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            Create session
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Intervention">
          <select value={intervention} onChange={(e) => setIntervention(e.target.value)} className={input}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.pillar} · {o.name}
              </option>
            ))}
          </select>
          {chosen && (
            <p className="mt-1.5 text-xs text-muted">
              {chosen.kind === 'selective' ? 'Selective: people apply and are scored by reviewers.' : 'Open: anyone with the link can register.'}
            </p>
          )}
        </Field>
        <Field label="Session name">
          <input value={name} placeholder={suggested} onChange={(e) => setName(e.target.value)} className={input} />
        </Field>
        <Field label="Dates">
          <div className="space-y-2">
            {dates.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input type="date" value={d} onChange={(e) => setDates(dates.map((x, k) => (k === i ? e.target.value : x)))} className={`${input} flex-1`} />
                {dates.length > 1 && (
                  <button type="button" aria-label="Remove date" onClick={() => setDates(dates.filter((_, k) => k !== i))} className="grid h-10 w-10 place-items-center rounded-lg border border-line-strong text-muted hover:text-ink">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setDates([...dates, dates[dates.length - 1]])} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
              <Plus className="h-4 w-4" /> Add a date
            </button>
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Venue">
            <input value={venue} onChange={(e) => setVenue(e.target.value)} className={input} />
          </Field>
          <Field label="Completion threshold">
            <select defaultValue="75" className={input}>
              <option value="50">50% of dates</option>
              <option value="75">75% of dates (default)</option>
              <option value="100">All dates</option>
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  )
}

const input =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-body">{label}</span>
      {children}
    </label>
  )
}
export const inputClass = input
