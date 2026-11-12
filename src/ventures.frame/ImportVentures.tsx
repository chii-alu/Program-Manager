/**
 * Import the HENT venture sheet (VENTURE-REGISTRY-SPEC §3, build step 4):
 * choose the sheet → check the column matches → dry run → import as baselines.
 */
import React, { useMemo, useRef, useState } from 'react'
import { AlertOctagon, AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardPaste, FileSpreadsheet, Link2, Upload, UserPlus } from 'lucide-react'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { toast } from '../shared/lib/notify'
import { REPORTING_DATE } from '../shared/ventures/derive'
import { IMPORT_FIELDS, autoMap, findHeaderRow, loadSavedMapping, parseDelimited, planImport, runImport, sampleSheet, saveMapping, type ImportField, type ImportPlan, type Mapping, type PlannedRow } from '../shared/ventures/importer'
import type { RegistryData } from '../shared/ventures/types'
import { Chip, Field, inputCls } from './parts'

type Sheet = { name: string; rows: string[][]; headerRow: number }
type Step = 1 | 2 | 3 | 4

const STEPS = ['Choose the sheet', 'Check the columns', 'Dry run', 'Done']

export function ImportVentures({ data, me, onOpen }: { data: RegistryData; me: string; onOpen: (id: string) => void }) {
  const [step, setStep] = useState<Step>(1)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [mapping, setMapping] = useState<Mapping>([])
  const [savedUsed, setSavedUsed] = useState(false)
  const [intakeYear, setIntakeYear] = useState(Number(REPORTING_DATE.slice(0, 4)))
  const [asOf, setAsOf] = useState(REPORTING_DATE)
  // The dry run as it was when imported: afterwards the same rows read as "already in the registry".
  const [result, setResult] = useState<(ReturnType<typeof runImport> & { plan: ImportPlan }) | null>(null)
  const settings = { intakeYear, asOf, by: `${me} · venture sheet import` }

  const load = (name: string, rows: string[][]) => {
    const clean = rows.filter((r) => r.some((c) => String(c ?? '').trim()))
    if (clean.length < 2) return toast({ title: 'That sheet looks empty', body: 'It needs a row of column names and at least one venture.', tone: 'bad' })
    const headerRow = findHeaderRow(clean)
    const saved = loadSavedMapping(clean[headerRow])
    setSheet({ name, rows: clean, headerRow })
    setMapping(saved ?? autoMap(clean[headerRow]))
    setSavedUsed(!!saved)
    setStep(2)
  }

  const plan = useMemo(() => (sheet && step >= 3 ? planImport(sheet.rows, sheet.headerRow, mapping, settings, data) : null), [sheet, mapping, step, intakeYear, asOf, data])

  return (
    <>
      <PageHeader
        crumbs={['HENT', 'Ventures', 'Import']}
        title="Import ventures"
        description="Bring in the HENT venture sheet. A dry run checks every row first; nothing is saved until you import. Each row becomes the venture’s baseline."
      />
      <ol className="no-scrollbar flex gap-1 overflow-x-auto rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface p-1.5 shadow-[var(--shadow-soft)]">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step
          const on = n === step
          const done = n < step
          return (
            <li key={label} className={on ? 'min-w-0 flex-1' : 'shrink-0 md:min-w-0 md:flex-1'}>
              <span className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-[13px] ${on ? 'bg-brand text-white' : 'text-body'}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${on ? 'bg-white text-brand' : done ? 'bg-good text-white' : 'border border-line-strong'}`}>{done ? <Check className="h-3.5 w-3.5" /> : n}</span>
                <span className={on ? 'font-semibold' : 'hidden font-semibold md:inline'}>{label}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {step === 1 && <ChooseSheet onLoad={load} />}
      {step === 2 && sheet && (
        <ColumnsStep sheet={sheet} mapping={mapping} setMapping={setMapping} savedUsed={savedUsed} intakeYear={intakeYear} setIntakeYear={setIntakeYear} asOf={asOf} setAsOf={setAsOf} onBack={() => setStep(1)} onNext={() => (saveMapping(sheet.rows[sheet.headerRow], mapping), setStep(3))} />
      )}
      {step === 3 && plan && (
        <DryRun
          plan={plan}
          onBack={() => setStep(2)}
          onImport={() => {
            const r = runImport(plan, settings)
            setResult({ ...r, plan })
            setStep(4)
            toast({ title: `Imported ${r.created.length} venture${r.created.length === 1 ? '' : 's'}`, body: 'Each row is stored as the venture’s baseline.', tone: 'good' })
          }}
        />
      )}
      {step === 4 && result && (
        <Panel title="Import finished">
          <div className="space-y-4 p-4 sm:p-5">
            <p className="flex items-center gap-2 text-sm text-good">
              <CheckCircle2 className="h-5 w-5" /> <b>{result.created.length} ventures added</b>
              <span className="text-muted">
                · {result.plan.counts.existing} already in the registry · {result.plan.counts.blocked} blocked
                {result.skipped.length ? ` · ${result.skipped.length} skipped` : ''}
              </span>
            </p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {result.created.map((c) => {
                const r = result.plan.rows.find((x) => x.line === c.line)!
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <span className="font-mono text-brand-600">{c.code}</span>
                    <span className="min-w-0 flex-1 font-medium text-ink">{r.name}</span>
                    {r.legacyId && <span className="text-xs text-muted">was {r.legacyId}</span>}
                    <button type="button" onClick={() => onOpen(c.id)} className="text-xs font-semibold text-brand-600 hover:underline">
                      Open
                    </button>
                  </li>
                )
              })}
            </ul>
            {result.skipped.map((s) => (
              <p key={s.line} className="text-xs text-bad">
                Row {s.line}: {s.reason}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => (setSheet(null), setResult(null), setStep(1))}>Import another sheet</Button>
              <Button variant="primary" onClick={() => setStep(3)}>
                Run the dry run again
              </Button>
            </div>
            <p className="text-xs text-muted">Running the dry run again on the same sheet shows every row as already in the registry, so nothing is added twice.</p>
          </div>
        </Panel>
      )}
    </>
  )
}

/* ---------- 1. Choose the sheet ---------- */

function ChooseSheet({ onLoad }: { onLoad: (name: string, rows: string[][]) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [paste, setPaste] = useState('')
  const readFile = async (f: File | undefined) => {
    if (!f) return
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      // The sheet with a "Venture Name" column, or the first one.
      const sheets = wb.SheetNames.map((n) => ({ n, rows: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[n], { header: 1, raw: false, defval: '' }) }))
      const pick = sheets.find((s) => s.rows.some((r) => r.some((c) => /venture\s*name/i.test(String(c))))) ?? sheets[0]
      onLoad(`${f.name} · ${pick.n}`, pick.rows.map((r) => r.map((c) => String(c ?? ''))))
    } else onLoad(f.name, parseDelimited(await f.text()))
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Upload the sheet" sub="Excel (.xlsx) or CSV. The sheet with a “Venture Name” column is used.">
        <div className="p-4 sm:p-5">
          <button
            type="button"
            onClick={() => file.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => (e.preventDefault(), readFile(e.dataTransfer.files[0]))}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line-strong px-4 py-10 text-center hover:bg-canvas"
          >
            <Upload className="h-6 w-6 text-brand-600" />
            <span className="text-sm font-semibold text-ink">Choose a file or drop it here</span>
            <span className="text-xs text-muted">.xlsx, .xls or .csv</span>
          </button>
          <input ref={file} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
          <button type="button" onClick={() => onLoad('Sample venture sheet', parseDelimited(sampleSheet()))} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Or try it with a sample sheet in the HENT layout
          </button>
        </div>
      </Panel>
      <Panel title="Or paste the rows" sub="Copy the rows from the spreadsheet, headings included, and paste them here.">
        <div className="space-y-3 p-4 sm:p-5">
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Venture ID	Venture Name	Description …" className={`${inputCls} h-40 py-2 font-mono text-xs`} />
          <Button variant="primary" onClick={() => paste.trim() && onLoad('Pasted rows', parseDelimited(paste))}>
            <ClipboardPaste className="h-4 w-4" /> Use these rows
          </Button>
        </div>
      </Panel>
    </div>
  )
}

/* ---------- 2. Columns ---------- */

function ColumnsStep({
  sheet,
  mapping,
  setMapping,
  savedUsed,
  intakeYear,
  setIntakeYear,
  asOf,
  setAsOf,
  onBack,
  onNext,
}: {
  sheet: Sheet
  mapping: Mapping
  setMapping: (m: Mapping) => void
  savedUsed: boolean
  intakeYear: number
  setIntakeYear: (n: number) => void
  asOf: string
  setAsOf: (s: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const headers = sheet.rows[sheet.headerRow]
  const sample = sheet.rows[sheet.headerRow + 1] ?? []
  const missing = IMPORT_FIELDS.filter((f) => f.required && !mapping.includes(f.key))
  const hasIntake = mapping.includes('intake_year')
  const set = (i: number, key: ImportField | null) => setMapping(mapping.map((m, j) => (j === i ? key : m === key && key ? null : m)))
  const data = sheet.rows.length - sheet.headerRow - 1

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Match the columns" sub={`${sheet.name} · ${data} rows · ${savedUsed ? 'using the mapping saved last time' : 'matched automatically from the headings'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="bg-brand-50/60 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-brand-600">
                <th className="px-4 py-2.5">Sheet column</th>
                <th className="px-4 py-2.5">First row</th>
                <th className="px-4 py-2.5">Registry field</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {headers.map((h, i) => {
                const [first, ...rest] = String(h ?? '').split(/\r?\n/)
                return (
                  <tr key={i} className={mapping[i] ? '' : 'bg-canvas/60'}>
                    <td className="px-4 py-2">
                      <span className="font-semibold text-ink">{first || `Column ${i + 1}`}</span>
                      {rest.length > 0 && <span className="block text-[11px] text-muted">{rest.join(' ').trim()}</span>}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2 text-muted">{sample[i] || '—'}</td>
                    <td className="px-4 py-2">
                      <select className={`${inputCls} h-9`} value={mapping[i] ?? ''} onChange={(e) => set(i, (e.target.value || null) as ImportField | null)}>
                        <option value="">Don’t import</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
        <Panel title="For every row" sub="The sheet doesn’t have these, so they apply to all rows.">
          <div className="space-y-4 p-4">
            <Field label="Intake year" hint={hasIntake ? 'Used only where the intake year column is empty.' : 'The year these ventures joined the CHII portfolio. It drives the Year filter and cohort charts.'}>
              <input type="number" className={inputCls} value={intakeYear} min={2015} max={2025} onChange={(e) => setIntakeYear(Number(e.target.value))} />
            </Field>
            <Field label="Baseline date" hint="The date the sheet’s numbers describe. Stored as the baseline’s “as of” date.">
              <input type="date" className={inputCls} value={asOf} max={REPORTING_DATE} onChange={(e) => setAsOf(e.target.value)} />
            </Field>
            <p className="text-xs text-muted">Currency is read from Funding Raised (e.g. “KES 50,000”); amounts without one are in USD.</p>
          </div>
        </Panel>
        {missing.length > 0 ? (
          <p className="flex gap-2 rounded-lg border border-bad/30 bg-bad-bg px-3 py-2.5 text-sm text-bad">
            <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" /> Match a column to: {missing.map((f) => f.label).join(', ')}.
          </p>
        ) : (
          <p className="flex gap-2 rounded-lg border border-good/30 bg-good-bg px-3 py-2.5 text-sm text-good">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> All required fields are matched. The mapping is saved for next time.
          </p>
        )}
        <div className="flex justify-between gap-2">
          <Button onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="primary" onClick={() => missing.length === 0 && onNext()} className={missing.length ? 'pointer-events-none opacity-50' : ''}>
            Run the dry run <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </aside>
    </div>
  )
}

/* ---------- 3. Dry run ---------- */

const OUTCOME = {
  new: { label: 'New', cls: 'bg-good-bg text-good' },
  existing: { label: 'Already in registry', cls: 'bg-canvas text-muted' },
  blocked: { label: 'Blocked', cls: 'bg-bad-bg text-bad' },
} as const

function DryRun({ plan, onBack, onImport }: { plan: ImportPlan; onBack: () => void; onImport: () => void }) {
  const [filter, setFilter] = useState<'all' | 'new' | 'warnings' | 'blocked' | 'existing'>('all')
  const c = plan.counts
  const shown = plan.rows.filter((r) => (filter === 'all' ? true : filter === 'warnings' ? r.outcome === 'new' && r.warnings.length > 0 : r.outcome === filter))
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Will be added" value={c.new} tone="good" />
        <Tile label="With warnings" value={c.warnings} hint="added, but check them" tone="warn" />
        <Tile label="Blocked" value={c.blocked} hint="fix in the sheet, then re-run" tone="bad" />
        <Tile label="Already in registry" value={c.existing} hint="skipped, nothing changes" />
        <Tile label="Founders" value={c.foundersMatched + c.foundersNew} hint={`${c.foundersMatched} matched · ${c.foundersNew} new CHII IDs`} />
      </div>

      <Panel title="Dry run" sub="Nothing has been saved yet. Each row shows what will happen to it.">
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
          {(
            [
              ['all', `All rows ${plan.rows.length}`],
              ['new', `New ${c.new}`],
              ['warnings', `Warnings ${c.warnings}`],
              ['blocked', `Blocked ${c.blocked}`],
              ['existing', `Already in registry ${c.existing}`],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>
              {label}
            </Chip>
          ))}
        </div>
        <ul className="divide-y divide-line">
          {shown.map((r) => (
            <DryRunRow key={r.line} r={r} />
          ))}
        </ul>
      </Panel>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:pl-5 sm:pr-24">
        <Button onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back to columns
        </Button>
        <span className="text-xs text-muted">{c.blocked ? `${c.blocked} blocked row${c.blocked === 1 ? '' : 's'} won’t be imported. ` : ''}You can fix them in the sheet and import again later.</span>
        <Button variant="primary" onClick={() => c.new > 0 && onImport()} className={c.new ? '' : 'pointer-events-none opacity-50'}>
          <Check className="h-4 w-4" /> Import {c.new} venture{c.new === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  )
}

function DryRunRow({ r }: { r: PlannedRow }) {
  const o = OUTCOME[r.outcome]
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-14 shrink-0 text-xs tabular-nums text-faint">Row {r.line}</span>
        <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
          {r.name || <span className="italic text-muted">No name</span>}
          {r.legacyId && <span className="ml-2 font-mono text-xs font-normal text-muted">{r.legacyId}</span>}
        </span>
        {r.outcome !== 'existing' && (
          <span className="text-xs text-muted">
            {r.founder.status === 'matched' ? (
              <span className="inline-flex items-center gap-1 text-good">
                <Link2 className="h-3 w-3" /> Founder matched to <span className="font-mono">{r.founder.chiiId}</span> by {r.founder.matchedOn}
              </span>
            ) : r.founder.status === 'new' ? (
              <span className="inline-flex items-center gap-1">
                <UserPlus className="h-3 w-3" /> New CHII ID for the founder
              </span>
            ) : (
              'No founder linked'
            )}
          </span>
        )}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${o.cls}`}>{r.outcome === 'existing' ? `In registry as ${r.existingCode}` : o.label}</span>
      </div>
      {(r.errors.length > 0 || r.warnings.length > 0) && (
        <ul className="mt-1.5 space-y-0.5 pl-[68px] text-[12.5px]">
          {r.errors.map((e) => (
            <li key={e} className="flex gap-1.5 text-bad">
              <AlertOctagon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e}
            </li>
          ))}
          {r.warnings.map((w) => (
            <li key={w} className="flex gap-1.5 text-warn">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Tile({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-brand-deep'
  return (
    <div className="rounded-[var(--radius-card)] bg-surface px-4 py-3.5 text-center" style={{ border: '1px solid var(--stat-border)', borderLeft: '5px solid var(--color-brand)', boxShadow: 'var(--shadow-soft)' }}>
      <p className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--stat-label)]">{label}</p>
      <p className={`mt-1.5 font-display text-[26px] font-semibold leading-none tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1.5 text-[11px] text-muted">{hint}</p>}
    </div>
  )
}
