/** Small shared pieces for the Venture Registry screens. */
import React from 'react'
import type { Stage, VentureStatus } from '../shared/ventures/types'

export { Chip, Field, inputCls } from '../reports.frame/parts'

const STAGE_CLS: Record<Stage, string> = {
  Expose: 'bg-brand-50 text-brand-600 dark:text-brand-600',
  Build: 'bg-[#e6f0fb] text-[#1f5fa8] dark:bg-brand-50 dark:text-brand-600',
  Scale: 'bg-brand text-white',
}
/** `onDark`: on the navy page header, where light pills would lose their text. */
export function StagePill({ stage, onDark }: { stage: Stage; onDark?: boolean }) {
  const cls = onDark ? 'bg-white/15 text-white ring-1 ring-white/30' : STAGE_CLS[stage]
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${cls}`}>{stage}</span>
}

const STATUS_CLS: Record<VentureStatus, string> = {
  Active: 'bg-good-bg text-good',
  Paused: 'bg-warn-bg text-warn',
  Pivoted: 'bg-brand-50 text-brand-600',
  Acquired: 'bg-[#efe9fb] text-[#5b3fa8] dark:bg-brand-50 dark:text-brand-600',
  Closed: 'bg-canvas text-muted',
}
export function VentureStatusPill({ status }: { status: VentureStatus }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${STATUS_CLS[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  )
}

/** Yes / No / Unknown for derived flags. */
export function YesNo({ value, derived }: { value: boolean | null; derived?: boolean | null }) {
  const manual = derived !== undefined && value !== derived && value != null
  if (value == null) return <span className="text-xs text-faint">Unknown</span>
  return (
    <span className={`text-sm font-medium ${value ? 'text-good' : 'text-muted'}`} title={manual ? 'Set by hand' : undefined}>
      {value ? 'Yes' : 'No'}
      {manual && <span className="ml-1 text-[10px] font-semibold uppercase text-warn">manual</span>}
    </span>
  )
}

export const money = (n: number | null | undefined) =>
  n == null ? '—' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `$${Math.round(n / 1_000)}K` : `$${Math.round(n).toLocaleString()}`

export const moneyFull = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`)

export const fmtDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function ErrorBox({ errors }: { errors: string[] }) {
  if (!errors.length) return null
  return (
    <div role="alert" className="rounded-lg border border-bad/30 bg-bad-bg px-4 py-3 text-sm text-bad">
      <p className="font-semibold">Please fix {errors.length === 1 ? 'this' : 'these'} before saving:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  )
}
