/**
 * One incubation cohort: Founders | Curriculum | Assessments | Exemptions | Checks (addendum §7).
 */
import React, { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Camera, CheckCircle2, ClipboardCheck, Plus, Search, Settings2, Trash2, UserMinus, Users } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { StatCards } from '../shared/components/StatStrip'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { EmptyState } from '../shared/components/EmptyState'
import { toast } from '../shared/lib/notify'
import { useRegistry } from '../shared/ventures/store'
import { EXPOSE_MODULES, SESSIONS_PER_MODULE, moduleLabel } from '../shared/incubation/curriculum'
import {
  DQ_RULES,
  MODULE_STATUS_LABEL,
  TODAY,
  attendance,
  cohortPhase,
  cohortSessions,
  dqIssues,
  foundersIn,
  gateOf,
  gateReady,
  held,
  moduleMean,
  moduleStatus,
  onTimeShare,
  resultOf,
  resultScore,
  skillsGain,
  trackComplete,
} from '../shared/incubation/progress'
import { IncubationError, addFounders, candidateFounders, deleteCohort, recordSnapshot, snapshotsOf, updateCohort, updateFounder } from '../shared/incubation/store'
import { GATE_LABEL, PATHWAYS, PATHWAY_LABEL, STAGE_LABEL, type Cohort, type Founder, type IncubationData, type Pathway } from '../shared/incubation/types'
import { CurriculumTab } from './CohortSessions'
import { Gradebook } from './Gradebook'
import { ExemptionsTab } from './Exemptions'
import { Chip, Field, ModuleChip, ModuleLegend, Note, PhasePill, Person, StagePill, Tabs, Td, Th, fmtDate, inputCls, nameOf, one, pct } from './parts'

export type CohortTab = 'founders' | 'curriculum' | 'assessments' | 'exemptions' | 'checks'

export function CohortPage({
  data,
  cohortId,
  tab,
  onTab,
  me,
  onBack,
  onNavigate,
  onOpenPerson,
}: {
  data: IncubationData
  cohortId: string
  tab: CohortTab
  onTab: (t: CohortTab) => void
  me: string
  onBack: () => void
  onNavigate?: (to: string) => void
  onOpenPerson?: (id: string) => void
}) {
  const c = data.cohorts.find((x) => x.id === cohortId)!
  const fs = foundersIn(data, c.id)
  const phase = cohortPhase(data, c)
  const ss = cohortSessions(data, c.id)
  const past = ss.filter((s) => held(s.date))
  const issues = dqIssues(data).filter((x) => x.cohortId === c.id)
  const pending = data.exemptions.filter((e) => e.cohortId === c.id && e.decision === 'pending').length
  const att = fs.map((f) => attendance(data, c, f.chiiId).pct).filter((x): x is number => x != null)
  const ot = fs.map((f) => onTimeShare(data, c, f.chiiId).pct).filter((x): x is number => x != null)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const [settings, setSettings] = useState(false)

  return (
    <>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> All cohorts
      </button>
      <PageHeader
        crumbs={['HENT', 'Incubator', 'Cohorts', c.name]}
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StagePill stage={c.stage} onDark />
            <PhasePill phase={phase} onDark />
            <span>
              {fmtDate(c.startsOn)} – {c.endsOn ? fmtDate(c.endsOn) : 'dates to set'} · completion: {Math.round(c.threshold * 100)}% of sessions + final brief
            </span>
          </span>
        }
        actions={
          <Button onClick={() => setSettings(true)}>
            <Settings2 className="h-4 w-4" /> Cohort settings
          </Button>
        }
      />
      <StatCards
        columns={4}
        items={[
          { label: 'Founders', value: fs.length, icon: Users, hint: `${new Set(fs.map((f) => f.ventureId).filter(Boolean)).size} ventures` },
          { label: 'Sessions held', value: past.length, display: `${past.length} / ${ss.length || '—'}`, icon: CalendarDays, hint: c.stage === 'expose' ? `${past.filter((s) => !s.delivery).length} without a delivery log` : 'No curriculum yet' },
          { label: 'Attendance', value: 0, display: pct(avg(att)), icon: CheckCircle2, hint: 'Average, sessions held so far' },
          { label: 'Work on time', value: 0, display: pct(avg(ot)), icon: ClipboardCheck, hint: 'Of assignments and briefs due so far' },
        ]}
      />
      <Panel>
        <Tabs
          value={tab}
          onChange={onTab}
          tabs={[
            ['founders', 'Founders', fs.length],
            ['curriculum', 'Curriculum', ss.length],
            ['assessments', 'Assessments'],
            ['exemptions', 'Exemptions', pending || undefined],
            ['checks', 'Data checks', issues.length],
          ]}
        />
        {tab === 'founders' && <FoundersTab data={data} c={c} me={me} onOpenPerson={onOpenPerson} onNavigate={onNavigate} />}
        {tab === 'curriculum' && <CurriculumTab data={data} c={c} me={me} />}
        {tab === 'assessments' && <Gradebook data={data} c={c} me={me} />}
        {tab === 'exemptions' && <ExemptionsTab data={data} c={c} me={me} />}
        {tab === 'checks' && <ChecksTab data={data} c={c} />}
      </Panel>
      <CohortSettings open={settings} onClose={() => setSettings(false)} c={c} data={data} me={me} onDeleted={onBack} />
    </>
  )
}

