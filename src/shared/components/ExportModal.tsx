import React, { useEffect, useState } from 'react'
import { Braces, Check, Download, FileSpreadsheet, FileText, FileType2, Loader2, Lock } from 'lucide-react'
import { Modal } from './Modal'
import { ExportColumn, ExportFormat, ExportRow, exportData } from '../lib/exporter'
import { toast } from '../lib/notify'

/** Real download dialog: format, rows, restricted columns and file name. Builds the file in the browser. */
export function ExportModal({
  open,
  onClose,
  title,
  columns,
  rows,
  filtered,
  canSeeRestricted,
  filters,
  defaultFormat = 'xlsx',
}: {
  open: boolean
  onClose: () => void
  title: string
  columns: ExportColumn[]
  rows: ExportRow[]
  filtered?: ExportRow[]
  canSeeRestricted: boolean
  filters?: string
  defaultFormat?: ExportFormat
}) {
  const [format, setFormat] = useState<ExportFormat>(defaultFormat)
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered')
  const [restricted, setRestricted] = useState(false)
  const [name, setName] = useState(title)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const hasRestricted = columns.some((c) => c.restricted)
  const visible = filtered ?? rows

  useEffect(() => {
    if (open) {
      setFormat(defaultFormat)
      setName(title.replace(/[\\/:*?"<>|]/g, '-'))
      setDone(null)
      setRestricted(false)
    }
  }, [open, title, defaultFormat])

  const formats: { id: ExportFormat; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'xlsx', label: 'Excel', hint: '.xlsx', icon: FileSpreadsheet },
    { id: 'csv', label: 'CSV', hint: '.csv', icon: FileType2 },
    { id: 'pdf', label: 'PDF', hint: '.pdf', icon: FileText },
    { id: 'json', label: 'JSON', hint: '.json', icon: Braces },
  ]
  const count = scope === 'filtered' ? visible.length : rows.length

  const run = async () => {
    setBusy(true)
    try {
      const file = await exportData({
        filename: name || title,
        title,
        columns,
        rows: scope === 'filtered' ? visible : rows,
        format,
        includeRestricted: canSeeRestricted && restricted,
        filters: scope === 'filtered' ? filters : 'None (whole sheet)',
      })
      setDone(file)
    } catch {
      toast({ title: 'Export failed', body: 'Try again, or pick another format.', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? 'Downloaded' : 'Export data'}
      description={done ? 'Recorded in the export log.' : title}
      icon={done ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      size="sm"
      footer={
        done ? (
          <button type="button" onClick={onClose} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">
            Done
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} className="h-10 rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-canvas">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || count === 0}
              onClick={run}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {busy ? 'Building file…' : `Download ${count.toLocaleString()} rows`}
            </button>
          </>
        )
      }
    >
      {done ? (
        <div className="rounded-lg border border-line bg-canvas px-3.5 py-3 text-sm">
          <div className="break-all font-medium">{done}</div>
          <div className="mt-0.5 text-xs text-muted">{count.toLocaleString()} rows · saved to your downloads</div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-[13px] font-medium text-body">Format</div>
            <div className="grid grid-cols-4 gap-2">
              {formats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  aria-pressed={format === f.id}
                  className={`flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-lg border text-sm font-medium transition-colors duration-150 ease-out ${
                    format === f.id ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line-strong text-body hover:bg-canvas'
                  }`}
                >
                  <f.icon className="h-4 w-4" />
                  {f.label}
                  <span className="text-[10px] font-normal text-muted">{f.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium text-body">Rows</div>
            <div className="space-y-2">
              {[
                { id: 'filtered' as const, label: 'Rows on screen', hint: `${visible.length.toLocaleString()} rows${filters ? ` · ${filters}` : ''}` },
                { id: 'all' as const, label: 'Whole sheet', hint: `${rows.length.toLocaleString()} rows, ignoring filters` },
              ].map((o) => (
                <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ${scope === o.id ? 'border-brand-600 bg-brand-50' : 'border-line-strong'}`}>
                  <input type="radio" name="scope" checked={scope === o.id} onChange={() => setScope(o.id)} className="accent-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{o.label}</span>
                    <span className="block truncate text-xs text-muted">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {hasRestricted &&
            (canSeeRestricted ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-strong px-3 py-2.5">
                <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} className="mt-0.5 accent-brand" />
                <span>
                  <span className="block text-sm font-medium">Include restricted columns</span>
                  <span className="block text-xs leading-5 text-muted">Names and contacts. Logged as a restricted export.</span>
                </span>
              </label>
            ) : (
              <p className="flex gap-2 rounded-lg bg-canvas px-3 py-2.5 text-xs leading-5 text-muted">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Identity columns are removed for your role and the file is named “de-identified”.
              </p>
            ))}
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-body">File name</span>
            <div className="flex h-10 items-center overflow-hidden rounded-lg border border-line-strong bg-surface focus-within:border-brand-600 focus-within:ring-3 focus-within:ring-brand-100">
              <input value={name} onChange={(e) => setName(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
              <span className="shrink-0 border-l border-line bg-canvas px-2.5 text-xs leading-10 text-muted">.{format}</span>
            </div>
          </label>
        </div>
      )}
    </Modal>
  )
}
