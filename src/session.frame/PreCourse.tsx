/**
 * SIE cohort → Pre-internship course tab: the cohort's Canvas course, synced from Canvas.
 * Selected students only. Shows module progress, assignments, quiz scores and last activity, and
 * flags anyone who won't be done by the "complete by" date (the course is required before the
 * internship starts).
 */
import React, { useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, GraduationCap, Play, RefreshCcw, ShieldCheck, UserX, Users } from 'lucide-react'
import { StatCards } from '../shared/components/StatStrip'
import { Button, Panel } from '../shared/components/ui'
import { toast } from '../shared/lib/notify'
import { participants } from '../shared/data/mela'
import type { SessionRun } from '../shared/data/sessionStore'
import {
  INACTIVE_DAYS,
  STATUS_LABEL,
  TODAY,
  PreCourseError,
  courseFor,
  daysBetween,
  dismissStudent,
  matchStudent,
  saveCourseSettings,
  selectedOf,
  studentSummary,
  syncCourse,
  usePreCourses,
  type CourseStatus,
} from '../shared/data/preCourse'

const STATUS_CLS: Record<CourseStatus, string> = {
  complete: 'bg-good-bg text-good',
  on_track: 'bg-brand-50 text-brand-600',
  behind: 'bg-warn-bg text-warn',
  inactive: 'bg-warn-bg text-warn',
  not_started: 'bg-bad-bg text-bad',
  not_complete: 'bg-bad-bg text-bad',
  not_synced: 'bg-canvas text-muted',
}
const fmt = (iso?: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const pct = (x: number) => `${Math.round(x * 100)}%`

type Filter = 'all' | 'attention' | 'complete'

export function PreCourseTab({ s, me, showId, log, onOpenPerson }: { s: SessionRun; me: string; showId: boolean; log: (action: 'course_synced' | 'session_changed', detail: string) => void; onOpenPerson?: (id: string) => void }) {
  const state = usePreCourses()
  const c = courseFor(s, state)
  const selected = selectedOf(s)
  const [filter, setFilter] = useState<Filter>('all')
  const [courseId, setCourseId] = useState(c.courseId)
  const [startsOn, setStartsOn] = useState(c.startsOn)
  const [completeBy, setCompleteBy] = useState(c.completeBy)
  const synced = c.runs.length > 0
  const rows = selected.map((p) => ({ p, sum: studentSummary(c, c.progress[p.id]) }))
  const attention = rows.filter((r) => ['behind', 'inactive', 'not_started', 'not_complete'].includes(r.sum.status))
  const done = rows.filter((r) => r.sum.status === 'complete')
  const shown = filter === 'all' ? rows : filter === 'complete' ? done : attention
  const daysLeft = daysBetween(TODAY, c.completeBy)
  const avg = rows.length ? rows.reduce((n, r) => n + r.sum.share, 0) / rows.length : 0

  const sync = () => {
    const r = syncCourse(s, me)
    log('course_synced', `Pre-internship course synced from Canvas · ${r.written} students updated · ${r.unmatched} unmatched`)
    toast({ title: 'Synced from Canvas', body: `${r.written} student${r.written === 1 ? '' : 's'} updated${r.unmatched ? ` · ${r.unmatched} not matched` : ''}`, tone: r.unmatched ? 'warn' : 'good' })
  }
  const saveSettings = () => {
    try {
      saveCourseSettings(s, { courseId: courseId.trim(), startsOn, completeBy })
      log('session_changed', `Pre-internship course: Canvas course ${courseId.trim() || 'not set'}, complete by ${completeBy}`)
      toast({ title: 'Course settings saved', body: `Complete by ${fmt(completeBy)}`, tone: 'good' })
    } catch (e) {
      toast({ title: 'Not saved', body: e instanceof PreCourseError ? e.message : '', tone: 'bad' })
    }
  }

  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-warn-bg px-3 py-2 text-xs leading-5 text-warn">
        Canvas isn’t connected yet: once the Canvas admin issues API access this syncs every night. Until then “Sync from Canvas” uses sample data so the flow can be tried. Module and assignment names come from the Canvas course.
      </p>

      <Panel>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Canvas course ID</span>
            <input value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="e.g. 9120" className="h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm outline-none focus:border-brand-600" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Course starts</span>
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className="h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Complete by (internship starts)</span>
            <input type="date" value={completeBy} onChange={(e) => setCompleteBy(e.target.value)} className="h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600" />
          </label>
          <div className="flex gap-2">
            <Button className="h-9 text-xs" onClick={saveSettings}>
              Save
            </Button>
            <Button variant="primary" className="h-9 text-xs" onClick={sync}>
              <Play className="h-3.5 w-3.5" /> Sync from Canvas
            </Button>
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <RefreshCcw className="h-3.5 w-3.5" /> {synced ? `Last synced ${new Date(c.runs[0].at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} by ${c.runs[0].by}` : 'Not synced yet'}
          </span>
          <span>·</span>
          <span>
            {c.items.filter((i) => i.kind === 'module').length} modules, {c.items.filter((i) => i.kind === 'assignment').length} assignments, {c.items.filter((i) => i.kind === 'quiz').length} quizzes
          </span>
          <span>·</span>
          <span className={daysLeft < 0 ? 'font-semibold text-bad' : daysLeft <= 7 ? 'font-semibold text-warn' : ''}>{daysLeft < 0 ? `Deadline passed ${-daysLeft} days ago` : `${daysLeft} days to the deadline`}</span>
        </p>
      </Panel>

      <StatCards
        columns={5}
        items={[
          { label: 'Enrolled', value: selected.length, icon: Users, hint: 'Students selected for the cohort' },
          { label: 'Completed', value: done.length, icon: CheckCircle2, hint: selected.length ? `${pct(done.length / selected.length)} ready for the internship` : undefined },
          { label: 'Need attention', value: attention.length, icon: AlertTriangle, hint: 'Behind, inactive or not started' },
          { label: 'Average progress', value: 0, display: synced ? pct(avg) : '—', icon: GraduationCap, hint: 'Of modules completed' },
          { label: 'Not matched', value: c.unmatched.length, icon: UserX, hint: 'On Canvas, no CHII record' },
        ]}
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {(
            [
              ['all', `All ${rows.length}`],
              ['attention', `Need attention ${attention.length}`],
              ['complete', `Complete ${done.length}`],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`h-8 rounded-full border px-3 text-xs font-semibold ${filter === k ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-body hover:bg-canvas'}`}>
              {l}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted">Required before the internship: everyone must finish by {fmt(c.completeBy)}.</span>
        </div>
        {!synced ? (
          <div className="grid min-h-[200px] place-items-center p-6 text-center">
            <div>
              <RefreshCcw className="mx-auto h-6 w-6 text-muted" />
              <p className="mt-2 text-sm font-semibold text-ink">No Canvas data yet</p>
              <p className="mt-1 text-sm text-muted">Add the Canvas course ID and run “Sync from Canvas” to pull each student’s progress.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-line bg-canvas/60 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-muted">
                <tr>
                  <th className="px-4 py-2">Student</th>
                  <th className="px-3 py-2">Progress</th>
                  <th className="px-3 py-2 text-right">Assignments</th>
                  <th className="px-3 py-2 text-right">Quiz avg</th>
                  <th className="px-3 py-2">Last active</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map(({ p, sum }) => (
                  <tr key={p.id} className="hover:bg-canvas/60">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => onOpenPerson?.(p.id)} className="text-left">
                        {showId && <span className="block font-semibold text-ink hover:text-brand-600 hover:underline">{p.name}</span>}
                        <span className="font-mono text-[11.5px] text-brand-600">{p.id}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="relative h-1.5 w-28 overflow-hidden rounded-full bg-canvas">
                          <div className={`h-full rounded-full ${sum.status === 'complete' ? 'bg-good' : sum.status === 'on_track' ? 'bg-brand-600' : 'bg-warn'}`} style={{ width: pct(sum.share) }} />
                          <span className="absolute top-0 h-full w-0.5 bg-ink/40" style={{ left: pct(sum.expected) }} title="Where they should be by now" />
                        </div>
                        <span className="text-xs tabular-nums text-body">
                          {sum.modules.done}/{sum.modules.of} modules
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="text-ink">
                        {sum.assignments.submitted} of {sum.assignments.due} due
                      </span>
                      <span className="block text-xs text-muted">
                        {sum.assignments.late ? <span className="text-warn">{sum.assignments.late} late</span> : 'none late'}
                        {sum.assignments.mean != null ? ` · avg ${sum.assignments.mean.toFixed(1)}/10` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{sum.quiz != null ? `${sum.quiz.toFixed(1)}/10` : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {sum.idle == null ? (
                        <span className="text-muted">Never</span>
                      ) : (
                        <span className={sum.idle >= INACTIVE_DAYS ? 'font-semibold text-warn' : 'text-body'}>
                          <Clock className="mr-1 inline h-3 w-3" />
                          {sum.idle === 0 ? 'Today' : `${sum.idle} day${sum.idle === 1 ? '' : 's'} ago`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[sum.status]}`}>{STATUS_LABEL[sum.status]}</span>
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                      No students here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Not matched to a CHII record" sub="Enrolled on Canvas, but their email isn’t on a CHII record">
          {c.unmatched.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">{synced ? 'Everyone on the course is matched.' : 'Run a sync to check.'}</p>
          ) : (
            <ul className="divide-y divide-line">
              {c.unmatched.map((u) => (
                <Unmatched key={u.canvasId} u={u} s={s} showId={showId} taken={Object.values(c.links)} />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Sync log" sub="Every run; running again adds no duplicates">
          {c.runs.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">No syncs yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {c.runs.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2">
                  <CalendarClock className="h-4 w-4 shrink-0 text-muted" />
                  <span className="flex-1 text-body">
                    {new Date(r.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.by}
                  </span>
                  <span className="text-xs text-muted">
                    {r.written} updated · {r.unmatched} unmatched
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-start gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" /> Matched by email. The CHII ID is never written to Canvas.
          </p>
        </Panel>
      </div>
    </div>
  )
}

function Unmatched({ u, s, showId, taken }: { u: { canvasId: string; name: string; email: string }; s: SessionRun; showId: boolean; taken: string[] }) {
  const [pick, setPick] = useState('')
  const free = selectedOf(s).filter((p) => !taken.includes(p.id))
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{showId ? u.name : `Canvas user ${u.canvasId}`}</span>
        {showId && <span className="block text-xs text-muted">{u.email}</span>}
      </span>
      <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Student" className="h-8 rounded-md border border-line-strong bg-surface px-2 text-xs">
        <option value="">Match to…</option>
        {(free.length ? free : participants.slice(0, 40)).map((p) => (
          <option key={p.id} value={p.id}>
            {showId ? `${p.name} · ` : ''}
            {p.id}
          </option>
        ))}
      </select>
      <span className="flex gap-1.5">
        <Button className="h-8 text-xs" onClick={() => pick && (matchStudent(s, u.canvasId, pick), toast({ title: 'Matched', body: `${pick}: their progress comes in on the next sync.`, tone: 'good' }))}>
          Match
        </Button>
        <Button className="h-8 text-xs" onClick={() => (dismissStudent(s, u.canvasId), toast({ title: 'Dismissed', body: 'Not a student; the sync will skip them.', tone: 'info' }))}>
          Not a student
        </Button>
      </span>
    </li>
  )
}

/** SIE intervention page: each cohort's pre-internship course at a glance. */
export function PreCourseSummary({ runs, onOpenSession }: { runs: SessionRun[]; onOpenSession?: (id: string) => void }) {
  const state = usePreCourses()
  const rows = runs.map((s) => {
    const c = courseFor(s, state)
    const sel = selectedOf(s)
    const sums = sel.map((p) => studentSummary(c, c.progress[p.id]))
    return {
      s,
      c,
      enrolled: sel.length,
      done: sums.filter((x) => x.status === 'complete').length,
      attention: sums.filter((x) => ['behind', 'inactive', 'not_started', 'not_complete'].includes(x.status)).length,
    }
  })
  return (
    <Panel title="Pre-internship course" sub="One Canvas course per cohort, for the students selected. Required before the internship starts.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line bg-canvas/60 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-muted">
            <tr>
              <th className="px-4 py-2">Cohort</th>
              <th className="px-3 py-2 text-right">Enrolled</th>
              <th className="px-3 py-2 text-right">Completed</th>
              <th className="px-3 py-2 text-right">Need attention</th>
              <th className="px-3 py-2">Complete by</th>
              <th className="px-3 py-2">Last synced</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ s, c, enrolled, done, attention }) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5 font-semibold text-ink">{s.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{enrolled}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{c.runs.length ? done : '—'}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${attention ? 'font-semibold text-warn' : ''}`}>{c.runs.length ? attention : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">{fmt(c.completeBy)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{c.runs.length ? new Date(c.runs[0].at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Not yet'}</td>
                <td className="px-3 py-2.5 text-right">
                  <button type="button" onClick={() => onOpenSession?.(`${s.id}#course`)} className="inline-flex h-8 items-center rounded-md border border-line-strong px-3 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
                  No SIE cohorts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