/* ---------- Founders ---------- */

function FoundersTab({ data, c, me, onOpenPerson, onNavigate }: { data: IncubationData; c: Cohort; me: string; onOpenPerson?: (id: string) => void; onNavigate?: (to: string) => void }) {
  const reg = useRegistry()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const venture = (id?: string) => reg.ventures.find((v) => v.id === id)
  const fs = foundersIn(data, c.id).filter((f) => !q.trim() || `${nameOf(f.chiiId)} ${f.chiiId} ${venture(f.ventureId)?.name ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const withdrawn = foundersIn(data, c.id, true).filter((f) => f.status === 'withdrawn')
  const open = data.founders.find((f) => f.cohortId === c.id && f.chiiId === openId)

  return (
    <>
      <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search founder, CHII ID or venture" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
        </label>
        {c.stage === 'expose' && <ModuleLegend />}
        <Button className="sm:ml-auto" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add founders
        </Button>
      </div>
      {fs.length === 0 ? (
        <EmptyState icon={Users} title={q ? 'No founders match' : 'No founders yet'} body={q ? 'Try another search.' : 'Add the founders selected for this cohort. Each one is linked to their venture in the registry.'} action={q ? undefined : { label: 'Add founders', onClick: () => setAdding(true) }} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <Th>Founder</Th>
                <Th>Venture</Th>
                {c.stage === 'expose' && <Th>Modules</Th>}
                <Th className="text-right">Attendance</Th>
                <Th className="text-right">On time</Th>
                <Th className="text-right">Skills gain</Th>
                <Th>Gate</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {fs.map((f) => {
                const a = attendance(data, c, f.chiiId)
                const o = onTimeShare(data, c, f.chiiId)
                const g = skillsGain(data, c.id, f.chiiId, 'QUIZ')
                const gate = gateOf(data, c.id, f)
                const v = venture(f.ventureId)
                return (
                  <tr key={f.chiiId} className="hover:bg-canvas/60">
                    <Td>
                      <Person chiiId={f.chiiId} onOpen={() => setOpenId(f.chiiId)} />
                    </Td>
                    <Td>
                      {v ? (
                        <>
                          <span className="block max-w-[200px] truncate font-medium text-ink">{v.name}</span>
                          <span className="block text-xs text-muted">{f.pathway ? PATHWAY_LABEL[f.pathway] : 'Pathway not set'}</span>
                        </>
                      ) : (
                        <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn">No venture linked</span>
                      )}
                    </Td>
                    {c.stage === 'expose' && (
                      <Td>
                        <span className="flex gap-1">
                          {EXPOSE_MODULES.map((m) => (
                            <ModuleChip key={m} code={m} status={moduleStatus(data, c, f.chiiId, m)} />
                          ))}
                        </span>
                      </Td>
                    )}
                    <Td className="text-right tabular-nums">
                      <b className={`font-semibold ${a.pct != null && a.pct < c.threshold ? 'text-bad' : 'text-ink'}`}>{pct(a.pct)}</b>
                      <span className="block text-xs text-muted">
                        {a.attended} of {a.held}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      <b className="font-semibold text-ink">{pct(o.pct)}</b>
                      <span className="block text-xs text-muted">
                        {o.onTime} of {o.due} due
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {g ? (
                        <>
                          <b className={`font-semibold ${g.gain > 0 ? 'text-good' : g.gain < 0 ? 'text-bad' : 'text-ink'}`}>
                            {g.gain > 0 ? '+' : ''}
                            {g.gain}
                          </b>
                          <span className="block text-xs text-muted">
                            quiz {g.intake} → {g.end}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted">Needs both quizzes</span>
                      )}
                    </Td>
                    <Td>
                      {gate ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${gate.decision === 'build' ? 'bg-good-bg text-good' : 'bg-canvas text-body'}`}>{GATE_LABEL[gate.decision]}</span>
                      ) : gateReady(data, c, f.chiiId) ? (
                        <button type="button" onClick={() => onNavigate?.('incubation-gate')} className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn hover:underline">
                          Waiting
                        </button>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <button type="button" onClick={() => setOpenId(f.chiiId)} className="inline-flex h-8 items-center rounded-md border border-line-strong px-3 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                        Open
                      </button>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {withdrawn.length > 0 && (
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          Withdrawn: {withdrawn.map((f) => `${nameOf(f.chiiId)} (${f.chiiId})`).join(', ')}
        </p>
      )}
      <AddFounders open={adding} onClose={() => setAdding(false)} data={data} c={c} me={me} />
      <Modal open={!!open} onClose={() => setOpenId(null)} size="lg" title={open ? `${nameOf(open.chiiId)} · ${open.chiiId}` : ''} icon={<Users className="h-4 w-4" />}>
        {open && <FounderView key={open.chiiId} data={data} c={c} f={open} me={me} ventureName={venture(open.ventureId)?.name} onOpenPerson={onOpenPerson} onClose={() => setOpenId(null)} />}
      </Modal>
    </>
  )
}

