/**
 * Incubation → Gate: the EBI Evidence Gate queue. After I4, CHII decides per venture: Build,
 * more ideation, another pathway (or withdrawn). One decision per venture per gate; "Build" places
 * the founders in a Build cohort once one exists, and the venture's registry track follows.
 */
import React, { useState } from 'react'
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, Clock, DoorOpen, Hourglass } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { StatCards } from '../shared/components/StatStrip'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { EmptyState } from '../shared/components/EmptyState'
import { toast } from '../shared/lib/notify'
import { useRegistry } from '../shared/ventures/store'
import { EXPOSE_MODULES, SESSIONS_PER_MODULE } from '../shared/incubation/curriculum'
import { TODAY, foundersIn, gateOf, gateReady, moduleMean, moduleStatus, resultOf, resultScore, trackComplete } from '../shared/incubation/progress'
import { IncubationError, decideGate, recordSnapshot, snapshotsOf } from '../shared/incubation/store'
import { GATE_LABEL, PATHWAY_LABEL, type Cohort, type Founder, type GateChoice, type IncubationData } from '../shared/incubation/types'
import { Field, ModuleChip, Note, Tabs, Td, Th, fmtDate, inputCls, nameOf, one } from './parts'

type Team = { key: string; cohort: Cohort; ventureId?: string; members: Founder[]; lead: Founder }

