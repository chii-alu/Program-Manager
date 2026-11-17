/**
 * Incubation → Curriculum: the reusable template (modules, sessions, assessments, rubric criteria)
 * that every new cohort of a stage is built from. Staff paste the compendium's text in; blanks
 * show as "to add". Only Expose has a curriculum today; Build and Scale are added the same way.
 */
import React, { useMemo, useState } from 'react'
import { BookOpenCheck, ChevronDown, ClipboardPaste, Minus, Plus, Save } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { EmptyState } from '../shared/components/EmptyState'
import { toast } from '../shared/lib/notify'
import { EXPOSE_MODULES, missingText, sessionCode } from '../shared/incubation/curriculum'
import { saveCurriculum } from '../shared/incubation/store'
import { STAGE_LABEL, TIMEPOINT_LABEL, type Curriculum, type IncStage, type IncubationData } from '../shared/incubation/types'
import { Field, Note, Tabs, inputCls } from './parts'

const cell = 'h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-[13px] text-ink outline-none placeholder:italic placeholder:text-faint hover:border-line focus:border-brand-600 focus:bg-surface'

export function CurriculumPage({ data, me }: { data: IncubationData; me: string }) {
  const [stage, setStage] = useState<IncStage>('expose')
  const [draft, setDraft] = useState<Curriculum>(data.curriculum)
  const [openMod, setOpenMod] = useState<string | null>('I1')
  const [paste, setPaste] = useState<string | null>(null)
  const [versioning, setVersioning] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.curriculum)
  const missing = missingText(draft)
  const missingTotal = missing.modules + missing.sessions + missing.assessments + missing.criteria
  const cohortsOnIt = data.cohorts.filter((c) => c.curriculumVersion === data.curriculum.version).length

  const setModule = (code: string, patch: Partial<Curriculum['modules'][number]>) => setDraft({ ...draft, modules: draft.modules.map((m) => (m.code === code ? { ...m, ...patch } : m)) })
  const setSession = (code: string, no: number, patch: Partial<Curriculum['sessions'][number]>) => setDraft({ ...draft, sessions: draft.sessions.map((s) => (s.moduleCode === code && s.no === no ? { ...s, ...patch } : s)) })
  const setAssessment = (code: string, patch: Partial<Curriculum['assessments'][number]>) => setDraft({ ...draft, assessments: draft.assessments.map((a) => (a.code === code ? { ...a, ...patch } : a)) })
  const setCriteria = (mod: string, list: string[]) => setDraft({ ...draft, criteria: { ...draft.criteria, [mod]: list } })
  const save = (version?: string) => {
    saveCurriculum(draft, me, version)
    if (version) setDraft({ ...draft, version })
    toast({ title: version ? `Saved as version ${version}` : 'Curriculum saved', body: version ? 'New cohorts use this version; existing cohorts keep theirs.' : 'Blank session titles in existing cohorts fill in from it.', tone: 'good' })
  }

  return (
    <>
      <PageHeader
        crumbs={['HENT', 'Incubator', 'Curriculum']}
        title="Curriculum Template"
        description={`The modules, sessions and assessed work every new cohort is built from. Expose version ${draft.version}${data.curriculum.updatedBy ? ` · last saved by ${data.curriculum.updatedBy}` : ''}.`}
        actions={
          stage === 'expose' ? (
            <>
              <Button onClick={() => setVersioning(true)}>Save as new version</Button>
              <Button variant="primary" onClick={() => save()}>
                <Save className="h-4 w-4" /> {dirty ? 'Save changes' : 'Saved'}
              </Button>
            </>
          ) : undefined
        }
      />
      <Panel>
        <Tabs value={stage} onChange={setStage} tabs={(['expose', 'build', 'scale'] as IncStage[]).map((s) => [s, STAGE_LABEL[s], s === 'expose' ? draft.sessions.length : 0])} />
        {stage !== 'expose' ? (
          <EmptyState icon={BookOpenCheck} title={`No ${STAGE_LABEL[stage]} curriculum yet`} body={`Only Expose (the Ideation track) has a curriculum today. When the ${STAGE_LABEL[stage]} curriculum is written, its modules and sessions go here, and new ${STAGE_LABEL[stage]} cohorts get their sessions from it.`} />
        ) : (
          <div className="space-y-4 p-4">
            {missingTotal > 0 && (
              <Note tone="warn">
                Still to copy in from the compendium: {[missing.modules && `${missing.modules} module titles`, missing.sessions && `${missing.sessions} session titles`, missing.assessments && `${missing.assessments} assignment titles`, missing.criteria && `${missing.criteria} rubric criteria`].filter(Boolean).join(', ')}. Use “Paste titles” to fill a module’s 10 sessions at once.
              </Note>
            )}
            <p className="text-xs text-muted">
              4 modules × 10 sessions of 60–75 minutes. Each module has 3 assignments and a final brief (16 pieces of assessed work), scored 1–{draft.scaleMax} on its rubric. {cohortsOnIt} cohort{cohortsOnIt === 1 ? '' : 's'} use version {data.curriculum.version}.
            </p>
            {EXPOSE_MODULES.map((code) => {
              const m = draft.modules.find((x) => x.code === code)!
              const sessions = draft.sessions.filter((s) => s.moduleCode === code)
              const work = draft.assessments.filter((a) => a.moduleCode === code)
              const crit = draft.criteria[code] ?? []
              const open = openMod === code
              return (
                <section key={code} className="overflow-hidden rounded-lg border border-line">
                  <div className="flex items-center gap-3 bg-canvas/60 px-3 py-2">
                    <button type="button" onClick={() => setOpenMod(open ? null : code)} aria-label={open ? 'Collapse' : 'Expand'} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface">
                      <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
                    </button>
                    <span className="w-8 shrink-0 font-mono text-sm font-bold text-brand-600">{code}</span>
                    <input value={m.title} onChange={(e) => setModule(code, { title: e.target.value })} placeholder="Module title to add from the compendium" className={`${cell} font-semibold`} />
                    <input value={m.pages ?? ''} onChange={(e) => setModule(code, { pages: e.target.value })} placeholder="Pages" className={`${cell} hidden w-24 shrink-0 text-xs sm:block`} aria-label="Compendium pages" />
                    <span className="hidden shrink-0 text-xs text-muted md:block">{sessions.filter((s) => s.title).length}/10 titled</span>
                  </div>
                  {open && (
                    <div className="space-y-4 p-3">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <h3 className="text-[12px] font-bold uppercase tracking-[0.05em] text-muted">Sessions</h3>
                          <button type="button" onClick={() => setPaste(code)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                            <ClipboardPaste className="h-3.5 w-3.5" /> Paste titles
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[820px] text-sm">
                            <thead>
                              <tr className="text-left text-[11px] font-bold uppercase tracking-[0.05em] text-faint">
                                <th className="w-[72px] px-2 py-1">Session</th>
                                <th className="px-2 py-1">Title</th>
                                <th className="px-2 py-1">Key idea</th>
                                <th className="px-2 py-1">Founder takeaway</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {sessions.map((s) => (
                                <tr key={s.no}>
                                  <td className="px-2 font-mono text-xs font-semibold text-brand-600">{sessionCode(code, s.no)}</td>
                                  <td className="px-1">
                                    <input value={s.title} onChange={(e) => setSession(code, s.no, { title: e.target.value })} placeholder="Title to add" className={cell} />
                                  </td>
                                  <td className="px-1">
                                    <input value={s.keyIdea ?? ''} onChange={(e) => setSession(code, s.no, { keyIdea: e.target.value })} placeholder="Key idea" className={cell} />
                                  </td>
                                  <td className="px-1">
                                    <input value={s.takeaway ?? ''} onChange={(e) => setSession(code, s.no, { takeaway: e.target.value })} placeholder="Takeaway" className={cell} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.05em] text-muted">Assessed work</h3>
                          <ul className="divide-y divide-line rounded-md border border-line">
                            {work.map((a) => (
                              <li key={a.code} className="flex items-center gap-2 px-2 py-1">
                                <span className="w-[74px] shrink-0 font-mono text-xs font-semibold text-brand-600">{a.code}</span>
                                <input value={a.title} onChange={(e) => setAssessment(a.code, { title: e.target.value })} placeholder={a.kind === 'final_brief' ? 'Final brief title to add' : 'Assignment title to add'} className={cell} />
                                <span className="shrink-0 whitespace-nowrap text-xs text-muted">after S{String(a.dueAfter).padStart(2, '0')}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <h3 className="text-[12px] font-bold uppercase tracking-[0.05em] text-muted">Rubric criteria (“How work is reviewed”)</h3>
                            <button type="button" onClick={() => setCriteria(code, [...crit, ''])} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                              <Plus className="h-3.5 w-3.5" /> Add
                            </button>
                          </div>
                          <ul className="divide-y divide-line rounded-md border border-line">
                            {crit.map((name, i) => (
                              <li key={i} className="flex items-center gap-2 px-2 py-1">
                                <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted">{i + 1}</span>
                                <input value={name} onChange={(e) => setCriteria(code, crit.map((x, k) => (k === i ? e.target.value : x)))} placeholder="Criterion to add" className={cell} />
                                <button type="button" onClick={() => setCriteria(code, crit.filter((_, k) => k !== i))} aria-label="Remove criterion" className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted hover:bg-bad-bg hover:text-bad">
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1 text-xs text-muted">The module’s assignments and final brief are all scored on these.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
            <section className="rounded-lg border border-line p-3">
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.05em] text-muted">Skills quiz, confidence survey and gate</h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {draft.assessments
                  .filter((a) => !a.moduleCode)
                  .map((a) => (
                    <li key={a.code} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-2 text-[13px]">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">{a.title}</span>
                        <span className="text-xs text-muted">{a.timepoint ? TIMEPOINT_LABEL[a.timepoint] : ''}</span>
                      </span>
                      {a.maxScore != null && (
                        <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                          out of
                          <input type="number" min={1} value={a.maxScore} onChange={(e) => setAssessment(a.code, { maxScore: Number(e.target.value) })} className="h-8 w-14 rounded-md border border-line px-1.5 text-[13px] text-ink" />
                        </label>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        )}
      </Panel>
      <PasteModal code={paste} onClose={() => setPaste(null)} onApply={(lines) => paste && setDraft({ ...draft, sessions: draft.sessions.map((s) => (s.moduleCode === paste && lines[s.no - 1] != null ? { ...s, title: lines[s.no - 1] } : s)) })} />
      <VersionModal open={versioning} onClose={() => setVersioning(false)} current={draft.version} onSave={(v) => (save(v), setVersioning(false))} />
    </>
  )
}

function PasteModal({ code, onClose, onApply }: { code: string | null; onClose: () => void; onApply: (lines: string[]) => void }) {
  const [text, setText] = useState('')
  const lines = useMemo(() => text.split('\n').map((l) => l.replace(/^\s*(S?\d+[.):-]?\s+)/i, '').trim()).filter(Boolean), [text])
  return (
    <Modal
      open={!!code}
      onClose={onClose}
      title={`Paste ${code} session titles`}
      description="One title per line, in order (S01 first). Numbers at the start of a line are removed."
      icon={<ClipboardPaste className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => (onApply(lines.slice(0, 10)), setText(''), onClose(), toast({ title: `${Math.min(lines.length, 10)} titles filled in`, body: 'Save the curriculum to keep them.', tone: 'good' }))}>
            Fill in {Math.min(lines.length, 10)} titles
          </Button>
        </>
      }
    >
      <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'From a health idea to a real health problem\n…'} className={`${inputCls} h-auto py-2 font-mono text-[12.5px]`} />
      {lines.length > 10 && <p className="mt-1 text-xs text-warn">Only the first 10 lines are used.</p>}
    </Modal>
  )
}

function VersionModal({ open, onClose, current, onSave }: { open: boolean; onClose: () => void; current: string; onSave: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as a new version"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => v.trim() && v.trim() !== current && onSave(v.trim())}>
            Save version
          </Button>
        </>
      }
    >
      <Field label="Version" hint={`Current: ${current}. Use year-month, e.g. 2027-01. New cohorts use the new version; existing cohorts keep theirs, so results stay comparable.`}>
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="2027-01" className={inputCls} />
      </Field>
    </Modal>
  )
}