function FounderView({ data, c, f, me, ventureName, onOpenPerson, onClose }: { data: IncubationData; c: Cohort; f: Founder; me: string; ventureName?: string; onOpenPerson?: (id: string) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    pathway: f.pathway ?? '',
    originalIdea: f.originalIdea ?? '',
    ideaChanged: f.ideaChanged == null ? '' : f.ideaChanged ? 'yes' : 'no',
    ideaChangedWhy: f.ideaChangedWhy ?? '',
    stakeholders: f.stakeholders == null ? '' : String(f.stakeholders),
    observationType: f.observationType ?? '',
    permissionsRecorded: f.permissionsRecorded == null ? '' : f.permissionsRecorded ? 'yes' : 'no',
  })
  const [error, setError] = useState('')
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })
  const yn = (v: string) => (v === '' ? undefined : v === 'yes')
  const save = () => {
    try {
      updateFounder(
        c.id,
        f.chiiId,
        {
          pathway: (form.pathway || undefined) as Pathway | undefined,
          originalIdea: form.originalIdea || undefined,
          ideaChanged: yn(form.ideaChanged),
          ideaChangedWhy: form.ideaChangedWhy || undefined,
          stakeholders: form.stakeholders === '' ? undefined : Number(form.stakeholders),
          observationType: (form.observationType || undefined) as Founder['observationType'],
          permissionsRecorded: yn(form.permissionsRecorded),
        },
        me,
      )
      toast({ title: 'Founder details saved', body: nameOf(f.chiiId), tone: 'good' })
      setError('')
    } catch (e) {
      setError(e instanceof IncubationError ? e.message : 'Couldn’t save.')
    }
  }
  const snapDate = data.sessions.find((s) => s.cohortId === c.id && s.moduleCode === 'I4' && s.no === SESSIONS_PER_MODULE)?.date ?? TODAY
  const snaps = f.ventureId ? snapshotsOf(f.ventureId) : []
  const quiz = (code: string) => resultScore(resultOf(data, c.id, code, f.chiiId))
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Venture:</span> <b className="font-semibold text-ink">{ventureName ?? 'Not linked'}</b>
        {trackComplete(data, c, f.chiiId) && <span className="rounded-full bg-good-bg px-2 py-0.5 text-xs font-semibold text-good">Track complete</span>}
        {onOpenPerson && (
          <button type="button" onClick={() => onOpenPerson(f.chiiId)} className="ml-auto text-xs font-semibold text-brand-600 hover:underline">
            Open person’s journey →
          </button>
        )}
      </div>
      {c.stage === 'expose' && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas/60">
              <tr>
                <Th>Module</Th>
                <Th>Status</Th>
                <Th className="text-right">Attended</Th>
                <Th>Final brief</Th>
                <Th className="text-right">Mean rubric</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {EXPOSE_MODULES.map((m) => {
                const st = moduleStatus(data, c, f.chiiId, m)
                const mss = data.sessions.filter((s) => s.cohortId === c.id && s.moduleCode === m)
                const heldN = mss.filter((s) => held(s.date)).length
                const brief = resultOf(data, c.id, `${m}-FINAL`, f.chiiId)
                return (
                  <tr key={m}>
                    <Td className="max-w-[260px] truncate font-semibold text-ink">{moduleLabel(data.curriculum, m)}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <ModuleChip code={m} status={st} /> <span className="text-xs text-body">{MODULE_STATUS_LABEL[st]}</span>
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {st === 'exempt' ? '—' : `${mss.filter((s) => held(s.date) && s.present.includes(f.chiiId)).length} of ${heldN}`}
                    </Td>
                    <Td className="text-xs">{st === 'exempt' ? 'Exempt' : brief?.submittedAt ? `Handed in ${fmtDate(brief.submittedAt)}` : 'Not yet'}</Td>
                    <Td className="text-right tabular-nums">{one(moduleMean(data, c.id, f.chiiId, m))}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted">Skills quiz (out of 20)</p>
          <p className="mt-1 text-sm text-ink">
            Intake <b>{quiz('QUIZ-intake') ?? '—'}</b> · end of I1 <b>{quiz('QUIZ-end_i1') ?? '—'}</b> · end of I4 <b>{quiz('QUIZ-end_i4') ?? '—'}</b>
          </p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted">Confidence (1–5)</p>
          <p className="mt-1 text-sm text-ink">
            Intake <b>{quiz('CONF-intake') ?? '—'}</b> · end of I4 <b>{quiz('CONF-end_i4') ?? '—'}</b>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[13px] font-bold text-ink">Founder questions</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pathway">
            <select value={form.pathway} onChange={set('pathway')} className={inputCls}>
              <option value="">Not set</option>
              {PATHWAYS.map((p) => (
                <option key={p} value={p}>
                  {PATHWAY_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stakeholders spoken to">
            <input type="number" min={0} value={form.stakeholders} onChange={set('stakeholders')} className={inputCls} />
          </Field>
        </div>
        <Field label="Original idea">
          <textarea rows={2} value={form.originalIdea} onChange={set('originalIdea')} className={`${inputCls} h-auto py-2`} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Has the idea changed?">
            <select value={form.ideaChanged} onChange={set('ideaChanged')} className={inputCls}>
              <option value="">Not answered</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Observation">
            <select value={form.observationType} onChange={set('observationType')} className={inputCls}>
              <option value="">Not answered</option>
              <option value="real">Real</option>
              <option value="simulated">Simulated</option>
              <option value="anonymised case">Anonymised case</option>
            </select>
          </Field>
          <Field label="Permissions recorded?">
            <select value={form.permissionsRecorded} onChange={set('permissionsRecorded')} className={inputCls}>
              <option value="">Not answered</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>
        {form.ideaChanged === 'yes' && (
          <Field label="Why did it change?">
            <textarea rows={2} value={form.ideaChangedWhy} onChange={set('ideaChangedWhy')} className={`${inputCls} h-auto py-2`} />
          </Field>
        )}
        {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
      </div>

      {f.ventureId && c.stage === 'expose' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
          <Camera className="h-5 w-5 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-ink">I4 evidence snapshot</p>
            <p className="text-xs text-muted">{snaps.length ? `Recorded: ${snaps.map((s) => fmtDate(s.asOf)).join(', ')}. Adds a dated update to the venture; earlier updates stay as they are.` : 'Adds a dated update to the venture in the registry, copied from its latest figures. Earlier updates stay as they are.'}</p>
          </div>
          <Button
            onClick={() => {
              try {
                recordSnapshot(c.id, f.ventureId!, snapDate, me)
                toast({ title: 'Snapshot recorded', body: `${ventureName} · as of ${fmtDate(snapDate)}`, tone: 'good' })
              } catch (e) {
                toast({ title: 'Snapshot not recorded', body: e instanceof Error ? e.message : '', tone: 'bad' })
              }
            }}
          >
            Record snapshot ({fmtDate(snapDate)})
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button
          className="text-bad"
          onClick={() => {
            updateFounder(c.id, f.chiiId, { status: 'withdrawn' }, me)
            toast({ title: 'Marked as withdrawn', body: `${nameOf(f.chiiId)} stays in the records with their work so far.`, tone: 'warn' })
            onClose()
          }}
        >
          <UserMinus className="h-4 w-4" /> Withdrawn
        </Button>
        <span className="ml-auto" />
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      </div>
    </div>
  )
}

function AddFounders({ open, onClose, data, c, me }: { open: boolean; onClose: () => void; data: IncubationData; c: Cohort; me: string }) {
  const all = useMemo(() => (open ? candidateFounders() : []), [open])
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Record<string, Pathway | ''>>({})
  const inCohort = new Set(data.founders.filter((f) => f.cohortId === c.id).map((f) => f.chiiId))
  const inOther = (id: string) => data.founders.find((f) => f.chiiId === id && f.cohortId !== c.id && f.status === 'enrolled')
  const list = all.filter((x) => !inCohort.has(x.chiiId) && (!q.trim() || `${x.name} ${x.chiiId} ${x.venture ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 60)
  const ids = Object.keys(picked)
  const save = () => {
    try {
      addFounders(c.id, ids.map((id) => ({ chiiId: id, ventureId: all.find((x) => x.chiiId === id)?.ventureId, pathway: picked[id] || undefined })), me)
      toast({ title: `${ids.length} founder${ids.length === 1 ? '' : 's'} added`, body: c.name, tone: 'good' })
      setPicked({})
      onClose()
    } catch (e) {
      toast({ title: 'Not added', body: e instanceof Error ? e.message : '', tone: 'bad' })
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Add founders to ${c.name}`}
      description="Founders come from the Venture Registry (with their venture) and HENT participants. Each keeps their CHII ID; it’s never sent to Canvas."
      icon={<Plus className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Add {ids.length || ''} founder{ids.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, CHII ID or venture" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-brand-600" />
      </label>
      <ul className="max-h-[48vh] divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {list.map((x) => {
          const on = x.chiiId in picked
          const other = inOther(x.chiiId)
          return (
            <li key={x.chiiId} className={`flex items-center gap-3 px-3 py-2 ${on ? 'bg-brand-50/50' : ''}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  const next = { ...picked }
                  if (on) delete next[x.chiiId]
                  else next[x.chiiId] = ''
                  setPicked(next)
                }}
                aria-label={`Add ${x.name}`}
                className="h-4 w-4 accent-brand-600"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{x.name}</span>
                <span className="block truncate text-xs text-muted">
                  <span className="font-mono">{x.chiiId}</span> · {x.venture ?? 'No venture in the registry'}
                  {other && <span className="text-warn"> · in {data.cohorts.find((k) => k.id === other.cohortId)?.name}</span>}
                </span>
              </span>
              {on && (
                <select value={picked[x.chiiId]} onChange={(e) => setPicked({ ...picked, [x.chiiId]: e.target.value as Pathway })} aria-label="Pathway" className="h-8 rounded-md border border-line-strong bg-surface px-2 text-xs">
                  <option value="">Pathway…</option>
                  {PATHWAYS.map((p) => (
                    <option key={p} value={p}>
                      {PATHWAY_LABEL[p]}
                    </option>
                  ))}
                </select>
              )}
            </li>
          )
        })}
        {!list.length && <li className="px-3 py-6 text-center text-sm text-muted">No one matches.</li>}
      </ul>
    </Modal>
  )
}

/* ---------- Data checks ---------- */

function ChecksTab({ data, c }: { data: IncubationData; c: Cohort }) {
  const issues = dqIssues(data).filter((x) => x.cohortId === c.id)
  return (
    <div className="divide-y divide-line">
      {DQ_RULES.map((r) => {
        const hits = issues.filter((x) => x.code === r.code)
        return (
          <div key={r.code} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="w-16 shrink-0 font-mono text-xs font-semibold text-brand-600">{r.code}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{r.check}</p>
              {hits.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-body">
                  {hits.slice(0, 6).map((h, i) => (
                    <li key={i}>
                      {h.chiiId ? `${nameOf(h.chiiId)} (${h.chiiId}): ` : ''}
                      {h.message}
                    </li>
                  ))}
                  {hits.length > 6 && <li className="text-muted">and {hits.length - 6} more</li>}
                </ul>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${!hits.length ? 'bg-good-bg text-good' : r.severity === 'Critical' ? 'bg-bad-bg text-bad' : 'bg-warn-bg text-warn'}`}>
              {hits.length ? `${hits.length} ${r.severity.toLowerCase()}` : 'OK'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Settings ---------- */

function CohortSettings({ open, onClose, c, data, me, onDeleted }: { open: boolean; onClose: () => void; c: Cohort; data: IncubationData; me: string; onDeleted: () => void }) {
  const [name, setName] = useState(c.name)
  const [threshold, setThreshold] = useState(Math.round(c.threshold * 100))
  const hasFounders = data.founders.some((f) => f.cohortId === c.id)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cohort settings"
      icon={<Settings2 className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!name.trim() || threshold < 1 || threshold > 100) return toast({ title: 'Check the name and threshold', body: 'Threshold is 1–100%.', tone: 'bad' })
              updateCohort(c.id, { name: name.trim(), threshold: threshold / 100 }, me)
              toast({ title: 'Cohort saved', body: name, tone: 'good' })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Module completion threshold (%)" hint="Changing it re-works every founder’s module status.">
          <input type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={`${inputCls} w-28`} />
        </Field>
        <p className="text-xs text-muted">
          Stage: {STAGE_LABEL[c.stage]} · curriculum {c.curriculumVersion ?? 'none'} · Canvas courses are set under Canvas sync.
        </p>
        <div className="border-t border-line pt-3">
          {hasFounders ? (
            <Note>This cohort has founders, so it can’t be deleted. Mark founders as withdrawn instead.</Note>
          ) : (
            <Button
              className="text-bad"
              onClick={() => {
                deleteCohort(c.id, me)
                toast({ title: 'Cohort deleted', body: c.name, tone: 'warn' })
                onClose()
                onDeleted()
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete cohort
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export { Chip }
