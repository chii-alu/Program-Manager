import React, { useMemo, useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Download, FileSpreadsheet, FileText, FileType2, Filter, Lock, Search, X } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { Popover, MenuItem } from '../shared/components/Popover'
import { ExportModal } from '../shared/components/ExportModal'
import { EmptyState } from '../shared/components/EmptyState'
import { Pillar, Portal, Role, canSeeIdentity, feedbackRows, participants, pillarsFor, portalMeta } from '../shared/data/mela'
import { ExportFormat } from '../shared/lib/exporter'
import { inRange, useTimeRange } from '../shared/lib/time'

export const args = {
  role: 'admin',
  portal: 'hemp',
  sheet: 'participants',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onSheetChange?: (s: string) => void
}

type Col = { key: string; label: string; restricted?: boolean; numeric?: boolean; extra?: boolean }
type Row = Record<string, string | number>

export default function ConsolidatedSheet(props: Props) {
  const { role: r, portal: p, sheet, onNavigate, onPortalChange, onSignOut, onSheetChange } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const pillars = pillarsFor(portal)
  const pillarLabel = portal === 'admin' ? 'All pillars' : portalMeta[portal].label
  const showId = canSeeIdentity(role)
  const [tab, setTab] = useState('All interventions')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [colFilters, setColFilters] = useState<Record<string, string[]>>({})
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const { range, label } = useTimeRange()

  const built = useMemo(() => build(sheet, pillars), [sheet, portal])
  const cols = built.cols
  const rows = useMemo(() => built.rows.filter((r) => inRange(range, String(r.date))), [built, range])
  const visibleCols = cols.filter((c) => showId || !c.restricted)
  const sheetTabs = ['All interventions', ...Array.from(new Set(rows.map((r) => String(r.intervention)))), 'README']

  let view = rows.filter((r) => tab === 'All interventions' || tab === 'README' || r.intervention === tab)
  view = view.filter((r) => !q || visibleCols.some((c) => String(r[c.key]).toLowerCase().includes(q.toLowerCase())))
  view = view.filter((r) => (Object.entries(colFilters) as [string, string[]][]).every(([k, vals]) => !vals.length || vals.includes(String(r[k]))))
  if (sort) view = [...view].sort((a, b) => (a[sort.key] > b[sort.key] ? sort.dir : -sort.dir))
  const activeFilterCount = (Object.values(colFilters) as string[][]).filter((v) => v.length).length

  return (
    <AppShell role={role} portal={portal} active={sheet === 'feedback' ? 'db-feedback' : 'db-participants'} onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <ExportModal
        open={!!exporting}
        onClose={() => setExporting(null)}
        title={`${pillarLabel} · ${sheet === 'feedback' ? 'Feedback' : 'Participants'} · ${tab}`}
        columns={cols}
        rows={rows}
        filtered={view}
        filters={[label, tab !== 'All interventions' && tab, q && `Search “${q}”`, activeFilterCount && `${activeFilterCount} column filter(s)`].filter(Boolean).join(' · ')}
        defaultFormat={exporting ?? 'xlsx'}
        canSeeRestricted={showId}
      />
      <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 sm:px-5">
        <PageHeader
          crumbs={['Database', pillarLabel, sheet === 'feedback' ? 'Feedback' : 'Participants']}
          title={`${pillarLabel} ${sheet === 'feedback' ? 'feedback' : 'participants'}`}
          description={`${sheet === 'feedback' ? 'One row per feedback response.' : 'One row per person per intervention, CHII ID first.'} ${label}.`}
          actions={
            <>
              <div className="flex flex-1 gap-0.5 rounded-lg bg-surface p-0.5 shadow-[0_0_0_1px_var(--color-line)] sm:flex-none">
                {['participants', 'feedback'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => (onSheetChange?.(s), setTab('All interventions'), setColFilters({}))}
                    className={`h-8 flex-1 rounded-md px-3 text-xs font-medium capitalize transition-colors duration-150 ease-out ${sheet === s ? 'bg-brand-50 text-brand-600' : 'text-muted hover:text-ink'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Popover
                width="w-56"
                trigger={({ toggle }) => (
                  <Button variant="primary" onClick={toggle} className="flex-1 sm:flex-none">
                    <Download className="h-4 w-4" /> Download <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                )}
              >
                {(close) => (
                  <div className="p-1">
                    <MenuItem icon={FileSpreadsheet} onClick={() => (close(), setExporting('xlsx'))}>Excel workbook</MenuItem>
                    <MenuItem icon={FileType2} onClick={() => (close(), setExporting('csv'))}>CSV</MenuItem>
                    <MenuItem icon={FileText} onClick={() => (close(), setExporting('pdf'))}>PDF</MenuItem>
                    <MenuItem icon={FileText} onClick={() => (close(), setExporting('json'))}>JSON</MenuItem>
                  </div>
                )}
              </Popover>
            </>
          }
        />

        <Panel className="overflow-hidden">
          {/* Sheet tabs */}
          <div className="no-scrollbar overflow-x-auto border-b border-line bg-canvas/60">
            <ul className="flex w-max px-2">
              {sheetTabs.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => setTab(t)}
                    className={`relative h-10 whitespace-nowrap px-3 text-sm font-medium transition-colors duration-150 ease-out ${tab === t ? 'text-ink' : 'text-muted hover:text-ink'}`}
                  >
                    {t}
                    {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {tab === 'README' ? (
            <Readme sheet={sheet} showId={showId} />
          ) : (
            <>
              <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:p-4">
                <label className="relative min-w-0 flex-1 sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search every column"
                    className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-faint focus:border-brand-600 focus:ring-3 focus:ring-brand-100"
                  />
                </label>
                <div className="flex items-center gap-3 text-xs text-muted sm:ml-auto">
                  {activeFilterCount > 0 && (
                    <button type="button" onClick={() => setColFilters({})} className="inline-flex items-center gap-1 font-medium text-brand-600">
                      <X className="h-3.5 w-3.5" /> Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                    </button>
                  )}
                  <span className="tabular-nums">
                    {view.length} of {rows.length} rows
                  </span>
                  {!showId && (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Identity columns hidden
                    </span>
                  )}
                </div>
              </div>

              <div className="scrollbar-thin max-h-[560px] overflow-auto">
                <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      {visibleCols.map((c, i) => (
                        <th
                          key={c.key}
                          className={`border-b border-line bg-surface px-3 py-0 text-left text-xs font-medium text-muted ${i === 0 ? 'sticky left-0 z-10 border-r pl-4' : ''} ${c.extra ? 'bg-brand-50/60' : ''}`}
                        >
                          <ColumnMenu
                            col={c}
                            values={(Array.from(new Set(rows.map((r) => String(r[c.key])))) as string[]).sort()}
                            selected={colFilters[c.key] ?? []}
                            sortDir={sort?.key === c.key ? sort.dir : null}
                            onSort={(dir) => setSort({ key: c.key, dir })}
                            onApply={(vals) => setColFilters({ ...colFilters, [c.key]: vals })}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.map((r, ri) => (
                      <tr key={ri} className="group">
                        {visibleCols.map((c, i) => (
                          <td
                            key={c.key}
                            className={`whitespace-nowrap border-b border-line px-3 py-2 group-hover:bg-canvas ${c.numeric ? 'text-right tabular-nums' : ''} ${
                              i === 0 ? 'sticky left-0 z-10 border-r bg-surface pl-4 font-mono text-[13px] font-medium text-brand-600' : 'text-body'
                            }`}
                          >
                            {r[c.key] === '' ? <span className="text-faint">—</span> : r[c.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {view.length === 0 &&
                  (rows.length === 0 ? (
                    <EmptyState title="No rows in this period" body="Nothing was recorded for this pillar in the selected time range. Widen it from the top bar." />
                  ) : (
                    <EmptyState icon={Filter} title="No rows match these filters" body="Clear a column filter or change the search." action={{ label: 'Clear filters', onClick: () => (setColFilters({}), setQ('')) }} />
                  ))}
              </div>
            </>
          )}
        </Panel>
      </div>
    </AppShell>
  )
}

function ColumnMenu({
  col,
  values,
  selected,
  sortDir,
  onSort,
  onApply,
}: {
  col: Col
  values: string[]
  selected: string[]
  sortDir: 1 | -1 | null
  onSort: (d: 1 | -1) => void
  onApply: (v: string[]) => void
}) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>(selected.length ? selected : values)
  const shown = values.filter((v) => v.toLowerCase().includes(q.toLowerCase()))
  const active = selected.length > 0 && selected.length < values.length
  return (
    <Popover
      align="left"
      width="w-60"
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className={`flex h-10 w-full items-center gap-1.5 whitespace-nowrap ${active ? 'text-brand-600' : 'hover:text-ink'}`}>
          {col.label}
          {col.extra && <span className="rounded bg-brand-100 px-1 text-[9px] font-semibold text-brand-600">Q</span>}
          {active ? <Filter className="h-3 w-3" /> : <ChevronDown className="h-3 w-3 opacity-60" />}
          {sortDir && (sortDir === 1 ? <ArrowDownAZ className="h-3 w-3" /> : <ArrowUpAZ className="h-3 w-3" />)}
        </button>
      )}
    >
      {(close) => (
        <div className="text-sm font-normal text-body">
          <div className="border-b border-line p-1">
            <MenuItem icon={ArrowDownAZ} onClick={() => (onSort(1), close())}>Sort A → Z</MenuItem>
            <MenuItem icon={ArrowUpAZ} onClick={() => (onSort(-1), close())}>Sort Z → A</MenuItem>
          </div>
          <div className="p-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search values"
              className="h-8 w-full rounded-md border border-line-strong bg-surface px-2.5 text-sm outline-none focus:border-brand-600"
            />
            <label className="mt-2 flex h-8 items-center gap-2 border-b border-line px-1 text-xs font-medium">
              <input type="checkbox" className="accent-brand" checked={picked.length === values.length} onChange={(e) => setPicked(e.target.checked ? values : [])} />
              Select all
            </label>
            <ul className="max-h-44 overflow-y-auto py-1">
              {shown.map((v) => (
                <li key={v}>
                  <label className="flex h-8 items-center gap-2 rounded px-1 hover:bg-canvas">
                    <input type="checkbox" className="accent-brand" checked={picked.includes(v)} onChange={(e) => setPicked(e.target.checked ? [...picked, v] : picked.filter((x) => x !== v))} />
                    <span className="truncate">{v || '(blank)'}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2 border-t border-line p-2">
            <button type="button" onClick={() => (setPicked(values), onApply([]), close())} className="h-8 rounded-md px-2.5 text-xs font-medium text-muted hover:text-ink">
              Clear
            </button>
            <button type="button" onClick={() => (onApply(picked.length === values.length ? [] : picked), close())} className="h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white">
              Apply
            </button>
          </div>
        </div>
      )}
    </Popover>
  )
}

function Readme({ sheet, showId }: { sheet: string; showId: boolean }) {
  return (
    <div className="max-w-2xl space-y-4 px-5 py-6 text-sm leading-6 text-body">
      <h2 className="text-base font-semibold text-ink">About this sheet</h2>
      <p>
        {sheet === 'feedback'
          ? 'Each row is one feedback response. A person can respond once per session, and only after an attendance record exists.'
          : 'Each row is one person in one intervention. The CHII ID is the same across every pillar, so the same person can appear in several sheets.'}
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Columns marked Q are answers to questions the fixed columns don't cover.</li>
        <li>Completed means attending at least 75% of the session's dates.</li>
        <li>{showId ? 'You can see identity columns. Exports including them are logged as restricted.' : 'Identity columns are removed for your role, and files are named “de-identified”.'}</li>
        <li>Seven spec feedback columns stay empty until the templates ask those questions.</li>
      </ul>
    </div>
  )
}

function build(sheet: string, pillars: Pillar[]): { cols: Col[]; rows: Row[] } {
  if (sheet === 'feedback') {
    return {
      cols: [
        { key: 'id', label: 'CHII ID' },
        { key: 'date', label: 'Date' },
        { key: 'intervention', label: 'Intervention' },
        { key: 'session', label: 'Session' },
        { key: 'satisfaction', label: 'Satisfaction', numeric: true },
        { key: 'relevance', label: 'Relevance', numeric: true },
        { key: 'nps', label: 'NPS', numeric: true },
        { key: 'comment', label: 'Comment' },
        { key: 'facilitator', label: 'Facilitator rating', extra: true, numeric: true },
      ],
      rows: feedbackRows
        .filter((f) => pillars.includes(f.pillar))
        .map((f, i) => ({ id: f.chiiId, date: f.date, intervention: f.intervention, session: f.session, satisfaction: f.satisfaction, relevance: f.relevance, nps: f.nps, comment: f.comment, facilitator: i % 3 === 2 ? '' : 4 + (i % 2) })),
    }
  }
  const rows: Row[] = []
  participants.forEach((x, pi) =>
    x.interventions.forEach((iv, k) => {
      if (!x.pillars.some((pl) => pillars.includes(pl))) return
      rows.push({
        id: x.id,
        name: x.name,
        email: x.email,
        gender: x.gender === 'F' ? 'Female' : 'Male',
        age: x.age,
        country: x.country,
        intervention: iv,
        status: ['Completed', 'In progress', 'Registered', 'Selected'][(pi + k) % 4],
        attendance: `${[100, 83, 67, 50, 92][(pi + k) % 5]}%`,
        hear: ['Instagram', 'Friend', 'ALU email', 'Lecturer', ''][(pi + k) % 5],
        year: ['Year 1', 'Year 2', 'Year 3', 'Graduate'][(pi + k) % 4],
        date: x.lastActive,
      })
    }),
  )
  return {
    cols: [
      { key: 'id', label: 'CHII ID' },
      { key: 'name', label: 'Full name', restricted: true },
      { key: 'email', label: 'Email', restricted: true },
      { key: 'gender', label: 'Gender' },
      { key: 'age', label: 'Age', numeric: true },
      { key: 'country', label: 'Country' },
      { key: 'intervention', label: 'Intervention' },
      { key: 'status', label: 'Status' },
      { key: 'attendance', label: 'Attendance', numeric: true },
      { key: 'date', label: 'Last active' },
      { key: 'year', label: 'Year of study', extra: true },
      { key: 'hear', label: 'How did you hear?', extra: true },
    ],
    rows,
  }
}