function teams(d: IncubationData): Team[] {
  const out: Team[] = []
  for (const c of d.cohorts.filter((x) => x.stage === 'expose')) {
    const fs = foundersIn(d, c.id).filter((f) => gateReady(d, c, f.chiiId))
    const groups = new Map<string, Founder[]>()
    for (const f of fs) groups.set(f.ventureId ?? f.chiiId, [...(groups.get(f.ventureId ?? f.chiiId) ?? []), f])
    for (const [k, members] of groups) out.push({ key: `${c.id}|${k}`, cohort: c, ventureId: members[0].ventureId, members, lead: members[0] })
  }
  return out
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

const CHOICE_CLS: Record<GateChoice, string> = { build: 'bg-good-bg text-good', more_ideation: 'bg-brand-50 text-brand-600', other_pathway: 'bg-canvas text-body', withdrawn: 'bg-canvas text-muted' }

export function GatePage({ data, me, onOpenCohort }: { data: IncubationData; me: string; onOpenCohort: (id: string) => void }) {
  const reg = useRegistry()
  const [tab, setTab] = useState<'waiting' | 'decided' | 'all'>('waiting')
  const [open, setOpen] = useState<string | null>(null)
  const all = teams(data)
  const decided = all.filter((t) => gateOf(data, t.cohort.id, t.lead))
  const waiting = all.filter((t) => !gateOf(data, t.cohort.id, t.lead))
  const rows = tab === 'waiting' ? waiting : tab === 'decided' ? decided : all
  const vName = (id?: string) => reg.ventures.find((v) => v.id === id)?.name
  const team = all.find((t) => t.key === open)
  const count = (k: GateChoice) => data.gate.filter((g) => g.decision === k).length

  return (
    <>
      <PageHeader crumbs={['HENT', 'Incubation', 'Gate']} title="EBI Evidence Gate" description="After I4, CHII decides for each venture: Build, more ideation, or another pathway. One decision per venture; it never changes their place in the Expose cohort." />
      <StatCards
        items={[
          { label: 'Waiting for a decision', value: waiting.length, icon: Hourglass, hint: 'Ventures that finished I4' },
          { label: 'To Build', value: count('build'), icon: ArrowRight },
          { label: 'More ideation', value: count('more_ideation'), icon: Clock },
          { label: 'Another pathway', value: count('other_pathway') + count('withdrawn'), icon: DoorOpen, hint: count('withdrawn') ? `${count('withdrawn')} withdrawn` : undefined },
        ]}
      />
      <Panel>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            ['waiting', 'Waiting', waiting.length],
            ['decided', 'Decided', decided.length],
            ['all', 'All', all.length],
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={DoorOpen} title={tab === 'waiting' ? 'No one is waiting' : 'No decisions yet'} body="Ventures appear here once their cohort’s last I4 session has passed, or a founder hands in the I4 final brief." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <Th>Venture</Th>
                  <Th>Cohort</Th>
                  <Th>Modules</Th>
                  <Th className="text-right">I4 brief</Th>
                  <Th className="text-right">Mean rubric</Th>
                  <Th className="text-right">Stakeholders</Th>
                  <Th>Decision</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((t) => {
                  const g = gateOf(data, t.cohort.id, t.lead)
                  const complete = t.members.filter((f) => trackComplete(data, t.cohort, f.chiiId)).length
                  return (
                    <tr key={t.key} className="align-top hover:bg-canvas/60">
                      <Td>
                        <span className="block font-semibold text-ink">{vName(t.ventureId) ?? nameOf(t.lead.chiiId)}</span>
                        <span className="block text-xs text-muted">
                          {t.members.map((f) => nameOf(f.chiiId)).join(', ')}
                          {t.lead.pathway ? ` · ${PATHWAY_LABEL[t.lead.pathway]}` : ''}
                        </span>
                      </Td>
                      <Td>
                        <button type="button" onClick={() => onOpenCohort(t.cohort.id)} className="whitespace-nowrap text-xs font-semibold text-brand-600 hover:underline">
                          {t.cohort.name}
                        </button>
                      </Td>
                      <Td>
                        {t.members.map((f) => (
                          <span key={f.chiiId} className="mb-1 flex gap-1">
                            {EXPOSE_MODULES.map((m) => (
                              <ModuleChip key={m} code={m} status={moduleStatus(data, t.cohort, f.chiiId, m)} />
                            ))}
                          </span>
                        ))}
                        {complete < t.members.length && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-warn">
                            <AlertTriangle className="h-3 w-3" /> {t.members.length - complete} not complete
                          </span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums">{one(mean(t.members.map((f) => resultScore(resultOf(data, t.cohort.id, 'I4-FINAL', f.chiiId)))))}</Td>
                      <Td className="text-right tabular-nums">{one(mean(t.members.flatMap((f) => EXPOSE_MODULES.map((m) => moduleMean(data, t.cohort.id, f.chiiId, m)))))}</Td>
                      <Td className="text-right tabular-nums">{t.members.reduce((n, f) => n + (f.stakeholders ?? 0), 0)}</Td>
                      <Td>
                        {g ? (
                          <>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CHOICE_CLS[g.decision]}`}>{GATE_LABEL[g.decision]}</span>
                            <span className="mt-1 block text-[11px] text-muted">
                              {g.decidedBy}, {fmtDate(g.decidedOn)}
                              {g.score != null ? ` · score ${g.score}` : ''}
                            </span>
                          </>
                        ) : (
                          <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-semibold text-warn">Waiting</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Button variant={g ? 'secondary' : 'primary'} className="h-8 text-xs" onClick={() => setOpen(t.key)}>
                          {g ? 'Change' : 'Decide'}
                        </Button>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Modal open={!!team} onClose={() => setOpen(null)} size="lg" title={team ? `Gate decision · ${vName(team.ventureId) ?? nameOf(team.lead.chiiId)}` : ''} description={team?.cohort.name} icon={<DoorOpen className="h-4 w-4" />}>
        {team && <DecisionForm key={team.key} data={data} t={team} me={me} ventureName={vName(team.ventureId)} onDone={() => setOpen(null)} />}
      </Modal>
    </>
  )
}

function DecisionForm({ data, t, me, ventureName, onDone }: { data: IncubationData; t: Team; me: string; ventureName?: string; onDone: () => void }) {
  const g = gateOf(data, t.cohort.id, t.lead)
  const builds = data.cohorts.filter((c) => c.stage === 'build')
  const [decision, setDecision] = useState<GateChoice | ''>(g?.decision ?? '')
  const [score, setScore] = useState(g?.score == null ? '' : String(g.score))
  const [decidedOn, setDecidedOn] = useState(g?.decidedOn ?? TODAY)
  const [next, setNext] = useState(g?.nextCohortId ?? '')
  const [notes, setNotes] = useState(g?.notes ?? '')
  const [error, setError] = useState('')
  const incomplete = t.members.filter((f) => !trackComplete(data, t.cohort, f.chiiId))
  const snapDate = data.sessions.find((s) => s.cohortId === t.cohort.id && s.moduleCode === 'I4' && s.no === SESSIONS_PER_MODULE)?.date ?? TODAY
  const snaps = t.ventureId ? snapshotsOf(t.ventureId) : []
  const save = () => {
    try {
      if (!decision) throw new IncubationError('Choose a decision.')
      decideGate({ cohortId: t.cohort.id, chiiId: t.lead.chiiId, ventureId: t.ventureId, decision, score: score === '' ? undefined : Number(score), decidedOn, nextCohortId: next || undefined, notes }, me)
      toast({ title: 'Gate decision saved', body: `${ventureName ?? nameOf(t.lead.chiiId)}: ${GATE_LABEL[decision]}${next ? ` · joins ${data.cohorts.find((c) => c.id === next)?.name}` : ''}`, tone: 'good' })
      onDone()
    } catch (e) {
      setError(e instanceof IncubationError ? e.message : 'Couldn’t save.')
    }
  }
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-canvas/60">
            <tr>
              <Th>Founder</Th>
              <Th>Modules</Th>
              <Th className="text-right">I4 brief</Th>
              <Th>Idea changed</Th>
              <Th className="text-right">Stakeholders</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {t.members.map((f) => (
              <tr key={f.chiiId}>
                <Td>
                  <span className="block font-semibold text-ink">{nameOf(f.chiiId)}</span>
                  <span className="font-mono text-[11px] text-muted">{f.chiiId}</span>
                </Td>
                <Td>
                  <span className="flex gap-1">
                    {EXPOSE_MODULES.map((m) => (
                      <ModuleChip key={m} code={m} status={moduleStatus(data, t.cohort, f.chiiId, m)} />
                    ))}
                  </span>
                </Td>
                <Td className="text-right tabular-nums">{one(resultScore(resultOf(data, t.cohort.id, 'I4-FINAL', f.chiiId)))}</Td>
                <Td className="text-xs">{f.ideaChanged == null ? '—' : f.ideaChanged ? 'Yes' : 'No'}</Td>
                <Td className={`text-right tabular-nums ${f.stakeholders === 0 ? 'font-semibold text-warn' : ''}`}>{f.stakeholders ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {incomplete.length > 0 && (
        <Note tone="warn">
          {incomplete.map((f) => nameOf(f.chiiId)).join(', ')} {incomplete.length === 1 ? 'hasn’t' : 'haven’t'} completed or been exempted from all of I1–I4. You can still decide; it’s flagged in the data checks (INC-03).
        </Note>
      )}
      <Field label="Decision" required>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(GATE_LABEL) as GateChoice[]).map((k) => (
            <button key={k} type="button" aria-pressed={decision === k} onClick={() => setDecision(k)} className={`rounded-lg border px-3 py-2.5 text-left ${decision === k ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-line hover:bg-canvas'}`}>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {decision === k && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
                {GATE_LABEL[k]}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {k === 'build' ? 'Ready to build: joins a Build cohort.' : k === 'more_ideation' ? 'Repeat parts of Expose before the next gate.' : k === 'other_pathway' ? 'A different CHII route fits better.' : 'Left the programme.'}
              </span>
            </button>
          ))}
        </div>
      </Field>
      {decision === 'build' &&
        (builds.length ? (
          <Field label="Build cohort they join" required hint="The founders are added to it, and the venture’s track in the registry becomes “Incubation – Build”.">
            <select value={next} onChange={(e) => setNext(e.target.value)} className={inputCls}>
              <option value="">Choose…</option>
              {builds.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Note>There’s no Build cohort yet. Save the decision now; once a Build cohort is created under Cohorts, come back and choose it so the founders join.</Note>
        ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Portfolio score (optional)" hint={`0–${data.curriculum.scaleMax}. CHII’s gate criteria aren’t written down yet.`}>
          <input type="number" min={0} max={data.curriculum.scaleMax} step={0.1} value={score} onChange={(e) => setScore(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Decided on" required>
          <input type="date" value={decidedOn} onChange={(e) => setDecidedOn(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Notes (staff only)" hint="Never shown to founders or in analytics.">
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} h-auto py-2`} />
      </Field>
      {t.ventureId && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
          <Camera className="h-5 w-5 shrink-0 text-brand-600" />
          <p className="min-w-0 flex-1 text-xs text-muted">{snaps.length ? `I4 snapshot recorded (${snaps.map((s) => fmtDate(s.asOf)).join(', ')}).` : 'No I4 snapshot yet. It adds a dated update to the venture, as evidence for the gate and for follow-up.'}</p>
          {!snaps.some((s) => s.asOf === snapDate) && (
            <Button
              className="h-8 text-xs"
              onClick={() => {
                try {
                  recordSnapshot(t.cohort.id, t.ventureId!, snapDate, me)
                  toast({ title: 'Snapshot recorded', body: `As of ${fmtDate(snapDate)}`, tone: 'good' })
                } catch (e) {
                  toast({ title: 'Snapshot not recorded', body: e instanceof Error ? e.message : '', tone: 'bad' })
                }
              }}
            >
              Record snapshot
            </Button>
          )}
        </div>
      )}
      {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          Save decision
        </Button>
      </div>
    </div>
  )
}
