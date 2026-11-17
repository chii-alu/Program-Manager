/**
 * Worksheets on a selective intervention's page: the master worksheet (every cohort), one per
 * cohort, generated from a template that's reused each cohort (and made automatically for new
 * cohorts), plus importing an existing worksheet from Excel or CSV.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Download, FileSpreadsheet, LayoutTemplate, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { Modal } from '../shared/components/Modal'
import { toast } from '../shared/lib/notify'
import type { SessionRun } from '../shared/data/sessionStore'
import {
  WorksheetError,
  availableColumns,
  columnsOf,
  deleteTemplate,
  deleteWorksheet,
  ensureCohortWorksheets,
  generateWorksheet,
  planImport,
  rowsOf,
  runImport,
  saveTemplate,
  setCell,
  setSettings,
  settingsFor,
  templateById,
  templatesFor,
  useWorksheets,
  type ImportPlan,
  type Worksheet,
  type WsColumn,
} from '../shared/data/worksheets'

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** The Worksheets section of a selective intervention's page. */
export function WorksheetsPanel({ intervention, runs, me, onOpen }: { intervention: string; runs: SessionRun[]; me: string; onOpen: (id: string) => void }) {
  const { worksheets } = useWorksheets()
  const mine = worksheets.filter((w) => w.intervention === intervention)
  const st = settingsFor(intervention)
  const [modal, setModal] = useState<null | 'generate' | 'import' | 'templates'>(null)

  // "Always generate": a worksheet for every cohort that hasn't got one, from the reused template.
  useEffect(() => {
    const n = ensureCohortWorksheets(intervention, runs, me)
    if (n) toast({ title: `${n} worksheet${n === 1 ? '' : 's'} generated`, body: `${templateById(st.defaultTemplate)?.name} for new ${intervention} cohorts`, tone: 'info' })
  }, [intervention, runs.length, st.autoGenerate, st.defaultTemplate])

  const master = mine.filter((w) => w.sessionId == null)
  const cohortWs = mine.filter((w) => w.sessionId != null)
  const cohortName = (id: string | null) => runs.find((r) => r.id === id)?.name ?? 'Deleted cohort'

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-ink">Worksheets</h2>
          <p className="text-xs text-muted">
            Reused template: <b className="font-semibold text-body">{templateById(st.defaultTemplate)?.name}</b> · {st.autoGenerate ? 'made automatically for every new cohort' : 'made by hand'}
          </p>
        </div>
        <Button className="h-9 text-xs" onClick={() => setModal('templates')}>
          <LayoutTemplate className="h-4 w-4" /> Templates
        </Button>
        <Button className="h-9 text-xs" onClick={() => setModal('import')}>
          <Upload className="h-4 w-4" /> Import a worksheet
        </Button>
        <Button variant="primary" className="h-9 text-xs" onClick={() => setModal('generate')}>
          <Sparkles className="h-4 w-4" /> Generate
        </Button>
      </div>
      <Panel className="overflow-hidden">
        <ul className="divide-y divide-line">
          {master.length === 0 && (
            <li className="flex flex-wrap items-center gap-3 bg-brand-50/50 px-4 py-3">
              <FileSpreadsheet className="h-5 w-5 text-brand-600" />
              <span className="min-w-0 flex-1 text-sm">
                <b className="font-semibold text-ink">Master worksheet</b>
                <span className="block text-xs text-muted">Every applicant across all {intervention} cohorts, in one sheet.</span>
              </span>
              <Button className="h-8 text-xs" onClick={() => onOpen(generateWorksheet({ intervention, sessionId: null, templateId: st.defaultTemplate, by: me }).id)}>
                Create the master worksheet
              </Button>
            </li>
          )}
          {[...master, ...cohortWs].map((w) => (
            <li key={w.id} className="flex flex-col gap-2 px-4 py-3 hover:bg-canvas/60 sm:flex-row sm:items-center sm:gap-4">
              <span className={`w-[78px] shrink-0 rounded px-1.5 py-0.5 text-center text-[10.5px] font-bold ${w.sessionId == null ? 'bg-brand text-white' : 'bg-canvas text-body'}`}>{w.sessionId == null ? 'Master' : 'Cohort'}</span>
              <button type="button" onClick={() => onOpen(w.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold text-ink hover:text-brand-600 hover:underline">{w.sessionId == null ? `Master worksheet · all ${intervention} cohorts` : cohortName(w.sessionId)}</span>
                <span className="block truncate text-xs text-muted">
                  {templateById(w.templateId)?.name ?? 'Template removed'}
                  {w.auto ? ' · generated automatically' : ''}
                  {w.imports?.length ? ` · imported ${w.imports.slice(-1)[0].file}` : ''}
                </span>
              </button>
              <span className="hidden w-[170px] shrink-0 text-xs text-muted lg:block">
                Updated {when(w.updatedAt)}
                <span className="block">by {w.createdBy}</span>
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" aria-label="Delete worksheet" title="Delete" onClick={() => (deleteWorksheet(w.id), toast({ title: 'Worksheet deleted', tone: 'info' }))} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bad-bg hover:text-bad">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onOpen(w.id)} className="inline-flex h-8 items-center rounded-md border border-line-strong px-3 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {modal === 'generate' && (
        <GenerateModal
          intervention={intervention}
          runs={runs}
          onClose={() => setModal(null)}
          onDone={(cohort, templateId) => {
            const w = generateWorksheet({ intervention, sessionId: cohort, templateId, by: me, cohortName: runs.find((r) => r.id === cohort)?.name })
            setModal(null)
            onOpen(w.id)
          }}
        />
      )}
      {modal === 'import' && <ImportModal intervention={intervention} runs={runs} worksheets={mine} me={me} onClose={() => setModal(null)} onDone={(id) => (setModal(null), onOpen(id))} />}
      {modal === 'templates' && <TemplatesModal intervention={intervention} me={me} onClose={() => setModal(null)} />}
    </section>
  )
}

/* ---------- Generate ---------- */

function GenerateModal({ intervention, runs, onClose, onDone }: { intervention: string; runs: SessionRun[]; onClose: () => void; onDone: (sessionId: string | null, templateId: string) => void }) {
  const [cohort, setCohort] = useState<string>('master')
  const [tpl, setTpl] = useState(settingsFor(intervention).defaultTemplate)
  return (
    <Modal
      open
      onClose={onClose}
      title="Generate a worksheet"
      description="Choose the cohort and the template. Applicants, their answers and scores fill in; you add decisions and notes."
      icon={<Sparkles className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onDone(cohort === 'master' ? null : cohort, tpl)}>
            Generate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-body">For</span>
          <select value={cohort} onChange={(e) => setCohort(e.target.value)} className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600">
            <option value="master">Master worksheet: every {intervention} cohort</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <TemplatePick intervention={intervention} value={tpl} onChange={setTpl} />
      </div>
    </Modal>
  )
}

function TemplatePick({ intervention, value, onChange }: { intervention: string; value: string; onChange: (id: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-body">Template</span>
      <ul className="space-y-1.5">
        {templatesFor(intervention).map((t) => (
          <li key={t.id}>
            <label className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 ${value === t.id ? 'border-brand-600 bg-brand-50' : 'border-line-strong hover:bg-canvas'}`}>
              <input type="radio" checked={value === t.id} onChange={() => onChange(t.id)} className="mt-1 h-4 w-4 accent-brand" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">
                  {t.name} {!t.builtIn && <span className="ml-1 rounded bg-canvas px-1.5 text-[10px] font-semibold text-muted">{intervention}</span>}
                </span>
                <span className="block text-xs text-muted">{t.description}</span>
                <span className="mt-1 block truncate text-[11px] text-faint">{t.columns.map((c) => c.label).join(' · ')}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- Templates (reuse, always generate, custom) ---------- */

function TemplatesModal({ intervention, me, onClose }: { intervention: string; me: string; onClose: () => void }) {
  const st = settingsFor(intervention)
  const [, force] = useState(0)
  const [making, setMaking] = useState(false)
  const refresh = () => force((n) => n + 1)
  return (
    <Modal open onClose={onClose} size="lg" title={`${intervention} worksheet templates`} description="Pick the template to reuse for every cohort, and whether new cohorts get a worksheet automatically." icon={<LayoutTemplate className="h-4 w-4" />}>
      {making ? (
        <TemplateBuilder intervention={intervention} me={me} onDone={() => (setMaking(false), refresh())} />
      ) : (
        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-lg bg-canvas px-3 py-2.5 text-sm">
            <input type="checkbox" checked={st.autoGenerate} onChange={(e) => (setSettings(intervention, { autoGenerate: e.target.checked }), refresh())} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <b className="font-semibold text-ink">Always generate</b>
              <span className="block text-xs text-muted">Every new {intervention} cohort gets a worksheet from the reused template.</span>
            </span>
          </label>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-body">Reuse this template for every cohort</span>
            <TemplatePick intervention={intervention} value={st.defaultTemplate} onChange={(id) => (setSettings(intervention, { defaultTemplate: id }), refresh())} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="h-9 text-xs" onClick={() => setMaking(true)}>
              <Plus className="h-4 w-4" /> New template for {intervention}
            </Button>
            {templatesFor(intervention)
              .filter((t) => !t.builtIn)
              .map((t) => (
                <button key={t.id} type="button" onClick={() => (deleteTemplate(t.id), refresh())} className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong px-3 text-xs text-body hover:border-bad/40 hover:text-bad">
                  <Trash2 className="h-3 w-3" /> {t.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

/** Build a template: pick fields (application answers included), add your own columns, order them. */
function TemplateBuilder({ intervention, me, onDone }: { intervention: string; me: string; onDone: () => void }) {
  const avail = availableColumns(intervention)
  const [name, setName] = useState('')
  const [cols, setCols] = useState<WsColumn[]>(avail.filter((c) => ['chii_id', 'name', 'cohort', 'score'].includes(c.key)))
  const [custom, setCustom] = useState('')
  const [customKind, setCustomKind] = useState<'text' | 'number' | 'date' | 'select'>('text')
  const [options, setOptions] = useState('')
  const [error, setError] = useState('')
  const has = (k: string) => cols.some((c) => c.key === k)
  const move = (i: number, d: -1 | 1) => setCols((xs) => { const j = i + d; if (j < 0 || j >= xs.length) return xs; const n = [...xs]; [n[i], n[j]] = [n[j], n[i]]; return n })
  const addCustom = () => {
    if (!custom.trim()) return
    const key = `m_${custom.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
    if (has(key)) return
    setCols([...cols, { key, label: custom.trim(), source: { kind: 'manual', input: customKind, options: customKind === 'select' ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined } }])
    setCustom('')
    setOptions('')
  }
  const field = 'h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600'
  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-bad/30 bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
      <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-full`} placeholder={`Template name, e.g. ${intervention} selection 2026`} />
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-body">Fields from the platform (application answers included)</span>
        <div className="flex flex-wrap gap-1.5">
          {avail.map((c) => (
            <button key={c.key} type="button" aria-pressed={has(c.key)} onClick={() => setCols(has(c.key) ? cols.filter((x) => x.key !== c.key) : [...cols, c])} className={`h-8 rounded-full border px-3 text-xs font-semibold ${has(c.key) ? 'border-brand bg-brand text-white' : 'border-line-strong text-body hover:bg-canvas'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-body">Your own columns (filled in by staff)</span>
        <div className="flex flex-wrap gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} className={`${field} min-w-0 flex-1`} placeholder="e.g. Interview score" />
          <select value={customKind} onChange={(e) => setCustomKind(e.target.value as typeof customKind)} className={field}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Choice</option>
          </select>
          {customKind === 'select' && <input value={options} onChange={(e) => setOptions(e.target.value)} className={`${field} min-w-0 flex-1`} placeholder="Choices, separated by commas" />}
          <Button className="h-9 text-xs" onClick={addCustom}>
            <Plus className="h-4 w-4" /> Add column
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { key: 'decision', label: 'Decision', source: { kind: 'manual', input: 'select', options: ['Selected', 'Waitlisted', 'Not selected', 'Withdrew'] } },
            { key: 'notes', label: 'Notes', source: { kind: 'manual', input: 'text' } },
          ].map((c) => (
            <button key={c.key} type="button" aria-pressed={has(c.key)} onClick={() => !has(c.key) && setCols([...cols, c as WsColumn])} disabled={has(c.key)} className="h-8 rounded-full border border-dashed border-line-strong px-3 text-xs text-body hover:bg-canvas disabled:opacity-40">
              + {c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-body">Column order</span>
        <ol className="divide-y divide-line rounded-lg border border-line">
          {cols.map((c, i) => (
            <li key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="w-5 text-xs tabular-nums text-faint">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <span className="text-[11px] text-muted">{c.source.kind === 'manual' ? 'staff fill in' : 'from the platform'}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-canvas disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === cols.length - 1} aria-label="Move down" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-canvas disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setCols(cols.filter((x) => x.key !== c.key))} aria-label="Remove column" className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-bad-bg hover:text-bad"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            try {
              saveTemplate({ name, description: `Custom ${intervention} worksheet`, intervention, columns: cols, createdBy: me })
              toast({ title: 'Template saved', body: name, tone: 'good' })
              onDone()
            } catch (e) {
              if (e instanceof WorksheetError) setError(e.message)
              else throw e
            }
          }}
        >
          Save template
        </Button>
      </div>
    </div>
  )
}

/* ---------- Import ---------- */

async function readSheet(f: File): Promise<string[][]> {
  const XLSX = await import('xlsx')
  const book = XLSX.read(await f.arrayBuffer(), { type: 'array' })
  const sheet = book.Sheets[book.SheetNames[0]]
  return (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][]).map((r) => r.map((c) => String(c ?? '')))
}

function ImportModal({ intervention, runs, worksheets, me, onClose, onDone }: { intervention: string; runs: SessionRun[]; worksheets: Worksheet[]; me: string; onClose: () => void; onDone: (id: string) => void }) {
  const [target, setTarget] = useState<string>(worksheets[0]?.id ?? 'new-master')
  const [file, setFile] = useState<{ name: string; rows: string[][] } | null>(null)
  const [error, setError] = useState('')
  const ws = useMemo(() => worksheets.find((w) => w.id === target), [target, worksheets])
  let plan: ImportPlan | null = null
  if (file && ws) {
    try {
      plan = planImport(file.rows, ws, runs)
    } catch (e) {
      if (!(e instanceof WorksheetError)) throw e
    }
  }
  const planError = (() => {
    if (!file || !ws) return ''
    try {
      planImport(file.rows, ws, runs)
      return ''
    } catch (e) {
      return e instanceof WorksheetError ? e.message : ''
    }
  })()
  const go = () => {
    if (!file) return setError('Choose the worksheet file.')
    const w = ws ?? generateWorksheet({ intervention, sessionId: null, templateId: settingsFor(intervention).defaultTemplate, by: me })
    try {
      const p = planImport(file.rows, w, runs)
      runImport(w.id, file.rows, p, file.name, me, runs)
      toast({ title: `${p.matched.length} rows imported`, body: p.unmatched ? `${p.unmatched} rows didn’t match an applicant` : file.name, tone: p.unmatched ? 'info' : 'good' })
      onDone(w.id)
    } catch (e) {
      if (e instanceof WorksheetError) setError(e.message)
      else throw e
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Import a worksheet"
      description="Bring in the sheet you already keep (Excel or CSV). Rows are matched to applicants by CHII ID or email; matching columns fill in, new ones are added."
      icon={<Upload className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={go}>
            Import
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {(error || planError) && <p className="rounded-lg border border-bad/30 bg-bad-bg px-3 py-2 text-sm text-bad">{error || planError}</p>}
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-body">Into</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600">
            {worksheets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.sessionId == null ? `Master worksheet · all ${intervention} cohorts` : runs.find((r) => r.id === w.sessionId)?.name ?? w.name}
              </option>
            ))}
            <option value="new-master">A new master worksheet</option>
          </select>
        </label>
        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-line-strong px-3 py-2.5">
            <FileSpreadsheet className="h-5 w-5 text-brand-600" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {file.name} <span className="text-muted">· {Math.max(0, file.rows.length - 1)} rows</span>
            </span>
            <button type="button" onClick={() => setFile(null)} aria-label="Remove file" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-canvas">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-4 text-center text-sm hover:bg-canvas">
            <Upload className="h-5 w-5 text-brand-600" />
            <span className="font-medium text-ink">Choose the worksheet</span>
            <span className="text-xs text-muted">Excel (.xlsx) or CSV, with a CHII ID or Email column</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  setFile({ name: f.name, rows: await readSheet(f) })
                  setError('')
                } catch {
                  setError('That file couldn’t be read. Save it as .xlsx or .csv and try again.')
                }
              }}
            />
          </label>
        )}
        {plan && (
          <div className="rounded-lg bg-canvas px-3 py-2.5 text-sm">
            <p>
              <b className="font-semibold text-good">{plan.matched.length} rows match</b> an applicant{plan.unmatched ? <>, <b className="font-semibold text-warn">{plan.unmatched} don’t</b> and will be skipped</> : ''}.
            </p>
            <p className="mt-1 text-xs text-muted">
              Matched on <b>{plan.header[plan.idColumn]}</b>. Columns filled: {Object.values(plan.mapping).length ? plan.header.filter((_, i) => plan!.mapping[i]).join(', ') : 'none'}
              {plan.newColumns.length ? ` · new columns added: ${plan.newColumns.join(', ')}` : ''}.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ---------- The worksheet itself ---------- */

/** A worksheet as an editable table: platform columns fill in, staff columns are edited in place. */
export function WorksheetView({ id, runs, crumbs, onBack }: { id: string; runs: SessionRun[]; crumbs: string[]; onBack: () => void }) {
  const { worksheets } = useWorksheets()
  const w = worksheets.find((x) => x.id === id)
  const [q, setQ] = useState('')
  if (!w) return null
  const cols = columnsOf(w)
  const rows = rowsOf(w, runs).filter((r) => !q.trim() || Object.values(r.cells).join(' ').toLowerCase().includes(q.trim().toLowerCase()))
  const download = async () => {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet([cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => r.cells[c.key] ?? ''))])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Worksheet')
    XLSX.writeFile(book, `${w.name.replace(/[\\/:*?"<>|]/g, '-')}.xlsx`)
  }
  const title = w.sessionId == null ? `Master worksheet · all ${w.intervention} cohorts` : runs.find((r) => r.id === w.sessionId)?.name ?? w.name
  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 sm:px-5">
      <button type="button" onClick={onBack} className="-ml-1 flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {w.intervention}
      </button>
      <PageHeader
        crumbs={crumbs}
        title={title}
        description={`${templateById(w.templateId)?.name ?? 'Worksheet'} · ${rows.length} applicants · grey columns fill in from the platform; columns with a dark heading are yours to edit. Changes save as you go.`}
        actions={
          <Button onClick={download}>
            <Download className="h-4 w-4" /> Download (.xlsx)
          </Button>
        }
      />
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <label className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any column" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-brand-600" />
          </label>
          {w.imports?.length ? <span className="ml-auto text-xs text-muted">Last import: {w.imports.slice(-1)[0].file} · {w.imports.slice(-1)[0].matched} rows · {w.imports.slice(-1)[0].by}</span> : null}
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className={`whitespace-nowrap border-b border-line px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.04em] ${c.source.kind === 'manual' ? 'bg-brand text-white' : 'bg-canvas text-muted'}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  {cols.map((c) => {
                    const v = r.cells[c.key] ?? ''
                    const src = c.source
                    if (src.kind !== 'manual')
                      return (
                        <td key={c.key} className={`max-w-[240px] truncate border-b border-line bg-canvas/40 px-3 py-1.5 text-body ${c.key === 'chii_id' ? 'font-mono text-[12px] font-medium text-brand-600' : ''}`} title={v}>
                          {v || <span className="text-faint">—</span>}
                        </td>
                      )
                    const set = (val: string) => setCell(w.id, r.id, c.key, val)
                    const cls = 'h-8 w-full min-w-[120px] rounded border border-transparent bg-transparent px-2 text-[13px] text-ink outline-none hover:border-line-strong focus:border-brand-600 focus:bg-surface'
                    return (
                      <td key={c.key} className="border-b border-line px-1 py-0.5">
                        {src.input === 'select' ? (
                          <select value={v} onChange={(e) => set(e.target.value)} className={cls} aria-label={`${c.label} for ${r.id}`}>
                            <option value="">—</option>
                            {[...new Set([...(src.options ?? []), ...(v ? [v] : [])])].map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input type={src.input === 'number' ? 'number' : src.input === 'date' ? 'date' : 'text'} defaultValue={v} onBlur={(e) => e.target.value !== v && set(e.target.value)} className={cls} aria-label={`${c.label} for ${r.id}`} />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No applicants yet. They appear as applications come in.</p>}
        </div>
      </Panel>
    </div>
  )
}
