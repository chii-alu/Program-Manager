/** A cohort's Curriculum tab: its sessions grouped by module, with dates, attendance and the delivery log. */
import React, { useState } from 'react'
import { CalendarClock, CheckSquare, ChevronDown, NotebookPen } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { Button } from '../shared/components/ui'
import { toast } from '../shared/lib/notify'
import { EXPOSE_MODULES, moduleLabel, sessionCode } from '../shared/incubation/curriculum'
import { TODAY, cohortSessions, foundersIn, held, isExempt } from '../shared/incubation/progress'
import { IncubationError, logDelivery, setAttendance, setSessionDate, shiftDates } from '../shared/incubation/store'
import { DELIVERED_LABEL, type ClassSession, type Cohort, type Delivered, type IncubationData } from '../shared/incubation/types'
import { Chip, Field, Note, ToAdd, inputCls, nameOf } from './parts'

const DELIVERY_CLS: Record<Delivered, string> = { as_planned: 'bg-good-bg text-good', changed: 'bg-warn-bg text-warn', rescheduled: 'bg-brand-50 text-brand-600', skipped: 'bg-bad-bg text-bad' }

export function CurriculumTab({ data, c, me }: { data: IncubationData; c: Cohort; me: string }) {
  const ss = cohortSessions(data, c.id)
  const fs = foundersIn(data, c.id)
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const [att, setAtt] = useState<ClassSession | null>(null)
  const [log, setLog] = useState<ClassSession | null>(null)
  if (!ss.length)
    return (
      <div className="p-4">
        <Note>This {c.stage} cohort has no sessions: only Expose has a curriculum so far. When the Build or Scale curriculum is written, it’s added on the Curriculum page and new cohorts get their sessions from it.</Note>
      </div>
    )
  return (
    <div>
      {EXPOSE_MODULES.map((m) => {
        const ms = ss.filter((s) => s.moduleCode === m)
        const past = ms.filter((s) => held(s.date))
        const isClosed = closed[m] ?? (past.length === ms.length && ms.length > 0 && ms.every((s) => s.delivery))
        return (
          <section key={m} className="border-b border-line last:border-b-0">
            <button type="button" onClick={() => setClosed({ ...closed, [m]: !isClosed })} className="flex w-full items-center gap-3 bg-canvas/60 px-4 py-2.5 text-left hover:bg-canvas">
              <ChevronDown className={`h-4 w-4 text-muted transition-transform ${isClosed ? '-rotate-90' : ''}`} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{moduleLabel(data.curriculum, m)}</span>
              <span className="shrink-0 text-xs text-muted">
                {past.length} of {ms.length} held · {past.filter((s) => s.delivery).length} logged
              </span>
            </button>
            {!isClosed && (
              <ul className="divide-y divide-line">
                {ms.map((s) => {
                  const isPast = held(s.date)
                  const eligible = fs.filter((f) => !isExempt(data, c.id, f.chiiId, m))
                  return (
                    <li key={s.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                      <span className="w-[68px] shrink-0 font-mono text-xs font-semibold text-brand-600">{sessionCode(m, s.no)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{s.title || data.curriculum.sessions.find((x) => x.moduleCode === m && x.no === s.no)?.title || <ToAdd />}</span>
                      <input
                        type="date"
                        value={s.date ?? ''}
                        onChange={(e) => setSessionDate(s.id, e.target.value)}
                        aria-label={`Date of ${sessionCode(m, s.no)}`}
                        className="h-8 w-[150px] shrink-0 rounded-md border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-600"
                      />
                      <button
                        type="button"
                        disabled={!isPast}
                        onClick={() => setAtt(s)}
                        title={isPast ? 'Take or correct attendance' : 'Attendance opens on the day'}
                        className="inline-flex h-8 w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-line-strong text-xs font-semibold text-body hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                        {isPast ? `${s.present.filter((p) => eligible.some((f) => f.chiiId === p)).length} / ${eligible.length}` : 'Attendance'}
                      </button>
                      <button
                        type="button"
                        disabled={!isPast}
                        onClick={() => setLog(s)}
                        className={`inline-flex h-8 w-[118px] shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${s.delivery ? DELIVERY_CLS[s.delivery.delivered] : isPast ? 'border border-dashed border-warn text-warn hover:bg-warn-bg' : 'border border-line text-muted'}`}
                      >
                        <NotebookPen className="h-3.5 w-3.5" />
                        {s.delivery ? DELIVERED_LABEL[s.delivery.delivered] : isPast ? 'Log delivery' : 'Not yet'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
      <AttendanceModal s={att} onClose={() => setAtt(null)} data={data} c={c} />
      <DeliveryModal s={log} onClose={() => setLog(null)} data={data} me={me} />
    </div>
  )
}

function AttendanceModal({ s, onClose, data, c }: { s: ClassSession | null; onClose: () => void; data: IncubationData; c: Cohort }) {
  const fs = s ? foundersIn(data, c.id).filter((f) => !isExempt(data, c.id, f.chiiId, s.moduleCode)) : []
  const [present, setPresent] = useState<string[] | null>(null)
  const cur = present ?? s?.present ?? []
  const close = () => (setPresent(null), onClose())
  return (
    <Modal
      open={!!s}
      onClose={close}
      title={s ? `Attendance · ${sessionCode(s.moduleCode, s.no)}` : ''}
      description="From Canvas when the attendance tool is used; correct it here if someone was missed. Founders exempt from this module aren’t listed."
      icon={<CheckSquare className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (s) setAttendance(s.id, cur)
              toast({ title: 'Attendance saved', body: `${cur.length} present`, tone: 'good' })
              close()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        <button type="button" onClick={() => setPresent(fs.map((f) => f.chiiId))} className="font-semibold text-brand-600 hover:underline">
          Everyone present
        </button>
        <span className="text-faint">·</span>
        <button type="button" onClick={() => setPresent([])} className="font-semibold text-brand-600 hover:underline">
          Clear
        </button>
        <span className="ml-auto text-muted">
          {cur.filter((p) => fs.some((f) => f.chiiId === p)).length} of {fs.length} present
        </span>
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {fs.map((f) => {
          const on = cur.includes(f.chiiId)
          return (
            <li key={f.chiiId}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                <input type="checkbox" checked={on} onChange={() => setPresent(on ? cur.filter((x) => x !== f.chiiId) : [...cur, f.chiiId])} className="h-4 w-4 accent-brand-600" />
                <span className="flex-1 text-sm text-ink">{nameOf(f.chiiId)}</span>
                <span className="font-mono text-[11px] text-muted">{f.chiiId}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

function DeliveryModal({ s, onClose, data, me }: { s: ClassSession | null; onClose: () => void; data: IncubationData; me: string }) {
  return (
    <Modal open={!!s} onClose={onClose} size="lg" title={s ? `Delivery log · ${sessionCode(s.moduleCode, s.no)}` : ''} description="For the implementation study: was the session delivered as planned, and what changed?" icon={<NotebookPen className="h-4 w-4" />}>
      {s && <DeliveryForm key={s.id} s={s} data={data} me={me} onDone={onClose} />}
    </Modal>
  )
}

function DeliveryForm({ s, data, me, onDone }: { s: ClassSession; data: IncubationData; me: string; onDone: () => void }) {
  const d = s.delivery
  const [delivered, setDelivered] = useState<Delivered>(d?.delivered ?? 'as_planned')
  const [facilitator, setFacilitator] = useState(d?.facilitator ?? me)
  const [duration, setDuration] = useState(d?.durationMin == null ? '' : String(d.durationMin))
  const [reading, setReading] = useState(d?.readingAssigned ?? true)
  const [activity, setActivity] = useState(d?.activityDone ?? true)
  const [changes, setChanges] = useState(d?.changes ?? '')
  const [issues, setIssues] = useState(d?.issues ?? '')
  const [shift, setShift] = useState('7')
  const [error, setError] = useState('')
  const save = () => {
    try {
      logDelivery(s.id, { delivered, facilitator, durationMin: duration === '' ? null : Number(duration), readingAssigned: reading, activityDone: activity, changes, issues }, me)
      if (delivered === 'rescheduled' && Number(shift)) shiftDates(s.cohortId, s.id, Number(shift))
      toast({ title: 'Delivery logged', body: sessionCode(s.moduleCode, s.no), tone: 'good' })
      onDone()
    } catch (e) {
      setError(e instanceof IncubationError ? e.message : 'Couldn’t save.')
    }
  }
  return (
    <div className="space-y-4">
      <Field label="Delivered" required>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DELIVERED_LABEL) as Delivered[]).map((k) => (
            <Chip key={k} on={delivered === k} onClick={() => setDelivered(k)}>
              {DELIVERED_LABEL[k]}
            </Chip>
          ))}
        </div>
      </Field>
      {delivered === 'rescheduled' && (
        <Field label="Move this and every later session by" hint="Shifts the dates on the Curriculum tab. Leave at 0 to keep the dates.">
          <div className="flex items-center gap-2">
            <input type="number" value={shift} onChange={(e) => setShift(e.target.value)} className={`${inputCls} w-24`} />
            <span className="text-sm text-muted">days</span>
            <CalendarClock className="h-4 w-4 text-muted" />
          </div>
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Facilitator">
          <input value={facilitator} onChange={(e) => setFacilitator(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Duration (minutes)" hint="Planned: 60–75.">
          <input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-5 text-[13px] text-body">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={reading} onChange={(e) => setReading(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Reading assigned
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={activity} onChange={(e) => setActivity(e.target.checked)} className="h-4 w-4 accent-brand-600" /> Activity done
        </label>
      </div>
      <Field label="What changed, and why" required={delivered === 'changed' || delivered === 'skipped'}>
        <textarea rows={2} value={changes} onChange={(e) => setChanges(e.target.value)} className={`${inputCls} h-auto py-2`} />
      </Field>
      <Field label="Issues" hint="Internet, Canvas, attendance, time…">
        <textarea rows={2} value={issues} onChange={(e) => setIssues(e.target.value)} className={`${inputCls} h-auto py-2`} />
      </Field>
      {d && (
        <p className="text-xs text-muted">
          Last logged by {d.loggedBy} on {new Date(d.loggedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
        </p>
      )}
      {s.date && s.date > TODAY && <Note tone="warn">This session hasn’t happened yet.</Note>}
      {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          Save log
        </Button>
      </div>
    </div>
  )
}
