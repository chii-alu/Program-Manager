/** Incubation → Cohorts: every intake round of every stage, and "New cohort" (Expose gets its 40 sessions). */
import React, { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, GraduationCap, Plus, Rocket, Users } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { StatCards } from '../shared/components/StatStrip'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { EmptyState } from '../shared/components/EmptyState'
import { toast } from '../shared/lib/notify'
import { EXPOSE_MODULES, SESSIONS_PER_MODULE } from '../shared/incubation/curriculum'
import { TODAY, cohortPhase, foundersIn, gateReady, moduleStatus, trackComplete, type CohortPhase } from '../shared/incubation/progress'
import { IncubationError, createCohort, scheduleDates } from '../shared/incubation/store'
import { GATE_LABEL, STAGE_LABEL, type Cohort, type IncStage, type IncubationData } from '../shared/incubation/types'
import { Chip, Field, Note, PhasePill, StagePill, Td, Th, fmtDate, inputCls, pct } from './parts'

export function cohortSummary(d: IncubationData, c: Cohort) {
  const fs = foundersIn(d, c.id)
  const phase = cohortPhase(d, c)
  const ventures = new Set(fs.map((f) => f.ventureId).filter(Boolean)).size
  // Share of module places finished (completed or exempt), out of the modules that have started.
  let done = 0
  let started = 0
  for (const f of fs)
    for (const m of c.stage === 'expose' ? EXPOSE_MODULES : []) {
      const s = moduleStatus(d, c, f.chiiId, m)
      if (s !== 'not_started') started++
      if (s === 'completed' || s === 'exempt') done++
    }
  const complete = fs.filter((f) => trackComplete(d, c, f.chiiId)).length
  const gate = d.gate.filter((g) => g.cohortId === c.id)
  const waiting = new Set(fs.filter((f) => gateReady(d, c, f.chiiId) && !gate.some((g) => (f.ventureId ? g.ventureId === f.ventureId : g.chiiId === f.chiiId))).map((f) => f.ventureId ?? f.chiiId)).size
  return { founders: fs.length, ventures, phase, moduleShare: started ? done / started : null, complete, gate, waiting }
}

