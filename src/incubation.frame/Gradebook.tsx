/**
 * A cohort's Assessments tab: founders × the 16 pieces of work (score and on-time flag), plus the
 * skills quiz and confidence survey. Scores come from Canvas; staff can enter or correct them here,
 * or import a gradebook export (CSV / Excel).
 */
import React, { useRef, useState } from 'react'
import { Download, FileUp, PencilLine, Trash2 } from 'lucide-react'
import { Modal } from '../shared/components/Modal'
import { Button } from '../shared/components/ui'
import { toast } from '../shared/lib/notify'
import { EXPOSE_MODULES, assessmentName, assessmentShort, criteriaFor, criterionLabel, moduleWork } from '../shared/incubation/curriculum'
import { TODAY, foundersIn, isExempt, isLate, resultOf, resultScore } from '../shared/incubation/progress'
import { IncubationError, assessmentDue, deleteResult, importResults, saveResult } from '../shared/incubation/store'
import { TIMEPOINT_LABEL, type Assessment, type Cohort, type IncubationData } from '../shared/incubation/types'
import { Chip, Field, Note, Td, Th, fmtDate, fmtShort, inputCls, nameOf } from './parts'

type View = 'all' | 'I1' | 'I2' | 'I3' | 'I4' | 'scores'

const tone = (v: number, max: number) => {
  const r = v / max
  return r >= 0.75 ? 'bg-good-bg text-good' : r >= 0.5 ? 'bg-brand-50 text-brand-600' : 'bg-warn-bg text-warn'
}

