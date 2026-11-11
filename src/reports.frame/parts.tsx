import React from 'react'
import type { Audience, BlockKind, DateRule, ReportStatus, ReportTemplate } from '../shared/reports/types'

/* ---------- Labels ---------- */

export const STATUS: Record<ReportStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-canvas text-muted ring-1 ring-line' },
  in_review: { label: 'In review', cls: 'bg-warn-bg text-warn' },
  approved: { label: 'Approved', cls: 'bg-brand-50 text-brand dark:text-brand-600' },
  final: { label: 'Final', cls: 'bg-good-bg text-good' },
  archived: { label: 'Archived', cls: 'bg-canvas text-faint' },
}

export const AUDIENCE: Record<Audience, { label: string; short: string; body: string }> = {
  internal: { label: 'Internal', short: 'Internal', body: 'For CHII staff. Counts under 5 are hidden. Pillar leads can finalise without MELA approval.' },
  partner: { label: 'Partner / Donor', short: 'Partner', body: 'For funders and partners. Counts under 10 are hidden, and MELA must approve it before it’s shared.' },
  public: { label: 'Public', short: 'Public', body: 'For anyone. Counts under 10 are hidden, disability and humanitarian breakdowns are off, and MELA must approve it.' },
}

export const DATE_RULE: Record<DateRule, { label: string; body: string }> = {
  session: { label: 'Session date', body: 'Counts a person in the period their cohort or session started.' },
  registration: { label: 'Registration date', body: 'Counts a person in the period they registered or applied.' },
  response: { label: 'Response date', body: 'Counts feedback in the period it was submitted.' },
}

export function StatusPill({ status }: { status: ReportStatus }) {
  const s = STATUS[status]
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
}

/* ---------- Template thumbnail: a tiny A4 page drawn from the template's sections ---------- */

function MiniBlock({ kind }: { kind: BlockKind }) {
  if (kind === 'kpi') return <span className="h-3 flex-1 rounded-[2px] bg-brand/80" />
  if (kind === 'chart')
    return (
      <span className="flex h-6 flex-1 items-end gap-[2px] rounded-[2px] bg-brand-50 px-1 pb-0.5 dark:bg-white/5">
        {[60, 85, 45, 70, 95].map((h, i) => (
          <span key={i} className="flex-1 rounded-t-[1px] bg-sky" style={{ height: `${h}%` }} />
        ))}
      </span>
    )
  if (kind === 'table')
    return (
      <span className="flex h-6 flex-1 flex-col justify-between rounded-[2px] border border-line px-1 py-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-[2px] rounded ${i === 0 ? 'bg-brand/60' : 'bg-line-strong'}`} />
        ))}
      </span>
    )
  return (
    <span className="flex flex-1 flex-col gap-[3px] py-0.5">
      {[100, 92, 70].map((w, i) => (
        <span key={i} className="h-[2px] rounded bg-line-strong" style={{ width: `${w}%` }} />
      ))}
    </span>
  )
}

export function TemplateThumb({ template, landscape }: { template: Pick<ReportTemplate, 'sections' | 'layout'> | null; landscape?: boolean }) {
  const wide = landscape ?? template?.layout === 'a4_landscape'
  return (
    <div
      aria-hidden
      className={`mx-auto flex flex-col gap-1.5 overflow-hidden rounded-md border border-line bg-surface p-2.5 shadow-[0_1px_2px_rgba(16,44,94,0.08)] ${wide ? 'aspect-[1.414/1] w-full' : 'aspect-[1/1.25] w-[78%]'}`}
    >
      <span className="mb-0.5 h-1.5 w-1/2 rounded bg-brand" />
      {template ? (
        template.sections.slice(0, 5).map((s, i) => {
          // Group KPI tiles into one row; other blocks get a row each.
          const kpis = s.blocks.filter((b) => b === 'kpi')
          const rest = s.blocks.filter((b) => b !== 'kpi').slice(0, 2)
          return (
            <span key={i} className="flex flex-col gap-1">
              {kpis.length > 0 && (
                <span className="flex gap-1">
                  {kpis.map((k, j) => (
                    <MiniBlock key={j} kind={k} />
                  ))}
                </span>
              )}
              {rest.length > 0 && (
                <span className="flex gap-1">
                  {rest.map((k, j) => (
                    <MiniBlock key={j} kind={k} />
                  ))}
                </span>
              )}
            </span>
          )
        })
      ) : (
        <span className="grid flex-1 place-items-center text-[10px] font-semibold text-faint">Blank</span>
      )}
    </div>
  )
}

/* ---------- Form pieces in the app's style ---------- */

export function Field({ label, hint, children, required }: { label: string; hint?: React.ReactNode; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-semibold text-ink">
        {label}
        {required && <span className="text-bad">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100'

/** Toggle chip used for multi-selects (pillars, filters). */
export function Chip({ on, onClick, children, disabled, title }: { on: boolean; onClick?: () => void; children: React.ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-body hover:border-line-strong hover:bg-canvas'
      }`}
    >
      {children}
    </button>
  )
}

/** A selectable card with a radio-like ring (audience, date rule, comparison). */
export function ChoiceCard({ on, onClick, title, body, badge }: { on: boolean; onClick: () => void; title: string; body?: React.ReactNode; badge?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors duration-150 ease-out ${
        on ? 'border-brand bg-brand-50/60 ring-1 ring-brand dark:bg-brand-50' : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? 'border-brand' : 'border-line-strong'}`}>
        {on && <span className="h-2 w-2 rounded-full bg-brand dark:bg-brand-600" />}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          {title}
          {badge && <span className="rounded bg-brand-50 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand dark:text-brand-600">{badge}</span>}
        </span>
        {body && <span className="mt-0.5 block text-xs leading-5 text-muted">{body}</span>}
      </span>
    </button>
  )
}

/** "3 days ago" from an ISO timestamp. */
export function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