export function CohortsPage({ data, me, onOpen }: { data: IncubationData; me: string; onOpen: (id: string) => void }) {
  const [creating, setCreating] = useState(false)
  const [stage, setStage] = useState<'all' | IncStage>('all')
  const rows = useMemo(
    () =>
      data.cohorts
        .filter((c) => stage === 'all' || c.stage === stage)
        .map((c) => ({ c, s: cohortSummary(data, c) }))
        .sort((a, b) => b.c.startsOn.localeCompare(a.c.startsOn)),
    [data, stage],
  )
  const all = data.cohorts.map((c) => cohortSummary(data, c))
  const running = all.filter((s) => s.phase === 'running')
  const toBuild = data.gate.filter((g) => g.decision === 'build').length

  return (
    <>
      <PageHeader
        crumbs={['HENT', 'Incubator', 'Cohorts']}
        title="Incubator Cohorts"
        description="Expose → Build → Scale. Each cohort is one intake round of one stage; Expose cohorts follow the 40-session curriculum."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New cohort
          </Button>
        }
      />
      <StatCards
        items={[
          { label: 'Cohorts running', value: running.length, icon: GraduationCap, hint: `${data.cohorts.length} in all` },
          { label: 'Founders', value: new Set(data.founders.filter((f) => f.status === 'enrolled').map((f) => f.chiiId)).size, icon: Users, hint: 'Each assessed individually' },
          { label: 'Ventures', value: new Set(data.founders.map((f) => f.ventureId).filter(Boolean)).size, icon: Rocket, hint: 'Linked to the Venture Registry' },
          { label: 'Gate: to Build', value: toBuild, icon: ArrowRight, hint: `${all.reduce((n, s) => n + s.waiting, 0)} waiting for a decision` },
        ]}
      />
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {(['all', 'expose', 'build', 'scale'] as const).map((k) => (
            <Chip key={k} on={stage === k} onClick={() => setStage(k)}>
              {k === 'all' ? 'All stages' : STAGE_LABEL[k]}
            </Chip>
          ))}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No cohorts here yet" body={stage === 'all' ? 'Create the first cohort. Expose cohorts get their 40 sessions from the curriculum.' : `No ${STAGE_LABEL[stage as IncStage]} cohorts yet.`} action={{ label: 'New cohort', onClick: () => setCreating(true) }} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <Th>Cohort</Th>
                  <Th>Stage</Th>
                  <Th>Dates</Th>
                  <Th className="text-right">Founders</Th>
                  <Th>Modules finished</Th>
                  <Th>Gate outcomes</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ c, s }) => (
                  <tr key={c.id} className="hover:bg-canvas/60">
                    <Td>
                      <button type="button" onClick={() => onOpen(c.id)} className="text-left">
                        <span className="block whitespace-nowrap font-semibold text-ink hover:text-brand-600 hover:underline">{c.name}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                          <PhasePill phase={s.phase} />
                          {c.stage === 'expose' ? `${data.sessions.filter((x) => x.cohortId === c.id).length} sessions` : 'No curriculum yet'}
                        </span>
                      </button>
                    </Td>
                    <Td>
                      <StagePill stage={c.stage} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-body">
                      {fmtDate(c.startsOn)} – {c.endsOn ? fmtDate(c.endsOn) : 'dates to set'}
                    </Td>
                    <Td className="text-right tabular-nums">
                      <b className="font-semibold text-ink">{s.founders}</b>
                      <span className="block text-xs text-muted">{s.ventures} venture{s.ventures === 1 ? '' : 's'}</span>
                    </Td>
                    <Td>
                      {s.moduleShare == null ? (
                        <span className="text-xs text-muted">{s.phase === 'upcoming' ? 'Not started' : '—'}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-canvas">
                            <div className="h-full rounded-full bg-brand-600" style={{ width: pct(s.moduleShare) }} />
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-ink">{pct(s.moduleShare)}</span>
                          {s.phase === 'completed' && <span className="text-xs text-muted">· {s.complete} finished the track</span>}
                        </div>
                      )}
                    </Td>
                    <Td className="text-xs">
                      <GateSummary s={s} />
                    </Td>
                    <Td className="text-right">
                      <button type="button" onClick={() => onOpen(c.id)} className="inline-flex h-8 items-center gap-1 rounded-md border border-line-strong px-3 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                        Open <ArrowRight className="h-3 w-3" />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <NewCohort open={creating} onClose={() => setCreating(false)} data={data} me={me} onCreated={(id) => (setCreating(false), onOpen(id))} />
    </>
  )
}

function GateSummary({ s }: { s: ReturnType<typeof cohortSummary> }) {
  if (!s.gate.length && !s.waiting) return <span className="text-muted">—</span>
  const by = Object.entries(s.gate.reduce<Record<string, number>>((a, g) => ((a[g.decision] = (a[g.decision] ?? 0) + 1), a), {}))
  return (
    <span className="flex flex-wrap gap-1">
      {by.map(([k, n]) => (
        <span key={k} className={`rounded-full px-2 py-0.5 font-semibold ${k === 'build' ? 'bg-good-bg text-good' : 'bg-canvas text-body'}`}>
          {n} {GATE_LABEL[k as keyof typeof GATE_LABEL]}
        </span>
      ))}
      {s.waiting > 0 && <span className="rounded-full bg-warn-bg px-2 py-0.5 font-semibold text-warn">{s.waiting} waiting</span>}
    </span>
  )
}

/* ---------- New cohort ---------- */

function nextName(d: IncubationData, stage: IncStage) {
  const year = Number(TODAY.slice(0, 4)) + 1
  for (const letter of 'ABCDEF') {
    const name = `Incubator ${year} ${letter}: ${STAGE_LABEL[stage]}`
    if (!d.cohorts.some((c) => c.name === name)) return name
  }
  return ''
}

