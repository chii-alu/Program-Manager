import React from 'react'

export function Bone({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} style={style} />
}

/** Mirrors the common page layout: header, a summary strip, then a table panel. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1240px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Bone className="h-3 w-28" />
          <Bone className="h-7 w-64 max-w-full" />
          <Bone className="h-3.5 w-80 max-w-full" />
        </div>
        <Bone className="h-9 w-full sm:w-36" />
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`space-y-2 px-4 py-4 ${i ? 'border-l border-line' : ''}`}>
            <Bone className="h-3 w-20" />
            <Bone className="h-6 w-16" />
          </div>
        ))}
      </div>
      <TableSkeleton />
    </div>
  )
}

/** For chart-led pages: a hero chart, then a row of two smaller panels. */
export function ChartsPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1240px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Bone className="h-3 w-28" />
        <Bone className="h-7 w-64 max-w-full" />
        <Bone className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="rounded-xl border border-line bg-surface p-5">
        <Bone className="h-3 w-24" />
        <Bone className="mt-2 h-10 w-40" />
        <ChartSkeleton className="mt-6 h-56" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5">
            <Bone className="h-3.5 w-36" />
            <div className="mt-5 space-y-3">
              {[80, 64, 52, 40].map((w) => (
                <div key={w} className="h-2.5 animate-pulse rounded-md bg-line/70" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex gap-2 border-b border-line p-4">
        <Bone className="h-9 flex-1 sm:max-w-xs" />
        <Bone className="h-9 w-24" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
          <Bone className="h-4 w-24" />
          <Bone className="h-4 flex-1" />
          <Bone className="hidden h-4 w-20 md:block" />
          <Bone className="hidden h-4 w-16 md:block" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton({ className = 'h-60' }: { className?: string }) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      {[40, 65, 50, 80, 60, 90, 70, 85, 55, 75].map((h, i) => (
        <div key={i} className="flex-1 animate-pulse rounded-t bg-line/70" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}
