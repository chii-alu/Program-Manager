import React, { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileSpreadsheet, History, Loader2, UploadCloud, XCircle } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { Field, inputClass } from '../shared/components/NewSessionModal'
import { Portal, Role, interventions, pillarsFor, portalMeta } from '../shared/data/mela'
import { notify } from '../shared/lib/notify'
import { ExportModal } from '../shared/components/ExportModal'
import { Download } from 'lucide-react'

export const args = {
  role: 'admin',
  portal: 'admin',
  step: 'upload',
}

export const argTypes = {
  role: { control: 'select', options: ['admin', 'pillar_lead', 'pillar_staff', 'reviewer', 'none'] },
  portal: { control: 'radio', options: ['admin', 'hent', 'hemp', 'heco'] },
  step: { control: 'select', options: ['upload', 'map', 'dry-run', 'done'] },
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

const steps = [
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map columns' },
  { id: 'dry-run', label: 'Dry run' },
  { id: 'done', label: 'Commit' },
]

const mapping = [
  { col: 'Timestamp', sample: '02/11/2025 14:03', field: 'submitted_at', remembered: true },
  { col: 'Full Name', sample: 'Wanjiku Kamau', field: 'full_name', remembered: true },
  { col: 'Email Address', sample: 'w.kamau@alustudent.com', field: 'email', remembered: true },
  { col: 'Phone (WhatsApp)', sample: '+254 712 004 118', field: 'phone', remembered: true },
  { col: 'Student ID', sample: 'ALU-2023-1142', field: 'student_id', remembered: false },
  { col: 'Gender', sample: 'Female', field: 'gender', remembered: true },
  { col: 'Country of origin', sample: 'Kenya', field: 'country', remembered: false },
  { col: 'Why do you want to join?', sample: 'I want to work in digital…', field: 'answer', remembered: false },
  { col: 'I consent to CHII…', sample: 'Yes', field: 'consent', remembered: true },
]

const rejected = [
  { row: 'Row 17', reason: 'Consent', why: 'Consent is “No”' },
  { row: 'Row 42', reason: 'Consent', why: 'Consent is blank' },
  { row: 'Row 88', reason: 'Invalid email', why: 'Email is not valid: “mariam@”' },
  { row: 'Row 131', reason: 'Duplicate', why: 'Duplicate of row 12 in this file' },
  { row: 'Row 190', reason: 'Consent', why: 'Consent is “No”' },
  { row: 'Row 244', reason: 'No match key', why: 'No email, student ID or phone to match on' },
]

const fields = ['submitted_at', 'full_name', 'email', 'phone', 'student_id', 'gender', 'age', 'country', 'consent', 'answer', 'skip']

const batches = [
  { file: 'SIE Cohort 4 registrations.xlsx', who: 'Grace Wanjiru', when: '10 Nov', added: 214 },
  { file: 'Hackathon feedback export.csv', who: 'Tendai Moyo', when: '22 Oct', added: 88 },
  { file: 'Career Exposure Kigali.xlsx', who: 'Amara Okafor', when: '29 Oct', added: 96 },
]

export default function ImportSheet(props: Props) {
  const { role: r, portal: p, step: initialStep, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const [step, setStep] = useState(initialStep)
  const [file, setFile] = useState(initialStep !== 'upload')
  const [busy, setBusy] = useState(false)
  const idx = steps.findIndex((s) => s.id === step)
  const options = interventions.filter((i) => pillarsFor(portal).includes(i.pillar))

  const [reason, setReason] = useState<string | null>(null)
  const [exportRejected, setExportRejected] = useState(false)

  const next = () => {
    if (step === 'dry-run') {
      setBusy(true)
      setTimeout(() => {
        setBusy(false)
        setStep('done')
        notify({ title: 'Import finished · 252 rows added', body: `${options[0]?.name ?? 'Registrations'} · 3 rows rejected for consent`, tone: 'good', to: 'participants' })
      }, 800)
      return
    }
    setStep(steps[idx + 1].id)
  }

  return (
    <AppShell role={role} portal={portal} active="import" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <ExportModal
        open={exportRejected}
        onClose={() => setExportRejected(false)}
        title="Rejected rows · dry run"
        columns={[
          { key: 'row', label: 'Row' },
          { key: 'reason', label: 'Reason' },
          { key: 'why', label: 'Detail' },
        ]}
        rows={rejected}
        filtered={rejected.filter((r) => !reason || r.reason === reason)}
        filters={reason ? `Reason = ${reason}` : undefined}
        canSeeRestricted={false}
        defaultFormat="csv"
      />
      <div className="mx-auto max-w-[1100px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <PageHeader crumbs={[portalMeta[portal].label, 'Import a sheet']} title="Import a sheet" description="Bring registrations or feedback from a spreadsheet. Nothing is saved until you commit." />

        {/* Stepper: order matters here */}
        <ol className="grid grid-cols-4 gap-2">
          {steps.map((s, i) => {
            const done = i < idx
            const on = i === idx
            return (
              <li key={s.id} className="min-w-0">
                <div className={`h-1 rounded-full ${done || on ? 'bg-brand-600' : 'bg-line'}`} />
                <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium sm:text-sm ${on ? 'text-ink' : done ? 'text-brand-600' : 'text-faint'}`}>
                  {done && <Check className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{s.label}</span>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Panel>
            {step === 'upload' && (
              <div className="space-y-4 p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Intervention">
                    <select className={inputClass}>
                      {options.map((o) => (
                        <option key={o.id}>
                          {o.pillar} · {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="What's in the sheet?">
                    <select className={inputClass}>
                      <option>Registrations / applications</option>
                      <option>Feedback responses</option>
                    </select>
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(true)}
                  className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ease-out ${
                    file ? 'border-good/50 bg-good-bg' : 'border-line-strong hover:border-brand-600 hover:bg-brand-50'
                  }`}
                >
                  {file ? (
                    <>
                      <FileSpreadsheet className="h-8 w-8 text-good" />
                      <span className="mt-3 text-sm font-semibold">SIE Cohort 5 applications.xlsx</span>
                      <span className="mt-0.5 text-xs text-muted">258 rows · 9 columns · 64 KB</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-8 w-8 text-muted" />
                      <span className="mt-3 text-sm font-semibold">Drop a file or click to browse</span>
                      <span className="mt-0.5 text-xs text-muted">.xlsx or .csv, up to 10 MB</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {step === 'map' && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
                  <h2 className="text-sm font-semibold">Match sheet columns to platform fields</h2>
                  <span className="text-xs text-muted">6 of 9 remembered from your last import</span>
                </div>
                <ul className="divide-y divide-line">
                  {mapping.map((m) => (
                    <li key={m.col} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_24px_200px] sm:items-center sm:px-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{m.col}</span>
                          {m.remembered && <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">Remembered</span>}
                        </div>
                        <div className="truncate text-xs text-muted">e.g. {m.sample}</div>
                      </div>
                      <ArrowRight className="hidden h-4 w-4 text-faint sm:block" />
                      <select defaultValue={m.field} className="h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-sm outline-none focus:border-brand-600">
                        {fields.map((f) => (
                          <option key={f} value={f}>
                            {f === 'skip' ? 'Don’t import' : f === 'answer' ? 'Extra answer (Q column)' : f}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 'dry-run' && (
              <div>
                <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
                  {[
                    ['Will be added', 214, 'text-good'],
                    ['Matched to a CHII ID', 38, 'text-brand-600'],
                    ['Rejected', 6, 'text-bad'],
                  ].map(([k, v, c]) => (
                    <div key={k as string} className="px-4 py-4 sm:px-5">
                      <div className={`text-2xl font-semibold tabular-nums ${c}`}>{v}</div>
                      <div className="mt-0.5 text-xs text-muted">{k}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-4 sm:px-5">
                  <h3 className="mr-auto text-sm font-semibold">Rejected rows</h3>
                  <Button className="h-8 px-3 text-xs" onClick={() => setExportRejected(true)}>
                    <Download className="h-3.5 w-3.5" /> Download to fix
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-5">
                  {['All', ...Array.from(new Set(rejected.map((r) => r.reason)))].map((k) => {
                    const on = (k === 'All' && !reason) || reason === k
                    const n = k === 'All' ? rejected.length : rejected.filter((r) => r.reason === k).length
                    return (
                      <button key={k} type="button" onClick={() => setReason(k === 'All' ? null : k)} aria-pressed={on} className={`h-7 rounded-full border px-2.5 text-xs font-medium transition-colors duration-150 ease-out ${on ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line-strong text-body hover:bg-canvas'}`}>
                        {k} <span className="tabular-nums text-muted">{n}</span>
                      </button>
                    )
                  })}
                </div>
                <ul className="divide-y divide-line border-t border-line">
                  {rejected.filter((r) => !reason || r.reason === reason).map(({ row, why }) => (
                    <li key={row} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                      <XCircle className="h-4 w-4 shrink-0 text-bad" />
                      <span className="w-16 shrink-0 font-mono text-xs text-muted">{row}</span>
                      <span className="min-w-0 truncate text-body">{why}</span>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">This is a dry run. Nothing has been saved yet.</p>
              </div>
            )}

            {step === 'done' && (
              <div className="px-6 py-12 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-good" />
                <h2 className="mt-4 text-lg font-semibold">252 rows imported</h2>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">214 new people got CHII IDs and 38 were added to existing records. Recorded as batch #IMP-0193.</p>
                <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                  <Button onClick={() => (setStep('upload'), setFile(false))}>Import another</Button>
                  <Button variant="primary" onClick={() => onNavigate?.('participants')}>
                    View participants
                  </Button>
                </div>
              </div>
            )}

            {step !== 'done' && (
              <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 sm:px-5">
                <Button className={idx === 0 ? 'invisible' : ''} onClick={() => setStep(steps[idx - 1].id)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <button
                  type="button"
                  disabled={!file || busy}
                  onClick={next}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-brand-hover disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {step === 'upload' ? 'Continue' : step === 'map' ? 'Run dry run' : busy ? 'Committing…' : 'Commit 252 rows'}
                  {!busy && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            )}
          </Panel>

          <Panel className="self-start">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold">
              <History className="h-4 w-4 text-muted" /> Recent batches
            </h2>
            <ul className="divide-y divide-line">
              {batches.map((b) => (
                <li key={b.file} className="px-4 py-3">
                  <div className="truncate text-sm font-medium">{b.file}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {b.who} · {b.when} · {b.added} rows
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  )
}
