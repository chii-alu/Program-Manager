/**
 * The page's Filters button (in the page header), replacing the old top-bar date picker. Its
 * first section is the Period (the same platform-wide range every page reads: last 7/30/90 days,
 * 12 months, all time, a calendar year or custom dates); pages can add their own sections below,
 * e.g. pillar or gender. Same look as Venture Analytics' Filters.
 */
import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, Filter } from 'lucide-react'
import { Popover } from './Popover'
import { TopBar } from './TopBarSlot'
import { TODAY, YEARS, bounds, presets, useTimeRange } from '../lib/time'

export type FilterGroup = {
  key: string
  label: string
  options: { value: string; label?: string }[]
  selected: string[]
  onToggle: (value: string) => void
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors ${on ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-body hover:bg-canvas'}`}
    >
      {children}
    </button>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {title}
        {!!count && <span className="rounded-full bg-brand-50 px-1.5 text-[10px] text-brand-600">{count}</span>}
      </h3>
      {children}
    </section>
  )
}

/** Renders in the top bar beside Create (wherever the page places it). */
export function PageFilters(props: { groups?: FilterGroup[]; onClear?: () => void }) {
  return (
    <TopBar>
      <FiltersMenu {...props} />
    </TopBar>
  )
}

function FiltersMenu({ groups = [], onClear }: { groups?: FilterGroup[]; onClear?: () => void }) {
  const { range, setRange, label } = useTimeRange()
  const b = bounds(range)
  const [from, setFrom] = useState(format(b.start, 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(b.end, 'yyyy-MM-dd'))
  useEffect(() => {
    const x = bounds(range)
    setFrom(format(x.start, 'yyyy-MM-dd'))
    setTo(format(x.end, 'yyyy-MM-dd'))
  }, [range.preset, range.from, range.to, range.year])

  const setCount = groups.reduce((n, g) => n + g.selected.length, 0)
  const thisYear = TODAY.getFullYear()
  const wide = groups.length > 0

  return (
    <Popover
      align="right"
      width={wide ? 'w-[min(94vw,640px)]' : 'w-[min(94vw,360px)]'}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Filters: ${label}`}
          className={`inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm font-medium transition-colors sm:px-3 ${open || setCount ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line bg-surface text-body hover:bg-canvas'}`}
        >
          <Filter className="h-4 w-4" /> <span className="hidden sm:inline">Filters</span>
          <span className="hidden max-w-[150px] truncate text-xs font-normal text-muted md:inline">· {label}</span>
          {setCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{setCount}</span>}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className={`grid max-h-[64vh] gap-x-6 overflow-y-auto p-4 ${wide ? 'sm:grid-cols-2' : ''}`}>
            <div className="space-y-4">
              <Section title="Period">
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <Chip key={p.id} on={range.preset === p.id} onClick={() => setRange({ preset: p.id })}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </Section>
              <Section title="Calendar year">
                <div className="flex flex-wrap gap-1.5">
                  {YEARS.map((y) => (
                    <Chip key={y} on={range.preset === 'year' && (range.year ?? thisYear) === y} onClick={() => setRange({ preset: 'year', year: y })}>
                      {y}
                      {y === thisYear && <span className="font-normal opacity-75">to date</span>}
                    </Chip>
                  ))}
                </div>
              </Section>
              <Section title="Custom dates">
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 min-w-0 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink outline-none focus:border-brand-600" />
                  <input type="date" aria-label="To" value={to} min={from} max={format(TODAY, 'yyyy-MM-dd')} onChange={(e) => setTo(e.target.value)} className="h-9 min-w-0 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink outline-none focus:border-brand-600" />
                </div>
                <button
                  type="button"
                  onClick={() => setRange({ preset: 'custom', from, to })}
                  className={`mt-2 h-8 w-full rounded-lg border text-xs font-semibold ${range.preset === 'custom' ? 'border-brand bg-brand text-white' : 'border-line-strong text-body hover:bg-canvas'}`}
                >
                  {range.preset === 'custom' ? 'Custom dates applied' : 'Apply these dates'}
                </button>
              </Section>
            </div>
            {wide && (
              <div className="mt-4 space-y-4 border-t border-line pt-4 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                {groups.map((g) => (
                  <Section key={g.key} title={g.label} count={g.selected.length}>
                    <div className="flex flex-wrap gap-1.5">
                      {g.options.map((o) => (
                        <Chip key={o.value} on={g.selected.includes(o.value)} onClick={() => g.onToggle(o.value)}>
                          {o.label ?? o.value}
                        </Chip>
                      ))}
                    </div>
                  </Section>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
            <button
              type="button"
              onClick={() => (setRange({ preset: '90d' }), onClear?.())}
              className="text-xs font-semibold text-muted hover:text-ink"
            >
              Reset
            </button>
            <span className="ml-auto mr-2 truncate text-xs text-muted">{label}</span>
            <button type="button" onClick={close} className="h-8 rounded-lg bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-hover">
              Done
            </button>
          </div>
        </div>
      )}
    </Popover>
  )
}
