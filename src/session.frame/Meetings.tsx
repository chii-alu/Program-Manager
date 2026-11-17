/**
 * Attendance for selective interventions: by meeting. Staff set up the cohort's meetings
 * (orientation, workshops, site visits, check-ins…), say who's expected at each, and take
 * attendance per meeting. "By student" shows each person's rate across the meetings they were
 * expected at. Open interventions keep attendance by date.
 */
import React, { useMemo, useState } from 'react'
import { CalendarDays, Check, CheckCheck, MapPin, Monitor, Pencil, Plus, QrCode, Search, Trash2, Users } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { Button, Panel } from '../shared/components/ui'
import { EmptyState } from '../shared/components/EmptyState'
import { toast } from '../shared/lib/notify'
import { recordAttendance, type SessionRun } from '../shared/data/sessionStore'
import {
  MEETING_TYPES,
  MeetingError,
  TODAY,
  addMeeting,
  attendanceByPerson,
  cohortMembers,
  deleteMeeting,
  expectedAt,
  meetingsFor,
  setPresent,
  updateMeeting,
  useMeetingsState,
  type Meeting,
  type MeetingInput,
} from '../shared/data/meetings'

const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`)

type Log = (action: 'attendance_marked' | 'session_changed', detail: string) => void

export function MeetingsAttendance({ s, me, showId, log, onQr }: { s: SessionRun; me: string; showId: boolean; log: Log; onQr: () => void }) {
  const state = useMeetingsState()
  const meetings = meetingsFor(s, state)
  const people = useMemo(() => cohortMembers(s), [s])
  const members = people.map((p) => p.id)
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id
  const [view, setView] = useState<'meeting' | 'student'>('meeting')
  const [openId, setOpenId] = useState<string | null>(null)
  const next = meetings.find((m) => m.date >= TODAY) ?? meetings[meetings.length - 1]
  const current = meetings.find((m) => m.id === openId) ?? meetings.filter((m) => m.date <= TODAY).slice(-1)[0] ?? next
  const [editing, setEditing] = useState<Meeting | 'new' | null>(null)
  const [confirmDel, setConfirmDel] = useState<Meeting | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-0.5 rounded-lg bg-canvas p-0.5">
          {(
            [
              ['meeting', 'By meeting'],
              ['student', 'By student'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setView(k)} className={`h-8 rounded-md px-3 text-xs font-medium ${view === k ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Attendance is taken per meeting, for the {people.length} people selected. Each meeting can be for everyone or for particular people.
        </p>
        <Button variant="primary" className="sm:ml-auto" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Add meeting
        </Button>
      </div>

      {meetings.length === 0 ? (
        <Panel>
          <EmptyState icon={CalendarDays} title="No meetings yet" body="Add the cohort’s meetings (orientation, workshops, site visits, check-ins) and take attendance at each one." action={{ label: 'Add meeting', onClick: () => setEditing('new') }} />
        </Panel>
      ) : view === 'student' ? (
        <ByStudent meetings={meetings} members={members} nameOf={nameOf} showId={showId} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Panel>
            <ul className="max-h-[620px] divide-y divide-line overflow-y-auto">
              {meetings.map((m) => {
                const exp = expectedAt(m, members)
                const here = exp.filter((id) => m.present[id]).length
                const upcoming = m.date > TODAY
                const on = current?.id === m.id
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => setOpenId(m.id)} className={`flex w-full items-start gap-3 px-4 py-3 text-left ${on ? 'bg-brand-50' : 'hover:bg-canvas'}`}>
                      <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-center text-[10px] font-bold leading-tight ${on ? 'bg-brand text-white' : 'bg-canvas text-body'}`}>
                        {new Date(`${m.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric' })}
                        <br />
                        {new Date(`${m.date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-semibold ${on ? 'text-brand-600' : 'text-ink'}`}>{m.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {m.type} · {m.mode}
                          {m.time ? ` · ${m.time}` : ''}
                          {m.invite !== 'all' ? ` · ${exp.length} people` : ''}
                        </span>
                      </span>
                      <span className={`shrink-0 text-xs font-semibold tabular-nums ${upcoming ? 'text-faint' : here === exp.length ? 'text-good' : 'text-body'}`}>{upcoming ? 'Upcoming' : `${here}/${exp.length}`}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>
          {current && (
            <MeetingRoster
              key={current.id}
              s={s}
              m={current}
              members={members}
              nameOf={nameOf}
              showId={showId}
              onQr={onQr}
              onEdit={() => setEditing(current)}
              onDelete={() => setConfirmDel(current)}
              onMarked={(detail, count) => (log('attendance_marked', detail), recordAttendance(s.id, count))}
            />
          )}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" title={editing === 'new' ? 'Add a meeting' : 'Edit meeting'} icon={<CalendarDays className="h-4 w-4" />}>
        {editing && (
          <MeetingForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? undefined : editing}
            people={people}
            showId={showId}
            onCancel={() => setEditing(null)}
            onSave={(x) => {
              if (editing === 'new') {
                const m = addMeeting(s, x, me)
                setOpenId(m.id)
                log('session_changed', `Added meeting “${m.title}” on ${m.date}${m.invite === 'all' ? '' : ` for ${m.invite.length} people`}`)
                toast({ title: 'Meeting added', body: `${m.title} · ${fmt(m.date)}`, tone: 'good' })
              } else {
                updateMeeting(s, editing.id, x)
                log('session_changed', `Changed meeting “${x.title}” (${x.date})`)
                toast({ title: 'Meeting saved', body: x.title, tone: 'good' })
              }
              setEditing(null)
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        size="sm"
        title="Delete this meeting?"
        description={confirmDel ? `${confirmDel.title} · ${fmt(confirmDel.date)}. Its attendance is deleted too.` : undefined}
        icon={<Trash2 className="h-4 w-4" />}
        footer={
          <>
            <Button onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button
              className="text-bad"
              onClick={() => {
                if (!confirmDel) return
                deleteMeeting(s, confirmDel.id)
                log('session_changed', `Deleted meeting “${confirmDel.title}” (${confirmDel.date})`)
                toast({ title: 'Meeting deleted', body: confirmDel.title, tone: 'warn' })
                setOpenId(null)
                setConfirmDel(null)
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />
    </div>
  )
}

function MeetingRoster({
  s,
  m,
  members,
  nameOf,
  showId,
  onQr,
  onEdit,
  onDelete,
  onMarked,
}: {
  s: SessionRun
  m: Meeting
  members: string[]
  nameOf: (id: string) => string
  showId: boolean
  onQr: () => void
  onEdit: () => void
  onDelete: () => void
  onMarked: (detail: string, count: number) => void
}) {
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'all' | 'present' | 'absent'>('all')
  const exp = expectedAt(m, members)
  const count = exp.filter((id) => m.present[id]).length
  const upcoming = m.date > TODAY
  const rows = exp.filter((id) => (show === 'all' || (show === 'present') === !!m.present[id]) && `${id} ${showId ? nameOf(id) : ''}`.toLowerCase().includes(q.toLowerCase()))
  const toggle = (id: string) => {
    const on = !m.present[id]
    setPresent(s, m.id, [id], on)
    onMarked(`${id} ${on ? 'present' : 'absent'} · ${m.title} (${m.date})`, count + (on ? 1 : -1))
  }
  return (
    <Panel>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-start sm:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink">{m.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{fmt(m.date)}{m.time ? ` · ${m.time}` : ''}</span>
            <span className="inline-flex items-center gap-1">{m.mode === 'Online' ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />} {m.mode}</span>
            <span>· {m.type}</span>
            <span className="inline-flex items-center gap-1">
              · <Users className="h-3 w-3" /> {m.invite === 'all' ? 'Everyone selected' : `${exp.length} people`}
            </span>
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button className="h-8 text-xs" onClick={onQr}>
            <QrCode className="h-3.5 w-3.5" /> Check-in QR
          </Button>
          <button type="button" onClick={onEdit} aria-label="Edit meeting" title="Edit" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete meeting" title="Delete" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bad-bg hover:text-bad">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-5">
        <span className="text-sm">
          <span className="font-semibold tabular-nums">{count}</span>
          <span className="text-muted"> of {exp.length} present{upcoming ? ' · this meeting hasn’t happened yet' : ''}</span>
        </span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-good transition-[width] duration-200" style={{ width: `${(count / (exp.length || 1)) * 100}%` }} />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:px-5">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={showId ? 'Search name or CHII ID' : 'Search CHII ID'} className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand-600" />
        </label>
        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="flex gap-0.5 rounded-lg bg-canvas p-0.5">
            {(['all', 'present', 'absent'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setShow(k)} className={`h-8 rounded-md px-3 text-xs font-medium capitalize ${show === k ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink'}`}>
                {k}
              </button>
            ))}
          </div>
          <Button
            className="h-9 shrink-0 px-3 text-xs"
            onClick={() => {
              setPresent(s, m.id, exp, true)
              onMarked(`Marked all ${exp.length} present · ${m.title} (${m.date})`, exp.length)
              toast({ title: `All ${exp.length} marked present`, body: m.title, tone: 'good' })
            }}
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all
          </Button>
        </div>
      </div>
      <ul className="max-h-[440px] divide-y divide-line overflow-y-auto">
        {rows.map((id) => {
          const on = !!m.present[id]
          return (
            <li key={id}>
              <button type="button" onClick={() => toggle(id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas sm:px-5">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? 'border-good bg-good text-white' : 'border-line-strong'}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{showId ? nameOf(id) : id}</span>
                  {showId && <span className="block font-mono text-xs text-muted">{id}</span>}
                </span>
                <span className={`text-xs font-medium ${on ? 'text-good' : 'text-faint'}`}>{on ? (m.present[id] === 'manual' ? 'Ticked' : m.present[id]) : 'Absent'}</span>
              </button>
            </li>
          )
        })}
        {!rows.length && <li className="px-5 py-8 text-center text-sm text-muted">No one here.</li>}
      </ul>
    </Panel>
  )
}

function ByStudent({ meetings, members, nameOf, showId }: { meetings: Meeting[]; members: string[]; nameOf: (id: string) => string; showId: boolean }) {
  const rows = attendanceByPerson(meetings, members).sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2))
  const held = meetings.filter((m) => m.date <= TODAY)
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line bg-canvas/60 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-muted">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-3 py-2">Attendance</th>
              <th className="px-3 py-2">Missed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const missed = held.filter((m) => expectedAt(m, members).includes(r.id) && !m.present[r.id])
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    {showId && <span className="block font-semibold text-ink">{nameOf(r.id)}</span>}
                    <span className="font-mono text-[11.5px] text-brand-600">{r.id}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-canvas">
                        <div className={`h-full rounded-full ${r.rate != null && r.rate < 0.75 ? 'bg-warn' : 'bg-good'}`} style={{ width: pct(r.rate) }} />
                      </div>
                      <span className={`text-xs font-semibold tabular-nums ${r.rate != null && r.rate < 0.75 ? 'text-warn' : 'text-ink'}`}>{pct(r.rate)}</span>
                      <span className="text-xs text-muted">
                        {r.attended} of {r.expected} meetings
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-body">{missed.length ? missed.map((m) => `${m.title} (${new Date(`${m.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`).join(', ') : <span className="text-muted">None</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Each person’s rate counts only the meetings held so far that they were expected at. Under 75% is highlighted.</p>
    </Panel>
  )
}

function MeetingForm({ initial, people, showId, onCancel, onSave }: { initial?: Meeting; people: { id: string; name: string }[]; showId: boolean; onCancel: () => void; onSave: (x: MeetingInput) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<MeetingInput['type']>(initial?.type ?? 'Workshop')
  const [date, setDate] = useState(initial?.date ?? TODAY)
  const [time, setTime] = useState(initial?.time ?? '09:00')
  const [mode, setMode] = useState<MeetingInput['mode']>(initial?.mode ?? 'In person')
  const [who, setWho] = useState<'all' | 'some'>(initial && initial.invite !== 'all' ? 'some' : 'all')
  const [picked, setPicked] = useState<string[]>(initial && initial.invite !== 'all' ? initial.invite : [])
  const [error, setError] = useState('')
  const input = 'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600'
  const chip = (on: boolean) => `inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold ${on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-body hover:bg-canvas'}`
  const save = () => {
    try {
      const x: MeetingInput = { title, type, date, time: time || undefined, mode, invite: who === 'all' ? 'all' : picked }
      if (!x.title.trim()) throw new MeetingError('Give the meeting a name, e.g. “Orientation” or “Site visit: district hospital”.')
      if (x.invite !== 'all' && !x.invite.length) throw new MeetingError('Choose who’s expected, or pick “Everyone selected”.')
      onSave(x)
    } catch (e) {
      setError(e instanceof MeetingError ? e.message : 'Couldn’t save.')
    }
  }
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">Meeting name</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Orientation, Site visit: district hospital" className={input} />
      </label>
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">Type</span>
        <div className="flex flex-wrap gap-1.5">
          {MEETING_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={chip(type === t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">Time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
        </label>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink">Where</span>
          <div className="flex gap-1.5">
            {(['In person', 'Online'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setMode(k)} className={chip(mode === k)}>
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold text-ink">Who’s expected</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setWho('all')} className={chip(who === 'all')}>
            Everyone selected ({people.length})
          </button>
          <button type="button" onClick={() => setWho('some')} className={chip(who === 'some')}>
            Particular people{who === 'some' && picked.length ? ` (${picked.length})` : ''}
          </button>
        </div>
        {who === 'some' && (
          <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {people.map((p) => {
              const on = picked.includes(p.id)
              return (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                    <input type="checkbox" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])} className="h-4 w-4 accent-brand-600" />
                    <span className="flex-1 text-ink">{showId ? p.name : p.id}</span>
                    {showId && <span className="font-mono text-[11px] text-muted">{p.id}</span>}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          {initial ? 'Save meeting' : 'Add meeting'}
        </Button>
      </div>
    </div>
  )
}