function NewCohort({ open, onClose, data, me, onCreated }: { open: boolean; onClose: () => void; data: IncubationData; me: string; onCreated: (id: string) => void }) {
  const [stage, setStage] = useState<IncStage>('expose')
  const [name, setName] = useState(() => nextName(data, 'expose'))
  const [startsOn, setStartsOn] = useState(`${Number(TODAY.slice(0, 4)) + 1}-02-02`)
  const [fillDates, setFillDates] = useState(true)
  const [threshold, setThreshold] = useState(75)
  const [canvasMode, setCanvasMode] = useState<'one' | 'per_module'>('one')
  const [courses, setCourses] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const sessions = stage === 'expose' ? data.curriculum.sessions.length : 0
  const dates = fillDates && startsOn && sessions ? scheduleDates(startsOn, sessions) : []

  const pickStage = (s: IncStage) => {
    if (!name || name === nextName(data, stage)) setName(nextName(data, s))
    setStage(s)
  }
  const save = () => {
    try {
      const c = createCohort({ name, stage, startsOn, fillDates, threshold: threshold / 100, canvas: { mode: canvasMode, courses } }, me)
      toast({ title: 'Cohort created', body: sessions ? `${c.name}: ${sessions} sessions from the curriculum` : c.name, tone: 'good' })
      setError('')
      onCreated(c.id)
    } catch (e) {
      setError(e instanceof IncubationError ? e.message : 'Couldn’t create the cohort.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New incubation cohort"
      icon={<Plus className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Create cohort
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Stage" required>
          <div className="flex flex-wrap gap-2">
            {(['expose', 'build', 'scale'] as IncStage[]).map((s) => (
              <Chip key={s} on={stage === s} onClick={() => pickStage(s)}>
                {STAGE_LABEL[s]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Cohort name" required hint="Year, intake letter and stage, e.g. “Incubator 2027 A: Expose”.">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts on" required>
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Module completion threshold" hint={`Attend at least this share of a module’s ${SESSIONS_PER_MODULE} sessions, and hand in its final brief.`}>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={`${inputCls} w-24`} />
              <span className="text-sm text-muted">% ({Math.ceil((threshold / 100) * SESSIONS_PER_MODULE)} of {SESSIONS_PER_MODULE} sessions)</span>
            </div>
          </Field>
        </div>
        {stage === 'expose' ? (
          <div className="rounded-lg border border-line p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarDays className="h-4 w-4 text-brand-600" /> Creates {sessions} sessions from the Expose curriculum ({data.curriculum.version})
            </p>
            <p className="mt-1 text-xs text-muted">I1 S01 to I4 S10, with titles from the curriculum. You can change any date afterwards on the cohort’s Curriculum tab.</p>
            <label className="mt-2.5 flex items-center gap-2 text-[13px] text-body">
              <input type="checkbox" checked={fillDates} onChange={(e) => setFillDates(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              Fill in dates: Monday, Wednesday and Friday from the start date
            </label>
            {dates.length > 0 && (
              <p className="mt-1.5 text-xs text-muted">
                I1 S01 on {fmtDate(dates[0])}; I4 S10 on {fmtDate(dates[dates.length - 1])}.
              </p>
            )}
          </div>
        ) : (
          <Note>{STAGE_LABEL[stage]} has no curriculum yet, so the cohort starts with no sessions. Founders join it from the gate; sessions can be added once the {STAGE_LABEL[stage]} curriculum is written.</Note>
        )}
        <Field label="Canvas course" hint="Delivery happens on Canvas; MELA pulls enrolments, submissions and scores from it. You can add this later under Canvas sync.">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Chip on={canvasMode === 'one'} onClick={() => setCanvasMode('one')}>
                One course for all modules
              </Chip>
              <Chip on={canvasMode === 'per_module'} onClick={() => setCanvasMode('per_module')}>
                One course per module
              </Chip>
            </div>
            {canvasMode === 'one' ? (
              <input value={courses.all ?? ''} onChange={(e) => setCourses({ all: e.target.value })} placeholder="Canvas course ID, e.g. 8841" className={inputCls} />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {EXPOSE_MODULES.map((m) => (
                  <input key={m} value={courses[m] ?? ''} onChange={(e) => setCourses({ ...courses, [m]: e.target.value })} placeholder={`${m} course ID`} className={inputCls} />
                ))}
              </div>
            )}
          </div>
        </Field>
        {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
      </div>
    </Modal>
  )
}

export type { CohortPhase }