export function Gradebook({ data, c, me }: { data: IncubationData; c: Cohort; me: string }) {
  const [view, setView] = useState<View>('all')
  const [edit, setEdit] = useState<{ code: string; chiiId: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const fs = foundersIn(data, c.id)
  const scoresCols = data.curriculum.assessments.filter((a) => a.kind === 'skills_quiz' || a.kind === 'confidence_survey')
  const cols: Assessment[] = view === 'scores' ? scoresCols : moduleWork(data.curriculum, view === 'all' ? undefined : view)
  const mods = view === 'scores' ? [] : view === 'all' ? [...EXPOSE_MODULES] : [view]
  if (c.stage !== 'expose')
    return (
      <div className="p-4">
        <Note>Assessments follow the curriculum, and only Expose has one so far.</Note>
      </div>
    )

  return (
    <>
      <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {(['all', ...EXPOSE_MODULES, 'scores'] as View[]).map((k) => (
            <Chip key={k} on={view === k} onClick={() => setView(k)}>
              {k === 'all' ? 'All modules' : k === 'scores' ? 'Quiz and confidence' : k}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted lg:ml-auto">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-bad" /> Late
          </span>
          <span>Rubric 1–{data.curriculum.scaleMax}, mean of criteria</span>
          <Button className="h-8 text-xs" onClick={() => setImporting(true)}>
            <FileUp className="h-3.5 w-3.5" /> Import scores
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-canvas/60">
            {mods.length > 1 && (
              <tr>
                <th className="sticky left-0 z-10 border-b border-line bg-canvas" />
                {mods.map((m) => (
                  <th key={m} colSpan={4} className="border-b border-l border-line px-2 py-1.5 text-center text-[11px] font-bold text-ink">
                    {m}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <th className="sticky left-0 z-10 min-w-[200px] border-b border-line bg-canvas px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-muted">Founder</th>
              {cols.map((a, i) => (
                <th key={a.code} title={assessmentName(data.curriculum, a.code)} className={`border-b border-line px-2 py-2 text-center text-[11px] font-bold text-muted ${i % 4 === 0 && mods.length > 1 ? 'border-l' : ''}`}>
                  {view === 'scores' ? (
                    <>
                      {a.kind === 'skills_quiz' ? 'Quiz' : 'Confidence'}
                      <span className="block font-medium normal-case">{TIMEPOINT_LABEL[a.timepoint!]}</span>
                    </>
                  ) : (
                    <>
                      {mods.length === 1 ? assessmentName(data.curriculum, a.code) : assessmentShort(a.code)}
                      <span className="block font-medium text-faint">due {fmtShort(assessmentDue(data, c, a.code))}</span>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fs.map((f) => (
              <tr key={f.chiiId} className="hover:bg-canvas/40">
                <td className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-2">
                  <span className="block truncate text-[13px] font-semibold text-ink">{nameOf(f.chiiId)}</span>
                  <span className="font-mono text-[10.5px] text-muted">{f.chiiId}</span>
                </td>
                {cols.map((a, i) => {
                  const r = resultOf(data, c.id, a.code, f.chiiId)
                  const v = resultScore(r)
                  const due = assessmentDue(data, c, a.code)
                  const exempt = a.moduleCode && isExempt(data, c.id, f.chiiId, a.moduleCode)
                  const max = a.maxScore ?? data.curriculum.scaleMax
                  return (
                    <td key={a.code} className={`border-b border-line px-1.5 py-1.5 text-center ${i % 4 === 0 && mods.length > 1 ? 'border-l' : ''}`}>
                      {exempt ? (
                        <span className="text-[11px] font-semibold text-faint">Exempt</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEdit({ code: a.code, chiiId: f.chiiId })}
                          title={r ? `${r.source === 'canvas' ? 'From Canvas' : r.source === 'import' ? 'Imported' : 'Entered by staff'}${r.submittedAt ? ` · handed in ${fmtDate(r.submittedAt)}` : ''}` : 'Enter a score'}
                          className={`relative inline-flex h-8 min-w-[46px] items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums ${
                            v != null ? tone(v, max) : due && due <= TODAY ? 'border border-dashed border-bad/50 text-bad' : 'text-faint hover:bg-canvas'
                          }`}
                        >
                          {v != null ? (Number.isInteger(v) ? v : v.toFixed(1)) : due && due <= TODAY ? 'Missing' : '—'}
                          {r && isLate(r) && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-bad" aria-label="late" />}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ResultModal at={edit} onClose={() => setEdit(null)} data={data} c={c} me={me} />
      <ImportModal open={importing} onClose={() => setImporting(false)} data={data} c={c} me={me} />
    </>
  )
}

function ResultModal({ at, onClose, data, c, me }: { at: { code: string; chiiId: string } | null; onClose: () => void; data: IncubationData; c: Cohort; me: string }) {
  const a = at ? data.curriculum.assessments.find((x) => x.code === at.code) : undefined
  return (
    <Modal open={!!at} onClose={onClose} size="lg" title={at && a ? `${a.moduleCode ? `${a.moduleCode} · ` : ''}${assessmentName(data.curriculum, a.code)}${a.timepoint ? ` (${TIMEPOINT_LABEL[a.timepoint]})` : ''}` : ''} description={at ? `${nameOf(at.chiiId)} · ${at.chiiId}` : undefined} icon={<PencilLine className="h-4 w-4" />}>
      {at && a && <ResultForm key={`${at.code}|${at.chiiId}`} a={a} chiiId={at.chiiId} data={data} c={c} me={me} onDone={onClose} />}
    </Modal>
  )
}

function ResultForm({ a, chiiId, data, c, me, onDone }: { a: Assessment; chiiId: string; data: IncubationData; c: Cohort; me: string; onDone: () => void }) {
  const r = resultOf(data, c.id, a.code, chiiId)
  const crit = criteriaFor(data.curriculum, a.code)
  const isScore = a.kind === 'skills_quiz' || a.kind === 'confidence_survey'
  const [scores, setScores] = useState<Record<number, number>>(r?.scores ?? {})
  const [score, setScore] = useState(r?.score == null ? '' : String(r.score))
  const due = r?.dueAt ?? assessmentDue(data, c, a.code)
  const [submitted, setSubmitted] = useState(r?.submittedAt?.slice(0, 10) ?? '')
  const [error, setError] = useState('')
  const late = submitted && due && submitted > due.slice(0, 10)
  const save = () => {
    try {
      if (!isScore && crit.some((_, i) => scores[i] == null)) throw new IncubationError('Score every criterion.')
      if (isScore && score === '') throw new IncubationError('Enter the score.')
      saveResult({ cohortId: c.id, code: a.code, chiiId, scores: isScore ? {} : scores, score: isScore ? Number(score) : undefined, submittedAt: submitted || undefined, dueAt: due }, me, 'staff')
      toast({ title: 'Score saved', body: `${nameOf(chiiId)} · ${a.code}`, tone: 'good' })
      onDone()
    } catch (e) {
      setError(e instanceof IncubationError ? e.message : 'Couldn’t save.')
    }
  }
  return (
    <div className="space-y-4">
      {r && (
        <Note>
          {r.source === 'canvas' ? 'From Canvas' : r.source === 'import' ? 'Imported from a gradebook file' : 'Entered by staff'}
          {r.reviewer ? ` · reviewed by ${r.reviewer}` : ''}. Saving here marks it as a staff entry, which later Canvas syncs won’t overwrite.
        </Note>
      )}
      {isScore ? (
        <Field label={`Score (0–${a.maxScore})`}>
          <input type="number" min={0} max={a.maxScore} step={a.kind === 'confidence_survey' ? 0.1 : 1} value={score} onChange={(e) => setScore(e.target.value)} className={`${inputCls} w-32`} />
        </Field>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[13px] font-semibold text-ink">Rubric (1–{data.curriculum.scaleMax} per criterion)</p>
          {crit.map((name, i) => (
            <div key={i} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className={`min-w-0 flex-1 text-[13px] ${name ? 'text-body' : 'italic text-faint'}`}>{criterionLabel(name, i)}{!name && ' (to add from the compendium)'}</span>
              <div className="flex gap-1">
                {Array.from({ length: data.curriculum.scaleMax }, (_, k) => k + 1).map((v) => (
                  <button key={v} type="button" aria-pressed={scores[i] === v} onClick={() => setScores({ ...scores, [i]: v })} className={`h-8 w-9 rounded-md border text-sm font-bold ${scores[i] === v ? 'border-brand bg-brand text-white' : 'border-line-strong text-body hover:bg-canvas'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {crit.length > 0 && Object.keys(scores).length === crit.length && (
            <p className="text-xs text-muted">Mean: {(Object.values(scores).reduce((x, y) => x + y, 0) / crit.length).toFixed(1)}</p>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Handed in on" hint={late ? 'After the due date: counts as late.' : undefined}>
          <input type="date" value={submitted} onChange={(e) => setSubmitted(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Due">
          <p className="flex h-10 items-center text-sm text-body">{due ? fmtDate(due) : 'Set the session dates first'}</p>
        </Field>
      </div>
      {error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="flex items-center gap-2 border-t border-line pt-3">
        {r && (
          <Button
            className="text-bad"
            onClick={() => {
              deleteResult(r.id, me)
              toast({ title: 'Score removed', body: a.code, tone: 'warn' })
              onDone()
            }}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        )}
        <span className="ml-auto" />
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          Save
        </Button>
      </div>
    </div>
  )
}

/* ---------- Import ---------- */

function ImportModal({ open, onClose, data, c, me }: { open: boolean; onClose: () => void; data: IncubationData; c: Cohort; me: string }) {
  const file = useRef<HTMLInputElement>(null)
  const [outcome, setOutcome] = useState<{ written: number; skipped: string[] } | null>(null)
  const codes = data.curriculum.assessments.filter((a) => a.kind !== 'gate_portfolio').map((a) => a.code)
  const template = () => {
    const rows = [['CHII ID', ...codes], ...foundersIn(data, c.id).map((f) => [f.chiiId, ...codes.map(() => '')])]
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${c.name} scores template.csv`
    a.click()
  }
  const read = async (f: File) => {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await f.arrayBuffer())
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const table = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    const rows: { who: string; code: string; value: number }[] = []
    for (const row of table) {
      const who = String(row['CHII ID'] || row['chii_id'] || row['Email'] || row['email'] || '').trim()
      if (!who) continue
      for (const code of codes) {
        const v = row[code]
        if (v === '' || v == null) continue
        rows.push({ who, code, value: Number(v) })
      }
    }
    const res = importResults(c.id, rows, me)
    setOutcome(res)
    toast({ title: `${res.written} score${res.written === 1 ? '' : 's'} imported`, body: res.skipped.length ? `${res.skipped.length} skipped` : c.name, tone: res.skipped.length ? 'warn' : 'good' })
  }
  return (
    <Modal open={open} onClose={() => (setOutcome(null), onClose())} title="Import scores" description="The fallback when the Canvas sync isn’t running: a Canvas gradebook or quiz export, or the template below. One row per founder, one column per assessment code." icon={<FileUp className="h-4 w-4" />}>
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-body">
          <li>Identify each founder by CHII ID or by the email they use on Canvas.</li>
          <li>
            Name the columns with the assessment codes: <span className="font-mono text-xs">I1-A1 … I4-FINAL, QUIZ-intake, CONF-end_i4</span>.
          </li>
          <li>Rubric work takes 1–{data.curriculum.scaleMax}; the quiz 0–20; confidence 0–5. Anything out of range is skipped and listed.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button onClick={template}>
            <Download className="h-4 w-4" /> Download template (CHII IDs only)
          </Button>
          <Button variant="primary" onClick={() => file.current?.click()}>
            <FileUp className="h-4 w-4" /> Choose file
          </Button>
          <input ref={file} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && read(e.target.files[0]).catch(() => toast({ title: 'Couldn’t read that file', body: 'Use CSV or Excel.', tone: 'bad' }))} />
        </div>
        {outcome && (
          <div className="rounded-lg border border-line p-3 text-sm">
            <p className="font-semibold text-ink">{outcome.written} written</p>
            {outcome.skipped.length > 0 && (
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-bad">
                {outcome.skipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export { Th, Td }
