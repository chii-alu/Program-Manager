/** Small shared pieces for the Incubation screens. */
import React from 'react'
import { personById } from '../shared/ventures/people'
import { MODULE_STATUS_LABEL, type ModuleStatus } from '../shared/incubation/progress'
import { STAGE_LABEL, type IncStage } from '../shared/incubation/types'

export { Chip, Field, inputCls } from '../reports.frame/parts'

export const fmtDate = (iso?: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const fmtShort = (iso?: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—')
export const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`)
export const one = (x: number | null | undefined) => (x == null ? '—' : x.toFixed(1))
export const nameOf = (chiiId: string) => personById(chiiId)?.name ?? chiiId

const STAGE_CLS: Record<IncStage, string> = {
  expose: 'bg-brand-50 text-brand-600',
  build: 'bg-[#e6f0fb] text-[#1f5fa8] dark:bg-brand-50 dark:text-brand-600',
  scale: 'bg-brand text-white',
}
/** `onDark`: on the navy page header, where light pills would lose their text. */
export function StagePill({ stage, onDark }: { stage: IncStage; onDark?: boolean }) {
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${onDark ? 'bg-white/15 !text-white ring-1 ring-white/30' : STAGE_CLS[stage]}`}>{STAGE_LABEL[stage]}</span>
}

const PHASE_CLS = { upcoming: 'bg-canvas text-muted', running: 'bg-good-bg text-good', completed: 'bg-brand-50 text-brand-600' } as const
export function PhasePill({ phase, onDark }: { phase: keyof typeof PHASE_CLS; onDark?: boolean }) {
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${onDark ? 'bg-white/15 !text-white ring-1 ring-white/30' : PHASE_CLS[phase]}`}>{phase === 'upcoming' ? 'Upcoming' : phase === 'running' ? 'Running' : 'Finished'}</span>
}

const MOD_CLS: Record<ModuleStatus, string> = {
  completed: 'bg-good text-white',
  exempt: 'bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/40',
  in_progress: 'bg-warn-bg text-warn',
  not_done: 'bg-bad-bg text-bad',
  not_started: 'bg-canvas text-faint',
}
/** I1–I4 chip coloured by the module's status for one founder. */
export function ModuleChip({ code, status }: { code: string; status: ModuleStatus }) {
  return (
    <span title={`${code}: ${MODULE_STATUS_LABEL[status]}`} className={`inline-flex h-6 min-w-[30px] items-center justify-center rounded-md px-1.5 text-[11px] font-bold ${MOD_CLS[status]}`}>
      {status === 'exempt' ? `${code}·E` : code}
    </span>
  )
}
export function ModuleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
      {(['completed', 'in_progress', 'exempt', 'not_done', 'not_started'] as ModuleStatus[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm ${MOD_CLS[s]}`} />
          {MODULE_STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  )
}

/** A name with its CHII ID beneath. */
export function Person({ chiiId, onOpen }: { chiiId: string; onOpen?: () => void }) {
  const body = (
    <>
      <span className="block truncate text-sm font-semibold text-ink">{nameOf(chiiId)}</span>
      <span className="block font-mono text-[11px] text-muted">{chiiId}</span>
    </>
  )
  return onOpen ? (
    <button type="button" onClick={onOpen} className="min-w-0 text-left hover:[&>span:first-child]:text-brand-600 hover:[&>span:first-child]:underline">
      {body}
    </button>
  ) : (
    <span className="min-w-0">{body}</span>
  )
}

/** Tabs under a panel's top edge, with counts. */
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: [K, string, number?][]; value: K; onChange: (k: K) => void }) {
  return (
    <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3">
      {tabs.map(([k, l, n]) => (
        <button key={k} role="tab" type="button" aria-selected={value === k} onClick={() => onChange(k)} className={`relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium ${value === k ? 'text-ink' : 'text-muted hover:text-ink'}`}>
          {l}
          {n != null && <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${value === k ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-muted'}`}>{n}</span>}
          {value === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  )
}

/** A muted "to add" marker for curriculum text not yet copied in from the compendium. */
export function ToAdd({ what = 'Title' }: { what?: string }) {
  return <span className="italic text-faint">{what} to add from the compendium</span>
}

export function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-muted ${className}`}>{children}</th>
}
export function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>
}

export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  return <p className={`rounded-lg px-3 py-2 text-xs leading-5 ${tone === 'warn' ? 'bg-warn-bg text-warn' : 'bg-brand-50 text-brand-600'}`}>{children}</p>
}
