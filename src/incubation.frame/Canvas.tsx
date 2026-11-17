/**
 * Incubation → Canvas sync: courses, the Canvas item → assessment mapping, unmatched users,
 * the sync log and "Run sync now". Canvas isn't connected yet, so the page runs on the store's
 * Canvas stand-in. Matching is by email; the Canvas user ID is kept on the CHII side, and
 * nothing (least of all the CHII ID) is written to Canvas.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Link2, Play, RefreshCcw, ShieldCheck, Sparkles, UserX, Users, Wand2 } from 'lucide-react'
import { StatCards } from '../shared/components/StatStrip'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { toast } from '../shared/lib/notify'
import { EXPOSE_MODULES, assessmentName } from '../shared/incubation/curriculum'
import { foundersIn } from '../shared/incubation/progress'
import { IncubationError, canvasAssignments, canvasUsers, ignoreCanvasUser, matchCanvasUser, runSync, setCanvasCourses, setMapping, suggestMapping } from '../shared/incubation/store'
import type { Cohort, IncubationData } from '../shared/incubation/types'
import { Chip, Note, Td, Th, fmtDate, inputCls, nameOf } from './parts'

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function CanvasPage({ data, me, onOpenCohort }: { data: IncubationData; me: string; onOpenCohort: (id: string) => void }) {
  const cohorts = data.cohorts.filter((c) => c.stage === 'expose').sort((a, b) => b.startsOn.localeCompare(a.startsOn))
  const [id, setId] = useState(cohorts[0]?.id ?? '')
  const c = data.cohorts.find((x) => x.id === id)
  if (!c)
    return (
      <>
        <PageHeader crumbs={['HENT', 'Incubation', 'Canvas sync']} title="Canvas Sync" />
        <Note>Create an Expose cohort first; each one links to its Canvas course.</Note>
      </>
    )
  const runs = data.canvas.runs.filter((r) => r.cohortId === c.id)
  const last = runs[0]
  const unmatched = data.canvas.unmatched[c.id] ?? []
  const users = canvasUsers(data, c)
  const matched = users.filter((u) => data.canvas.links[u.canvasId]?.chiiId).length
  const items = canvasAssignments(data, c)
  const mapped = Object.keys(data.canvas.mapping[c.id] ?? {}).length

  const sync = () => {
    try {
      const r = runSync(c.id, me)
      toast({ title: 'Canvas sync finished', body: `${r.read} rows read · ${r.written} written · ${r.unmatched} unmatched`, tone: r.unmatched ? 'warn' : 'good' })
    } catch (e) {
      toast({ title: 'Sync failed', body: e instanceof Error ? e.message : '', tone: 'bad' })
    }
  }

  return (
    <>
      <PageHeader
        crumbs={['HENT', 'Incubation', 'Canvas sync']}
        title="Canvas Sync"
        description="Courses are delivered on Canvas. MELA pulls enrolments, submissions, rubric scores, quiz scores and attendance from it, so nobody retypes them."
        actions={
          <Button variant="primary" onClick={sync}>
            <Play className="h-4 w-4" /> Run sync now
          </Button>
        }
      />
      <Note tone="warn">
        Canvas isn’t connected yet: the sync runs nightly once the Canvas admin issues API access. Until then this page uses sample Canvas data so the flow can be tried. The fallback is importing a Canvas gradebook export on a cohort’s Assessments tab.
      </Note>
      <div className="flex flex-wrap items-center gap-2">
        {cohorts.map((x) => (
          <Chip key={x.id} on={x.id === id} onClick={() => setId(x.id)}>
            {x.name}
          </Chip>
        ))}
        <button type="button" onClick={() => onOpenCohort(c.id)} className="ml-1 text-xs font-semibold text-brand-600 hover:underline">
          Open cohort →
        </button>
      </div>
      <StatCards
        items={[
          { label: 'Last sync', value: 0, display: last ? when(last.finishedAt) : 'Never', icon: RefreshCcw, hint: last ? `${last.by} · ${last.written} written` : 'Run it once the mapping is set' },
          { label: 'Founders matched', value: matched, display: `${users.filter((u) => foundersIn(data, c.id).some((f) => f.chiiId === data.canvas.links[u.canvasId]?.chiiId)).length} / ${foundersIn(data, c.id).length}`, icon: Users, hint: 'By the email they use on Canvas' },
          { label: 'Unmatched users', value: unmatched.length, icon: UserX, hint: unmatched.length ? 'Match or dismiss below' : 'Everyone matched' },
          { label: 'Canvas items mapped', value: mapped, display: `${mapped} / ${items.length}`, icon: Link2, hint: 'Assignments and quizzes' },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <Courses key={c.id} c={c} me={me} />
          <Panel title="Unmatched Canvas users" sub="People enrolled on Canvas whose email isn’t on a CHII record">
            {unmatched.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">Everyone on the course is matched to a CHII ID.</p>
            ) : (
              <ul className="divide-y divide-line">
                {unmatched.map((u) => (
                  <Unmatched key={u.canvasId} u={u} c={c} data={data} me={me} />
                ))}
              </ul>
            )}
          </Panel>
          <p className="flex items-start gap-2 text-xs leading-5 text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-good" />
            The CHII ID never goes to Canvas (not as an SIS ID, nor in any field learners can see). Canvas user IDs are stored on the CHII side, matched by email or by staff.
          </p>
        </div>
        <Mapping key={c.id} c={c} data={data} me={me} />
      </div>
      <Panel title="Sync log" sub="Every run, with what it read and wrote. Running again the same day adds no duplicates.">
        {runs.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">No syncs yet for this cohort.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <Th>Finished</Th>
                  <Th>Run by</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Rows read</Th>
                  <Th className="text-right">Written</Th>
                  <Th className="text-right">Unmatched</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.slice(0, 12).map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{when(r.finishedAt)}</Td>
                    <Td>{r.by}</Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'ok' ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'}`}>{r.status === 'ok' ? 'Finished' : 'Failed'}</span>
                    </Td>
                    <Td className="text-right tabular-nums">{r.read}</Td>
                    <Td className="text-right tabular-nums">{r.written}</Td>
                    <Td className="text-right tabular-nums">{r.unmatched}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}

function Courses({ c, me }: { c: Cohort; me: string }) {
  const [mode, setMode] = useState(c.canvas.mode)
  const [courses, setCourses] = useState(c.canvas.courses)
  return (
    <Panel title="Canvas course" sub="One course for all of Expose, or one per module">
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <Chip on={mode === 'one'} onClick={() => setMode('one')}>
            One course
          </Chip>
          <Chip on={mode === 'per_module'} onClick={() => setMode('per_module')}>
            One per module
          </Chip>
        </div>
        {mode === 'one' ? (
          <input value={courses.all ?? ''} onChange={(e) => setCourses({ all: e.target.value })} placeholder="Canvas course ID" aria-label="Canvas course ID" className={inputCls} />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {EXPOSE_MODULES.map((m) => (
              <input key={m} value={courses[m] ?? ''} onChange={(e) => setCourses({ ...courses, [m]: e.target.value })} placeholder={`${m} course ID`} aria-label={`${m} course ID`} className={inputCls} />
            ))}
          </div>
        )}
        <Button className="h-8 text-xs" onClick={() => (setCanvasCourses(c.id, { mode, courses }, me), toast({ title: 'Canvas course saved', body: c.name, tone: 'good' }))}>
          Save course
        </Button>
      </div>
    </Panel>
  )
}

function Unmatched({ u, c, data, me }: { u: { canvasId: string; name: string; email: string }; c: Cohort; data: IncubationData; me: string }) {
  const linked = new Set(Object.values(data.canvas.links).map((l) => l.chiiId))
  const free = foundersIn(data, c.id).filter((f) => !linked.has(f.chiiId))
  const [pick, setPick] = useState('')
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{u.name}</span>
        <span className="block text-xs text-muted">
          {u.email} · Canvas user {u.canvasId}
        </span>
      </span>
      <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Founder" className="h-8 rounded-md border border-line-strong bg-surface px-2 text-xs">
        <option value="">Match to a founder…</option>
        {free.map((f) => (
          <option key={f.chiiId} value={f.chiiId}>
            {nameOf(f.chiiId)} · {f.chiiId}
          </option>
        ))}
      </select>
      <span className="flex gap-1.5">
        <Button className="h-8 text-xs" onClick={() => pick && (matchCanvasUser(c.id, u.canvasId, pick, me), toast({ title: 'Matched', body: `${u.name} → ${pick}. Their work comes in on the next sync.`, tone: 'good' }))}>
          Match
        </Button>
        <Button className="h-8 text-xs" onClick={() => (ignoreCanvasUser(c.id, u.canvasId, me), toast({ title: 'Dismissed', body: `${u.name} isn’t a founder; the sync will skip them.`, tone: 'info' }))}>
          Not a founder
        </Button>
      </span>
    </li>
  )
}

function Mapping({ c, data, me }: { c: Cohort; data: IncubationData; me: string }) {
  const items = useMemo(() => canvasAssignments(data, c), [data, c])
  const saved = data.canvas.mapping[c.id] ?? {}
  const [map, setMap] = useState<Record<string, string>>(saved)
  useEffect(() => setMap(data.canvas.mapping[c.id] ?? {}), [c.id])
  const dirty = JSON.stringify(map) !== JSON.stringify(saved)
  const options = data.curriculum.assessments.filter((a) => a.kind !== 'gate_portfolio')
  const used = Object.values(map)
  return (
    <Panel
      title="Assignment mapping"
      sub="Which Canvas assignment or quiz is which assessment. Set once per cohort."
      headerRight={
        <span className="flex gap-1.5">
          <button type="button" onClick={() => setMap(suggestMapping(data, c))} className="inline-flex h-7 items-center gap-1 rounded-md bg-white/10 px-2 text-[11px] font-semibold text-white hover:bg-white/20">
            <Wand2 className="h-3.5 w-3.5" /> Suggest from names
          </button>
        </span>
      }
    >
      <div className="max-h-[560px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-line bg-canvas">
            <tr>
              <Th>Canvas item</Th>
              <Th>Due</Th>
              <Th>Assessment</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((x) => (
              <tr key={x.id}>
                <Td>
                  <span className="block text-[13px] text-ink">{x.name}</span>
                  <span className="font-mono text-[11px] text-muted">#{x.id}</span>
                </Td>
                <Td className="whitespace-nowrap text-xs text-body">{fmtDate(x.dueAt)}</Td>
                <Td>
                  <select
                    value={map[x.id] ?? ''}
                    onChange={(e) => setMap({ ...map, [x.id]: e.target.value })}
                    aria-label={`Assessment for ${x.name}`}
                    className={`h-8 w-full min-w-[180px] rounded-md border bg-surface px-2 text-xs ${map[x.id] ? 'border-line-strong text-ink' : 'border-dashed border-warn text-warn'}`}
                  >
                    <option value="">Not mapped</option>
                    {options.map((a) => (
                      <option key={a.code} value={a.code} disabled={used.includes(a.code) && map[x.id] !== a.code}>
                        {a.code} · {assessmentName(data.curriculum, a.code)}
                      </option>
                    ))}
                  </select>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <span className="text-xs text-muted">
          {Object.values(map).filter(Boolean).length} of {items.length} mapped{dirty ? ' · unsaved changes' : ''}
        </span>
        <Button
          variant="primary"
          className="ml-auto h-8 text-xs"
          onClick={() => {
            try {
              setMapping(c.id, map, me)
              toast({ title: 'Mapping saved', body: 'The next sync uses it.', tone: 'good' })
            } catch (e) {
              toast({ title: 'Not saved', body: e instanceof IncubationError ? e.message : '', tone: 'bad' })
            }
          }}
        >
          <Sparkles className="h-3.5 w-3.5" /> Save mapping
        </Button>
      </div>
    </Panel>
  )
}
