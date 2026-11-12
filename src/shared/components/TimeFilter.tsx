import React, { useState } from 'react'
import { format } from 'date-fns'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { Popover } from './Popover'
import { TODAY, YEARS, bounds, presets, useTimeRange } from '../lib/time'

/** Platform-wide period picker. Every screen reads the same range. */
export function TimeFilter({ compact }: { compact?: boolean }) {
  const { range, setRange, label } = useTimeRange()
  const b = bounds(range)
  const [from, setFrom] = useState(format(b.start, 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(b.end, 'yyyy-MM-dd'))

  return (
    <Popover
      width="w-72"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Period: ${label}`}
          className={`inline-flex h-9 items-center gap-2 rounded-lg border text-sm font-medium transition-colors duration-150 ease-out ${
            open ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-line bg-surface text-body hover:bg-canvas'
          } ${compact ? 'w-9 justify-center' : 'px-3'}`}
        >
          <CalendarDays className="h-4 w-4 shrink-0" />
          {!compact && (
            <>
              <span className="max-w-[160px] truncate">{label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            </>
          )}
        </button>
      )}
    >
      {(close) => <RangePanel onDone={close} from={from} to={to} setFrom={setFrom} setTo={setTo} preset={range.preset} year={range.year} setRange={setRange} />}
    </Popover>
  )
}

export function RangePanel({
  onDone,
  from,
  to,
  setFrom,
  setTo,
  preset,
  year,
  setRange,
}: {
  onDone?: () => void
  from: string
  to: string
  setFrom: (v: string) => void
  setTo: (v: string) => void
  preset: string
  year?: number
  setRange: ReturnType<typeof useTimeRange>['setRange']
}) {
  return (
    <div>
      <div className="px-3 pb-1 pt-3 text-[11px] font-medium text-faint">Period for the whole platform</div>
      <ul className="p-1">
        {presets.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => {
                setRange({ preset: p.id })
                onDone?.()
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-canvas"
            >
              <span className="w-8 text-xs font-semibold text-muted">{p.short}</span>
              <span className="flex-1">{p.label}</span>
              {preset === p.id && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-3 py-2.5">
        <div className="mb-2 text-xs font-medium text-muted">Calendar year</div>
        <div className="flex flex-wrap gap-1.5">
          {YEARS.map((y) => {
            const on = preset === 'year' && (year ?? TODAY.getFullYear()) === y
            return (
              <button
                key={y}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setRange({ preset: 'year', year: y })
                  onDone?.()
                }}
                className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold tabular-nums transition-colors ${on ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-body hover:bg-canvas'}`}
              >
                {y}
                {y === TODAY.getFullYear() && <span className={on ? 'text-white/75' : 'font-normal text-faint'}>to date</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div className="border-t border-line p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
          Custom range {preset === 'custom' && <Check className="h-3.5 w-3.5 text-brand-600" />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 min-w-0 rounded-md border border-line-strong bg-surface px-2 text-xs outline-none focus:border-brand-600" />
          <input type="date" value={to} min={from} max={format(TODAY, 'yyyy-MM-dd')} onChange={(e) => setTo(e.target.value)} className="h-9 min-w-0 rounded-md border border-line-strong bg-surface px-2 text-xs outline-none focus:border-brand-600" />
        </div>
        <button
          type="button"
          onClick={() => {
            setRange({ preset: 'custom', from, to })
            onDone?.()
          }}
          className="mt-2 h-9 w-full rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Apply range
        </button>
      </div>
    </div>
  )
}
