import React, { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ArrowUpAZ,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  EyeOff,
  Filter,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Popover, MenuItem } from './Popover'
import { Modal } from './Modal'
import { EmptyState } from './EmptyState'
import { ExportModal } from './ExportModal'
import { ExportFormat } from '../lib/exporter'
import { PanelHeader } from './ui'

type Icon = React.ComponentType<{ className?: string }>

export type Column<T> = {
  key: string
  label: string
  value?: (r: T) => string | number
  render?: (r: T) => React.ReactNode
  numeric?: boolean
  filterable?: boolean
  restricted?: boolean
  hideBelow?: 'lg' | 'xl'
  className?: string
  /** In the downloaded file only, never on screen. */
  exportOnly?: boolean
}

export type RowAction<T> = { label: string; icon: Icon; onClick: (r: T) => void; tone?: 'bad' }

type ColFilter = { values?: string[]; min?: number; max?: number }
const entries = (o: Record<string, ColFilter>) => Object.entries(o) as [string, ColFilter][]

export function DataTable<T>({
  title,
  rows,
  columns,
  rowKey,
  onRowClick,
  rowActions,
  mobileRow,
  canSeeRestricted = true,
  searchPlaceholder = 'Search',
  initialPageSize = 10,
  toolbar,
  above,
  empty,
  exportable = true,
  stickyFirst,
  initialSort,
  emptyIcon,
  onRowHover,
  highlight,
  compact,
  heading,
  description,
  headerRight,
}: {
  title: string
  rows: T[]
  columns: Column<T>[]
  rowKey: (r: T) => string
  onRowClick?: (r: T) => void
  rowActions?: RowAction<T>[]
  mobileRow?: (r: T) => React.ReactNode
  canSeeRestricted?: boolean
  searchPlaceholder?: string
  initialPageSize?: number
  toolbar?: React.ReactNode
  above?: React.ReactNode
  empty?: { title: string; body?: string }
  exportable?: boolean
  stickyFirst?: boolean
  initialSort?: { key: string; dir: 1 | -1 }
  emptyIcon?: Icon
  onRowHover?: (r: T | null) => void
  /** Key of a row to tint, e.g. one hovered in a linked chart. */
  highlight?: string | null
  compact?: boolean
  /** Executive navy card header above the toolbar. */
  heading?: string
  description?: React.ReactNode
  headerRight?: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ?? null)
  const [filters, setFilters] = useState<Record<string, ColFilter>>({})
  const [hidden, setHidden] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(initialPageSize)
  const [exportFmt, setExportFmt] = useState<ExportFormat | null>(null)
  const [sheet, setSheet] = useState(false)

  const allowed = columns.filter((c) => (canSeeRestricted || !c.restricted) && !c.exportOnly)
  const cols = allowed.filter((c) => !hidden.includes(c.key))
  const val = (c: Column<T>, r: T) => (c.value ? c.value(r) : ((r as Record<string, unknown>)[c.key] as string | number) ?? '')

  const view = useMemo(() => {
    const t = q.trim().toLowerCase()
    const searchable = columns.filter((c) => canSeeRestricted || !c.restricted)
    let out = rows.filter((r) => !t || searchable.some((c) => String(val(c, r)).toLowerCase().includes(t)))
    out = out.filter((r) =>
      entries(filters).every(([k, f]) => {
        const c = columns.find((x) => x.key === k)
        if (!c) return true
        const v = val(c, r)
        if (f.values?.length && !f.values.includes(String(v))) return false
        const n = typeof v === 'number' ? v : parseFloat(String(v))
        if (f.min != null && !(n >= f.min)) return false
        if (f.max != null && !(n <= f.max)) return false
        return true
      }),
    )
    if (sort) {
      const c = columns.find((x) => x.key === sort.key)
      if (c)
        out = [...out].sort((a, b) => {
          const x = val(c, a)
          const y = val(c, b)
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir
        })
    }
    return out
  }, [rows, q, filters, sort, canSeeRestricted])

  const pages = Math.max(1, Math.ceil(view.length / size))
  const current = Math.min(page, pages - 1)
  const slice = view.slice(current * size, current * size + size)
  const active = entries(filters).filter(([, f]) => f.values?.length || f.min != null || f.max != null)
  const clearAll = () => {
    setFilters({})
    setQ('')
    setPage(0)
  }
  const setFilter = (k: string, f: ColFilter | null) => {
    setPage(0)
    setFilters((prev) => {
      const next = { ...prev }
      if (!f) delete next[k]
      else next[k] = f
      return next
    })
  }
  const describe = () =>
    [q && `Search “${q}”`, ...active.map(([k, f]) => `${columns.find((c) => c.key === k)?.label}: ${f.values?.length ? f.values.join(', ') : `${f.min ?? '…'}–${f.max ?? '…'}`}`)].filter(Boolean).join(' · ')
  const toRow = (r: T) => Object.fromEntries(columns.map((c) => [c.key, val(c, r)]))
  const hide = (c: Column<T>) => (c.hideBelow === 'xl' ? 'hidden xl:table-cell' : c.hideBelow === 'lg' ? 'hidden lg:table-cell' : '')

  return (
    <section className="min-w-0 rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface">
      {exportable && (
        <ExportModal
          open={!!exportFmt}
          onClose={() => setExportFmt(null)}
          title={title}
          columns={columns.map((c) => ({ key: c.key, label: c.label, restricted: c.restricted }))}
          rows={rows.map(toRow)}
          filtered={view.map(toRow)}
          canSeeRestricted={canSeeRestricted}
          filters={describe()}
          defaultFormat={exportFmt ?? 'xlsx'}
        />
      )}
      {heading && <PanelHeader title={heading} sub={description} right={headerRight} />}
      {above}

      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-line px-3 py-2.5 sm:px-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 gap-2 lg:flex-1">
          <label className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-8 text-[13px] outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-faint hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {active.length > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{active.length}</span>}
          </button>
          {exportable && (
            <button type="button" onClick={() => setExportFmt('xlsx')} aria-label="Export" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface md:hidden">
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {toolbar}
          <Popover
            width="w-56"
            trigger={({ toggle }) => (
              <button type="button" onClick={toggle} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[13px] font-semibold text-body hover:bg-canvas">
                <Columns3 className="h-4 w-4" /> Columns
                {hidden.length > 0 && <span className="text-xs text-muted">−{hidden.length}</span>}
              </button>
            )}
          >
            {() => (
              <div className="max-h-72 overflow-y-auto p-1.5">
                {allowed.map((c, i) => (
                  <label key={c.key} className={`flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-canvas ${i === 0 ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      disabled={i === 0}
                      checked={!hidden.includes(c.key)}
                      onChange={(e) => setHidden(e.target.checked ? hidden.filter((h) => h !== c.key) : [...hidden, c.key])}
                      className="accent-brand"
                    />
                    <span className="truncate">{c.label}</span>
                  </label>
                ))}
              </div>
            )}
          </Popover>
          {exportable && (
            <Popover
              width="w-48"
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[13px] font-semibold text-body hover:bg-canvas">
                  <Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5 text-muted" />
                </button>
              )}
            >
              {(close) => (
                <div className="p-1">
                  {(['xlsx', 'csv', 'pdf', 'json'] as ExportFormat[]).map((f) => (
                    <MenuItem key={f} onClick={() => (close(), setExportFmt(f))} hint={`.${f}`}>
                      {{ xlsx: 'Excel', csv: 'CSV', pdf: 'PDF', json: 'JSON' }[f]}
                    </MenuItem>
                  ))}
                </div>
              )}
            </Popover>
          )}
        </div>
      </div>

      {/* Active filters */}
      {(active.length > 0 || q) && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-canvas/40 px-3 py-2 sm:px-4">
          {q && <Chip label={`“${q}”`} onRemove={() => setQ('')} />}
          {active.map(([k, f]) => (
            <Chip
              key={k}
              label={`${columns.find((c) => c.key === k)?.label}: ${f.values?.length ? (f.values.length > 2 ? `${f.values.length} values` : f.values.join(', ')) : `${f.min ?? '…'}–${f.max ?? '…'}`}`}
              onRemove={() => setFilter(k, null)}
            />
          ))}
          <button type="button" onClick={clearAll} className="ml-1 text-xs font-semibold text-brand-600 hover:underline">
            Clear all
          </button>
        </div>
      )}

      {view.length === 0 ? (
        <EmptyState
          icon={q || active.length ? Filter : emptyIcon}
          title={q || active.length ? 'No rows match these filters' : empty?.title ?? 'Nothing here yet'}
          body={q || active.length ? 'Remove a filter or try a different search.' : empty?.body}
          action={q || active.length ? { label: 'Clear filters', onClick: clearAll } : undefined}
        />
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className={`scrollbar-thin overflow-x-auto ${mobileRow ? 'hidden md:block' : ''}`}>
            <table className="w-full border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr>
                  {cols.map((c, i) => (
                    <th
                      key={c.key}
                      className={`whitespace-nowrap border-b-2 border-brand-200 bg-brand-50 px-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-brand dark:text-brand-600 first:pl-4 sm:first:pl-5 ${c.numeric ? 'text-right' : ''} ${hide(c)} ${
                        stickyFirst && i === 0 ? 'sticky left-0 z-10 bg-brand-50' : ''
                      }`}
                    >
                      <HeaderMenu
                        col={c}
                        align={i > cols.length / 2 ? 'right' : 'left'}
                        values={Array.from(new Set(rows.map((r) => String(val(c, r))))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) as string[]}
                        filter={filters[c.key]}
                        sortDir={sort?.key === c.key ? sort.dir : null}
                        onSort={(dir) => setSort(dir ? { key: c.key, dir } : null)}
                        onFilter={(f) => setFilter(c.key, f)}
                        onHide={i === 0 ? undefined : () => setHidden([...hidden, c.key])}
                      />
                    </th>
                  ))}
                  {rowActions && <th className="w-px border-b-2 border-brand-200 bg-brand-50 pr-4" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody key={current}>
                {slice.map((r, ri) => (
                  <motion.tr
                    key={rowKey(r)}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(ri, 8) * 0.03, ease: [0.23, 1, 0.32, 1] }}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    onMouseEnter={onRowHover ? () => onRowHover(r) : undefined}
                    onMouseLeave={onRowHover ? () => onRowHover(null) : undefined}
                    data-hl={highlight === rowKey(r) ? '' : undefined}
                    className={`group ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {cols.map((c, i) => (
                      <td
                        key={c.key}
                        className={`border-b border-line px-3 ${compact ? 'py-2' : 'py-2.5'} align-middle leading-5 text-body transition-colors duration-150 ease-out first:pl-4 first:font-medium first:text-ink group-last:border-0 group-even:bg-canvas/70 group-hover:bg-brand-50/60 group-data-[hl]:bg-brand-50 sm:first:pl-5 ${
                          c.numeric ? 'text-right tabular-nums' : ''
                        } ${hide(c)} ${stickyFirst && i === 0 ? 'sticky left-0 z-10 bg-surface' : ''} ${c.className ?? ''}`}
                      >
                        {c.render ? c.render(r) : String(val(c, r)) || <span className="text-faint">—</span>}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="border-b border-line py-1.5 pl-2 pr-3 text-right group-last:border-0 group-even:bg-canvas/70 group-hover:bg-brand-50/60 group-data-[hl]:bg-brand-50 sm:pr-4">
                        <RowActions row={r} actions={rowActions} />
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          {mobileRow && (
            <ul className="divide-y divide-line md:hidden">
              {slice.map((r) => (
                <li key={rowKey(r)} className="flex items-center gap-1">
                  <div
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className="min-w-0 flex-1 px-4 py-3 active:bg-canvas"
                  >
                    {mobileRow(r)}
                  </div>
                  {rowActions && (
                    <div className="pr-2">
                      <RowActions row={r} actions={rowActions} kebabOnly />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Footer */}
      {view.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas/60 px-3 py-2 text-xs text-muted sm:px-4">
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              {current * size + 1}–{Math.min(view.length, current * size + size)} of {view.length.toLocaleString()}
              {view.length !== rows.length && <span className="text-faint"> (filtered from {rows.length.toLocaleString()})</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value))
                setPage(0)
              }}
              aria-label="Rows per page"
              className="hidden h-7 rounded-md border border-line bg-surface px-2 text-[11px] font-medium outline-none sm:block"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} className="grid h-7 w-7 place-items-center rounded-md border border-line bg-surface text-ink hover:bg-canvas disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              {current + 1} / {pages}
            </span>
            <button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid h-7 w-7 place-items-center rounded-md border border-line bg-surface text-ink hover:bg-canvas disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Phone filter sheet */}
      <Modal
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter & sort"
        description={`${view.length} of ${rows.length} rows`}
        icon={<SlidersHorizontal className="h-4 w-4" />}
        footer={
          <>
            <button type="button" onClick={clearAll} className="h-10 rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold">
              Clear all
            </button>
            <button type="button" onClick={() => setSheet(false)} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white">
              Show {view.length} rows
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-[13px] font-medium text-body">Sort by</div>
            <div className="flex gap-2">
              <select
                value={sort?.key ?? ''}
                onChange={(e) => setSort(e.target.value ? { key: e.target.value, dir: sort?.dir ?? 1 } : null)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm"
              >
                <option value="">Default order</option>
                {allowed.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Toggle direction"
                onClick={() => sort && setSort({ ...sort, dir: sort.dir === 1 ? -1 : 1 })}
                className="grid h-10 w-10 place-items-center rounded-lg border border-line-strong"
              >
                {sort?.dir === -1 ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {allowed
            .filter((c) => c.filterable !== false && !c.numeric)
            .map((c) => {
              const values = Array.from(new Set(rows.map((r) => String(val(c, r))))).filter(Boolean) as string[]
              if (values.length > 14 || values.length < 2) return null
              const sel = filters[c.key]?.values ?? []
              return (
                <div key={c.key}>
                  <div className="mb-2 text-[13px] font-medium text-body">{c.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((v) => {
                      const on = sel.includes(v)
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setFilter(c.key, { values: on ? sel.filter((x) => x !== v) : [...sel, v] })}
                          className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors duration-150 ease-out ${on ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line-strong text-body'}`}
                        >
                          {v}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      </Modal>
    </section>
  )
}

const Chip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => {
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-brand-200 bg-brand-50 pl-2.5 pr-1 text-xs font-medium text-brand-600">
      <span className="truncate">{label}</span>
      <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="grid h-5 w-5 place-items-center rounded-full hover:bg-brand-100">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function RowActions<T>({ row, actions, kebabOnly }: { row: T; actions: RowAction<T>[]; kebabOnly?: boolean }) {
  const inline = kebabOnly ? [] : actions.slice(0, 2)
  const rest = kebabOnly ? actions : actions.slice(2)
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      {inline.map((a) => (
        <button
          key={a.label}
          type="button"
          title={a.label}
          aria-label={a.label}
          onClick={() => a.onClick(row)}
          className={`grid h-8 w-8 place-items-center rounded-md opacity-0 transition-[opacity,background-color,color] duration-150 ease-out focus-visible:opacity-100 group-hover:opacity-100 hover:bg-surface ${a.tone === 'bad' ? 'text-bad' : 'text-muted hover:text-ink'}`}
        >
          <a.icon className="h-4 w-4" />
        </button>
      ))}
      {rest.length > 0 && (
        <Popover
          width="w-48"
          trigger={({ toggle }) => (
            <button type="button" onClick={toggle} aria-label="More actions" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        >
          {(close) => (
            <div className="p-1">
              {rest.map((a) => (
                <MenuItem key={a.label} icon={a.icon} tone={a.tone} onClick={() => (close(), a.onClick(row))}>
                  {a.label}
                </MenuItem>
              ))}
            </div>
          )}
        </Popover>
      )}
    </div>
  )
}

function HeaderMenu<T>({
  col,
  align,
  values,
  filter,
  sortDir,
  onSort,
  onFilter,
  onHide,
}: {
  col: Column<T>
  align: 'left' | 'right'
  values: string[]
  filter?: ColFilter
  sortDir: 1 | -1 | null
  onSort: (d: 1 | -1 | null) => void
  onFilter: (f: ColFilter | null) => void
  onHide?: () => void
}) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>(filter?.values ?? [])
  const [min, setMin] = useState(filter?.min?.toString() ?? '')
  const [max, setMax] = useState(filter?.max?.toString() ?? '')
  const activeF = !!(filter?.values?.length || filter?.min != null || filter?.max != null)
  const shown = values.filter((v) => v.toLowerCase().includes(q.toLowerCase())).slice(0, 80)
  const canFilter = col.filterable !== false

  return (
    <Popover
      align={align}
      width="w-64"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={() => {
            if (!open) {
              setPicked(filter?.values ?? [])
              setMin(filter?.min?.toString() ?? '')
              setMax(filter?.max?.toString() ?? '')
            }
            toggle()
          }}
          className={`inline-flex h-10 items-center gap-1 whitespace-nowrap ${col.numeric ? 'flex-row-reverse' : ''} ${activeF || sortDir ? 'text-brand-600' : 'hover:text-ink'}`}
        >
          {col.label}
          {sortDir === 1 && <ArrowUp className="h-3 w-3" />}
          {sortDir === -1 && <ArrowDown className="h-3 w-3" />}
          {activeF ? <Filter className="h-3 w-3" /> : <ChevronDown className="h-3 w-3 opacity-40" />}
        </button>
      )}
    >
      {(close) => (
        <div className="text-left text-sm font-normal text-body">
          <div className="border-b border-line p-1">
            <MenuItem icon={col.numeric ? ArrowUp : ArrowDownAZ} onClick={() => (onSort(1), close())}>
              {col.numeric ? 'Smallest first' : 'Sort A → Z'}
            </MenuItem>
            <MenuItem icon={col.numeric ? ArrowDown : ArrowUpAZ} onClick={() => (onSort(-1), close())}>
              {col.numeric ? 'Largest first' : 'Sort Z → A'}
            </MenuItem>
            {sortDir && <MenuItem onClick={() => (onSort(null), close())}>Clear sort</MenuItem>}
            {onHide && (
              <MenuItem icon={EyeOff} onClick={() => (onHide(), close())}>
                Hide column
              </MenuItem>
            )}
          </div>
          {canFilter &&
            (col.numeric ? (
              <div className="p-3">
                <div className="mb-2 text-xs font-medium text-muted">Between</div>
                <div className="flex items-center gap-2">
                  <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="Min" className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-brand-600" />
                  <span className="text-faint">–</span>
                  <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="Max" className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-sm outline-none focus:border-brand-600" />
                </div>
              </div>
            ) : (
              <div className="p-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search values" className="h-8 w-full rounded-md border border-line-strong bg-surface px-2.5 text-sm outline-none focus:border-brand-600" />
                <label className="mt-2 flex h-8 items-center gap-2 border-b border-line px-1 text-xs font-medium">
                  <input type="checkbox" className="accent-brand" checked={picked.length === 0 || picked.length === values.length} onChange={() => setPicked([])} />
                  All values
                </label>
                <ul className="max-h-48 overflow-y-auto py-1">
                  {shown.map((v) => (
                    <li key={v}>
                      <label className="flex h-8 items-center gap-2 rounded px-1 hover:bg-canvas">
                        <input
                          type="checkbox"
                          className="accent-brand"
                          checked={picked.includes(v)}
                          onChange={(e) => setPicked(e.target.checked ? [...picked, v] : picked.filter((x) => x !== v))}
                        />
                        <span className="truncate">{v || '(blank)'}</span>
                      </label>
                    </li>
                  ))}
                  {shown.length === 0 && <li className="px-1 py-2 text-xs text-muted">No values match</li>}
                </ul>
              </div>
            ))}
          {canFilter && (
            <div className="flex justify-end gap-2 border-t border-line p-2">
              <button type="button" onClick={() => (onFilter(null), close())} className="h-8 rounded-md px-2.5 text-xs font-medium text-muted hover:text-ink">
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  if (col.numeric) onFilter(min || max ? { min: min ? Number(min) : undefined, max: max ? Number(max) : undefined } : null)
                  else onFilter(picked.length && picked.length < values.length ? { values: picked } : null)
                  close()
                }}
                className="h-8 rounded-md bg-brand px-3 text-xs font-semibold text-white"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </Popover>
  )
}
