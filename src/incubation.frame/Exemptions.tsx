/**
 * A cohort's Exemptions tab: recognition of prior learning. Every request and decision is
 * recorded (status history); only approved exemptions count towards completion.
 * Evidence is staff-only.
 */
import React, { useState } from 'react'
import { BadgeCheck, Plus, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { Button } from '../shared/components/ui'
import { EmptyState } from '../shared/components/EmptyState'
import { toast } from '../shared/lib/notify'
import { EXPOSE_MODULES, moduleLabel } from '../shared/incubation/curriculum'
import { TODAY, foundersIn } from '../shared/incubation/progress'
import { IncubationError, decideExemption, requestExemption } from '../shared/incubation/store'
import type { Cohort, Exemption, IncubationData } from '../shared/incubation/types'
import { Chip, Field, Note, Person, Td, Th, fmtDate, inputCls, nameOf } from './parts'

const DECISION_CLS: Record<Exemption['decision'], string> = { pending: 'bg-warn-bg text-warn', approved: 'bg-good-bg text-good', declined: 'bg-canvas text-muted' }
const daysSince = (iso: string) => Math.round((new Date(`${TODAY}T00:00:00`).getTime() - new Date(`${iso}T00:00:00`).getTime()) / 86400000)

export function ExemptionsTab({ data, c, me }: { data: IncubationData; c: Cohort; me: string }) {
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<'all' | Exemption['decision']>('all')
  const all = data.exemptions.filter((e) => e.cohortId === c.id)
  const rows = all.filter((e) => filter === 'all' || e.decision === filter).sort((a, b) => (a.decision === 'pending' ? -1 : 0) - (b.decision === 'pending' ? -1 : 0) || b.requestedOn.localeCompare(a.requestedOn))
  const history = data.log.filter((l) => l.cohortId === c.id && l.action.startsWith('exemption_'))
  return (
    <>
      <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'approved', 'declined'] as const).map((k) => (
            <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>
              {k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)} <span className="opacity-70">{k === 'all' ? all.length : all.filter((e) => e.decision === k).length}</span>
            </Chip>
          ))}
        </div>
        <Button className="sm:ml-auto" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Record a request
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No exemption requests" body="When a founder asks to skip a module because they’ve already learnt it, record the request and the evidence here." action={{ label: 'Record a request', onClick: () => setAdding(true) }} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <Th>Founder</Th>
                <Th>Module</Th>
                <Th>Evidence (staff only)</Th>
                <Th>Requested</Th>
                <Th>Decision</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => (
                <tr key={e.id} className="align-top">
                  <Td>
                    <Person chiiId={e.chiiId} />
                  </Td>
                  <Td className="max-w-[200px]">
                    <span className="block truncate font-semibold text-ink">{moduleLabel(data.curriculum, e.moduleCode)}</span>
                  </Td>
                  <Td className="max-w-[340px] text-[13px] leading-5 text-body">{e.evidence}</Td>
                  <Td className="whitespace-nowrap text-xs text-body">
                    {fmtDate(e.requestedOn)}
                    {e.decision === 'pending' && <span className={`block ${daysSince(e.requestedOn) > 14 ? 'font-semibold text-warn' : 'text-muted'}`}>{daysSince(e.requestedOn)} days waiting</span>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${DECISION_CLS[e.decision]}`}>{e.decision[0].toUpperCase() + e.decision.slice(1)}</span>
                    {e.decidedBy && (
                      <span className="mt-1 block text-muted">
                        {e.decidedBy}, {fmtDate(e.decidedOn)}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {e.decision === 'pending' ? (
                      <span className="inline-flex gap-1.5">
                        <Button className="h-8 text-xs" onClick={() => (decideExemption(e.id, 'declined', me), toast({ title: 'Exemption declined', body: `${nameOf(e.chiiId)} · ${e.moduleCode}`, tone: 'warn' }))}>
                          <X className="h-3.5 w-3.5" /> Decline
                        </Button>
                        <Button variant="primary" className="h-8 text-xs" onClick={() => (decideExemption(e.id, 'approved', me), toast({ title: 'Exemption approved', body: `${nameOf(e.chiiId)} · ${e.moduleCode} now counts as exempt`, tone: 'good' }))}>
                          <BadgeCheck className="h-3.5 w-3.5" /> Approve
                        </Button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => (decideExemption(e.id, 'pending', me), toast({ title: 'Reopened', body: 'The decision is back to pending.', tone: 'info' }))} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                        <RotateCcw className="h-3 w-3" /> Reopen
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {history.length > 0 && (
        <details className="border-t border-line px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted">Status history ({history.length})</summary>
          <ul className="mt-2 space-y-1 text-xs text-body">
            {history.map((h) => (
              <li key={h.id}>
                <span className="text-muted">{new Date(h.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span> · {h.by} · {h.detail}
              </li>
            ))}
          </ul>
        </details>
      )}
      <RequestModal open={adding} onClose={() => setAdding(false)} data={data} c={c} me={me} />
    </>
  )
}

function RequestModal({ open, onClose, data, c, me }: { open: boolean; onClose: () => void; data: IncubationData; c: Cohort; me: string }) {
  const fs = foundersIn(data, c.id)
  const [chiiId, setChiiId] = useState('')
  const [moduleCode, setModule] = useState('I1')
  const [requestedOn, setRequestedOn] = useState(TODAY)
  const [evidence, setEvidence] = useState('')
  const [error, setError] = useState('')
  const save = () => {
    try {
      if (!chiiId) throw new IncubationError('Choose the founder.')
      requestExemption({ cohortId: c.id, chiiId, moduleCode, requestedOn, evidence }, me)
      toast({ title: 'Request recorded', body: `${nameOf(chiiId)} · ${moduleCode}. Approve or decline it from the list.`, tone: 'good' })
      setChiiId('')
      setEvidence('')
      setError('')
      onClose()
    } catch (e) {
      setError(e instanceof IncubationError ? e.message : 'Couldn’t save.')
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an exemption request"
      icon={<ShieldCheck className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Record request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Founder" required>
          <select value={chiiId} onChange={(e) => setChiiId(e.target.value)} className={inputCls}>
            <option value="">Choose…</option>
            {fs.map((f) => (
              <option key={f.chiiId} value={f.chiiId}>
                {nameOf(f.chiiId)} · {f.chiiId}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Module" required>
            <div className="flex gap-1.5">
              {EXPOSE_MODULES.map((m) => (
                <Chip key={m} on={moduleCode === m} onClick={() => setModule(m)}>
                  {m}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Requested on">
            <input type="date" value={requestedOn} onChange={(e) => setRequestedOn(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="What they showed" required hint="Certificate, an earlier brief, work samples… Staff only; never shown to founders or in analytics.">
          <textarea rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} className={`${inputCls} h-auto py-2`} />
        </Field>
        <Note>The request starts as pending and doesn’t count until someone approves it.</Note>
        {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
