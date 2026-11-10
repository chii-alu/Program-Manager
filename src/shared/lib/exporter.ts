import { useEffect, useState } from 'react'
import { format as fmtDate } from 'date-fns'
import { notify } from './notify'

export type ExportFormat = 'xlsx' | 'csv' | 'pdf' | 'json'
export type ExportColumn = { key: string; label: string; restricted?: boolean }
export type ExportRow = Record<string, unknown>

export const formatMeta: Record<ExportFormat, { label: string; ext: string; mime: string }> = {
  xlsx: { label: 'Excel', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  csv: { label: 'CSV', ext: 'csv', mime: 'text/csv;charset=utf-8' },
  pdf: { label: 'PDF', ext: 'pdf', mime: 'application/pdf' },
  json: { label: 'JSON', ext: 'json', mime: 'application/json' },
}

function cell(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/** Builds a real file in the browser and downloads it, then records it in the export log. */
export async function exportData(opts: {
  filename: string
  title: string
  columns: ExportColumn[]
  rows: ExportRow[]
  format: ExportFormat
  includeRestricted: boolean
  filters?: string
  who?: string
}) {
  const cols = opts.columns.filter((c) => opts.includeRestricted || !c.restricted)
  const restrictedDropped = opts.columns.some((c) => c.restricted) && !opts.includeRestricted
  const name = `${opts.filename}${restrictedDropped ? ' - de-identified' : ''}.${formatMeta[opts.format].ext}`
  const matrix = opts.rows.map((r) => cols.map((c) => cell(r[c.key])))

  if (opts.format === 'csv') {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
    const text = [cols.map((c) => esc(c.label)).join(','), ...matrix.map((r) => r.map(esc).join(','))].join('\r\n')
    download(new Blob(['\ufeff' + text], { type: formatMeta.csv.mime }), name)
  } else if (opts.format === 'json') {
    const data = opts.rows.map((r) => Object.fromEntries(cols.map((c) => [c.label, r[c.key] ?? null])))
    download(new Blob([JSON.stringify(data, null, 2)], { type: formatMeta.json.mime }), name)
  } else if (opts.format === 'xlsx') {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet([cols.map((c) => c.label), ...opts.rows.map((r) => cols.map((c) => (typeof r[c.key] === 'number' ? (r[c.key] as number) : cell(r[c.key]))))])
    sheet['!cols'] = cols.map((c, i) => ({ wch: Math.min(40, Math.max(c.label.length, ...matrix.slice(0, 50).map((r) => r[i].length)) + 2) }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, opts.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ''))
    XLSX.writeFile(book, name)
  } else {
    const { default: JsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new JsPDF({ orientation: cols.length > 5 ? 'landscape' : 'portrait', unit: 'pt' })
    doc.setFontSize(14)
    doc.text(opts.title, 40, 40)
    doc.setFontSize(9)
    doc.setTextColor(102, 112, 137)
    doc.text(`CHII · MELA Manager · ${fmtDate(new Date(), 'd MMM yyyy, HH:mm')} · ${opts.rows.length} rows${restrictedDropped ? ' · de-identified' : ''}`, 40, 56)
    autoTable(doc, {
      head: [cols.map((c) => c.label)],
      body: matrix,
      startY: 70,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [19, 48, 107] },
      alternateRowStyles: { fillColor: [244, 246, 250] },
    })
    doc.save(name)
  }

  logExport({ who: opts.who ?? 'You', what: opts.title, filters: opts.filters || 'None', rows: opts.rows.length, restricted: !restrictedDropped && opts.columns.some((c) => c.restricted), format: opts.format })
  notify({ title: `Downloaded ${name}`, body: `${opts.rows.length.toLocaleString()} rows · recorded in the export log`, tone: 'good', to: 'data' })
  return name
}

/* ---------- Export log (persisted) ---------- */

export type LogEntry = { id: string; who: string; what: string; when: string; filters: string; rows: number; restricted: boolean; format: string }
const LOG = 'mela-export-log'

function logExport(e: Omit<LogEntry, 'id' | 'when'>) {
  const entry: LogEntry = { ...e, id: `x${Date.now()}`, when: fmtDate(new Date(), 'd MMM, HH:mm') }
  try {
    const prev = JSON.parse(localStorage.getItem(LOG) || '[]') as LogEntry[]
    localStorage.setItem(LOG, JSON.stringify([entry, ...prev].slice(0, 100)))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(LOG))
}

export function useExportLog(seed: LogEntry[]) {
  const read = () => {
    try {
      return [...(JSON.parse(localStorage.getItem(LOG) || '[]') as LogEntry[]), ...seed]
    } catch {
      return seed
    }
  }
  const [items, setItems] = useState<LogEntry[]>(read)
  useEffect(() => {
    const h = () => setItems(read())
    window.addEventListener(LOG, h)
    return () => window.removeEventListener(LOG, h)
  }, [])
  return items
}
