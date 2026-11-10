import React, { useState } from 'react'
import { Download, FileClock, Lock, ShieldAlert } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { AdminOnly, PageHeader, Panel } from '../shared/components/ui'
import { Column, DataTable } from '../shared/components/DataTable'
import { ExportModal } from '../shared/components/ExportModal'
import { Portal, Role, exportLog, feedbackRows, participants, sessions, tableCounts } from '../shared/data/mela'
import { ExportColumn, ExportRow, LogEntry, useExportLog } from '../shared/lib/exporter'

export const args = {
  role: 'admin',
  portal: 'admin',
}

export const argTypes = {
  role: { control: 'select', options: ['admin', 'pillar_lead', 'pillar_staff', 'reviewer', 'none'] },
  portal: { control: 'radio', options: ['admin', 'hent', 'hemp', 'heco'] },
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

export default function DataExports(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const [table, setTable] = useState<string | null>(null)
  const log = useExportLog(exportLog)
  const max = Math.max(...tableCounts.map((t) => t.rows))
  const data = table ? tableData(table) : { columns: [], rows: [] }

  const logCols: Column<LogEntry>[] = [
    { key: 'when', label: 'When', filterable: false, render: (e) => <span className="whitespace-nowrap text-muted">{e.when}</span> },
    { key: 'who', label: 'Who', render: (e) => <span className="whitespace-nowrap font-medium">{e.who}</span> },
    { key: 'what', label: 'What', render: (e) => <span className="text-body">{e.what}</span> },
    { key: 'format', label: 'Format', value: (e) => e.format.toUpperCase() },
    { key: 'filters', label: 'Filters', filterable: false, hideBelow: 'xl', render: (e) => <span className="block max-w-[220px] truncate text-xs text-muted">{e.filters}</span> },
    { key: 'rows', label: 'Rows', numeric: true },
    {
      key: 'restricted',
      label: 'Identity',
      value: (e) => (e.restricted ? 'Included' : 'De-identified'),
      render: (e) =>
        e.restricted ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">
            <ShieldAlert className="h-3 w-3" /> Included
          </span>
        ) : (
          <span className="text-xs text-muted">De-identified</span>
        ),
    },
  ]

  return (
    <AppShell role={role} portal={portal} active="data" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      {role !== 'admin' ? (
        <AdminOnly />
      ) : (
        <div className="mx-auto max-w-[1240px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <ExportModal open={!!table} onClose={() => setTable(null)} title={table ?? ''} columns={data.columns} rows={data.rows} canSeeRestricted defaultFormat="csv" />

          <PageHeader crumbs={['MELA', 'Data & exports']} title="Data & exports" description="Row counts for the dashboard feed, file exports and the tamper-proof export log." />

          <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <Panel className="self-start">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold">Tables</h2>
                <span className="text-xs text-muted">Live row counts</span>
              </div>
              <ul className="divide-y divide-line">
                {tableCounts.map((t) => (
                  <li key={t.table} className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 ease-out hover:bg-canvas sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[13px]">{t.table}</span>
                        <span className={`rounded px-1 text-[10px] font-semibold ${t.model === 'CHII' ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-muted'}`}>{t.model}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-canvas">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${(t.rows / max) * 100}%` }} />
                      </div>
                    </div>
                    <span className="w-12 text-right text-sm tabular-nums">{t.rows.toLocaleString()}</span>
                    <button type="button" onClick={() => setTable(t.table)} title={`Export ${t.table}`} aria-label={`Export ${t.table}`} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
                      <Download className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>

            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">Export log</h2>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Lock className="h-3 w-3" /> Read-only · every download on the platform is recorded here
                </span>
              </div>
              <DataTable
                title="Export log"
                rows={log}
                columns={logCols}
                rowKey={(e) => e.id}
                compact
                searchPlaceholder="Search who, what or filters"
                emptyIcon={FileClock}
                empty={{ title: 'No exports yet', body: 'Downloads from any table appear here with who, what and how many rows.' }}
                mobileRow={(e) => (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-sm font-medium">{e.what}</span>
                      {e.restricted && <ShieldAlert className="h-4 w-4 shrink-0 text-warn" aria-label="Restricted columns included" />}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {e.who} · {e.when} · {e.rows.toLocaleString()} rows · {e.format.toUpperCase()}
                    </div>
                  </div>
                )}
              />
            </section>
          </div>
        </div>
      )}
    </AppShell>
  )
}

/** The rows behind each table, so its export is a real file. */
function tableData(table: string): { columns: ExportColumn[]; rows: ExportRow[] } {
  if (table === 'beneficiary' || table === 'participation') {
    return {
      columns: [
        { key: 'id', label: 'chii_id' },
        { key: 'name', label: 'full_name', restricted: true },
        { key: 'email', label: 'email', restricted: true },
        { key: 'gender', label: 'gender' },
        { key: 'age', label: 'age' },
        { key: 'country', label: 'country' },
        { key: 'pillars', label: 'pillars' },
        { key: 'interventions', label: 'interventions' },
        { key: 'joined', label: 'first_seen' },
      ],
      rows: participants,
    }
  }
  if (table === 'cohort_feedback') {
    return {
      columns: ['chiiId', 'date', 'pillar', 'intervention', 'session', 'satisfaction', 'relevance', 'nps', 'comment'].map((k) => ({ key: k, label: k })),
      rows: feedbackRows,
    }
  }
  if (table === 'sessions') {
    return { columns: ['id', 'name', 'intervention', 'pillar', 'kind', 'dates', 'status', 'registered', 'attended', 'feedback'].map((k) => ({ key: k, label: k })), rows: sessions }
  }
  return {
    columns: [
      { key: 'chii_id', label: 'chii_id' },
      { key: 'session', label: 'session' },
      { key: 'date', label: 'date' },
    ],
    rows: participants.flatMap((x) => x.interventions.map((iv) => ({ chii_id: x.id, session: iv, date: x.lastActive }))),
  }
}
