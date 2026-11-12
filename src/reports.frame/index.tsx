import React, { useEffect, useMemo, useState } from 'react'
import { Archive, Copy, Download, FileBarChart2, FilePlus2, MoreHorizontal, Pencil, RotateCcw, Search, ShieldOff, X } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, PillarTag } from '../shared/components/ui'
import { EmptyState } from '../shared/components/EmptyState'
import { MenuItem, Popover } from '../shared/components/Popover'
import { Portal, Role, pillarsFor, portalMeta, staff } from '../shared/data/mela'
import { userFor } from '../shared/lib/auth'
import { toast } from '../shared/lib/notify'
import { pillarsNarrowed, viewerFor } from '../shared/reports/metrics'
import { fmtRange } from '../shared/reports/periods'
import { archiveReport, canCreateReports, latestVersion, canEditReport, canViewReport, duplicateForNewPeriod, getReport, resetReports, useReports } from '../shared/reports/store'
import { SYSTEM_TEMPLATES, templateById } from '../shared/reports/templates'
import type { Report, ReportStatus, Viewer } from '../shared/reports/types'
import { downloadReportPdf, isPhone } from '../shared/reports/export/pdf'
import { AUDIENCE, STATUS, StatusPill, TemplateThumb, ago, inputCls } from './parts'
import { Wizard, blankDraft } from './Wizard'

export const args = {
  role: 'admin',
  portal: 'admin',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

type View = { kind: 'library' } | { kind: 'wizard'; report: Report | null } | { kind: 'denied' }

/** Reads ?report=<id> so a report can be opened by link (and refused by link). */
const linkedReport = () => {
  try {
    return new URLSearchParams(window.location.search).get('report')
  } catch {
    return null
  }
}

export default function Reports(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const portalPillars = pillarsFor(portal)
  const viewer = useMemo(() => viewerFor(role, portalPillars), [role, portal])
  const me = { email: userFor(role, portal).email, name: userFor(role, portal).user }
  const all = useReports()

  const [view, setView] = useState<View>(() => {
    const id = linkedReport()
    if (!id) return { kind: 'library' }
    const rep = getReport(id)
    return rep && canViewReport(viewer, me.email, rep) ? { kind: 'wizard', report: rep } : { kind: 'denied' }
  })

  // Keep the address bar in step with the open report, so it can be shared (with the same access rules).
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (view.kind === 'wizard' && view.report) url.searchParams.set('report', view.report.id)
      else if (view.kind === 'library') url.searchParams.delete('report')
      window.history.replaceState(null, '', url)
    } catch {
      /* no history API (e.g. sandboxed preview) */
    }
  }, [view])

  const shell = (children: React.ReactNode) => (
    <AppShell role={role} portal={portal} active="reports" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">{children}</div>
    </AppShell>
  )

  if (view.kind === 'denied')
    return shell(
      <div className="grid min-h-[50vh] place-items-center">
        <EmptyState
          icon={ShieldOff}
          title="You don’t have access to this report"
          body="It covers pillars outside your role, or it hasn’t been shared with you. Ask the report’s author or the MELA team."
          action={{ label: 'Go to your reports', onClick: () => setView({ kind: 'library' }) }}
        />
      </div>,
    )

  if (view.kind === 'wizard') {
    const rep = view.report
    const readOnly = !!rep && !canEditReport(viewer, me.email, rep)
    return shell(
      <>
        <PageHeader
          crumbs={[portalMeta[portal].label, 'Tools', 'Reports', rep ? (readOnly ? 'View' : 'Edit') : 'New report']}
          title={rep ? rep.title : 'New Report'}
          description={rep ? `${templateById(rep.templateId)?.name ?? 'Blank report'} · ${rep.period.label} · last saved ${ago(rep.updatedAt)}` : 'Build a report from a template in six steps. Your draft is saved as you go.'}
        />
        <Wizard
          key={rep?.id ?? 'new'}
          viewer={viewer}
          me={me}
          readOnly={readOnly}
          initial={rep ?? blankDraft(viewer, me, portalPillars)}
          onNavigate={onNavigate}
          onClose={(saved) => {
            if (saved) toast({ title: 'Draft saved', body: saved.title, tone: 'good' })
            setView({ kind: 'library' })
          }}
        />
      </>,
    )
  }

  return shell(
    <Library
      reports={all}
      viewer={viewer}
      me={me}
      portal={portal}
      onNew={() => setView({ kind: 'wizard', report: null })}
      onOpen={(rep) => setView({ kind: 'wizard', report: rep })}
    />,
  )
}

/* ---------- Library (spec §9) ---------- */

type Filters = { q: string; pillar: string; template: string; status: string; author: string; period: string }
const NO_FILTERS: Filters = { q: '', pillar: '', template: '', status: '', author: '', period: '' }

function Library({
  reports,
  viewer,
  me,
  portal,
  onNew,
  onOpen,
}: {
  reports: Report[]
  viewer: ReturnType<typeof viewerFor>
  me: { email: string; name: string }
  portal: Portal
  onNew: () => void
  onOpen: (r: Report) => void
}) {
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const set = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }))
  const portalPillars = pillarsFor(portal)

  // What this person may see, then (in a pillar portal) what touches that pillar.
  const visible = reports.filter((r) => canViewReport(viewer, me.email, r) && (portal === 'admin' || r.scope.pillars.some((p) => portalPillars.includes(p))))
  const authorName = (email: string) => staff.find((s) => s.email === email)?.name ?? email
  const authors = [...new Set(visible.map((r) => r.ownerId))]
  const periods = [...new Set(visible.map((r) => r.period.label))]

  const shown = visible
    .filter((r) => (f.status ? r.status === f.status : r.status !== 'archived'))
    .filter((r) => !f.pillar || r.scope.pillars.includes(f.pillar as never))
    .filter((r) => !f.template || (f.template === 'blank' ? r.templateId === null : r.templateId === f.template))
    .filter((r) => !f.author || r.ownerId === f.author)
    .filter((r) => !f.period || r.period.label === f.period)
    .filter((r) => {
      if (!f.q.trim()) return true
      const q = f.q.toLowerCase()
      return [r.title, r.subtitle, r.period.label, authorName(r.ownerId), templateById(r.templateId)?.name ?? '', ...r.scope.interventions].some((s) => s.toLowerCase().includes(q))
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const active = Object.entries(f).filter(([k, v]) => k !== 'q' && v).length + (f.q ? 1 : 0)
  const create = canCreateReports(viewer)
  const counts = (Object.keys(STATUS) as ReportStatus[]).filter((s) => s !== 'archived').map((s) => [s, visible.filter((r) => r.status === s).length] as const)

  return (
    <>
      <PageHeader
        crumbs={[portalMeta[portal].label, 'Tools', 'Reports']}
        title="Reports"
        description={
          viewer.role === 'reviewer'
            ? 'Reports shared with you for review.'
            : `Build reports on ${viewer.pillars.length === 3 ? 'any pillar' : viewer.pillars.join(' and ')} from templates and live platform data.`
        }
        actions={
          create && (
            <Button variant="primary" onClick={onNew}>
              <FilePlus2 className="h-4 w-4" /> New report
            </Button>
          )
        }
      />

      {/* Status summary */}
      <div className="flex flex-wrap gap-2">
        {counts.map(([s, n]) => (
          <button
            key={s}
            type="button"
            onClick={() => set({ status: f.status === s ? '' : s })}
            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${f.status === s ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-body hover:bg-canvas'}`}
          >
            {STATUS[s].label}
            <span className={`tabular-nums ${f.status === s ? 'text-white/80' : 'text-muted'}`}>{n}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <section className="rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface p-3 shadow-[var(--shadow-soft)] sm:p-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input className={`${inputCls} h-9 pl-9`} placeholder="Search title, intervention or author" value={f.q} onChange={(e) => set({ q: e.target.value })} />
          </label>
          <Select value={f.pillar} onChange={(v) => set({ pillar: v })} placeholder="All pillars" options={viewer.pillars.map((p) => [p, p])} />
          <Select value={f.template} onChange={(v) => set({ template: v })} placeholder="All templates" options={[...SYSTEM_TEMPLATES.map((t) => [t.id, t.name] as [string, string]), ['blank', 'Blank']]} />
          <Select value={f.status} onChange={(v) => set({ status: v })} placeholder="Any status" options={(Object.keys(STATUS) as ReportStatus[]).map((s) => [s, STATUS[s].label])} />
          <Select value={f.period} onChange={(v) => set({ period: v })} placeholder="Any period" options={periods.map((p) => [p, p])} />
          <Select value={f.author} onChange={(v) => set({ author: v })} placeholder="Any author" options={authors.map((a) => [a, authorName(a)])} />
        </div>
        {active > 0 && (
          <div className="mt-2.5 flex items-center justify-between text-xs text-muted">
            <span>
              {shown.length} of {visible.filter((r) => r.status !== 'archived').length} reports
            </span>
            <button type="button" onClick={() => setF(NO_FILTERS)} className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
              <X className="h-3 w-3" /> Clear filters
            </button>
          </div>
        )}
      </section>

      {shown.length === 0 ? (
        <section className="rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface py-6 shadow-[var(--shadow-soft)]">
          <EmptyState
            icon={FileBarChart2}
            title={visible.length ? 'No reports match these filters' : 'No reports yet'}
            body={visible.length ? 'Change a filter or clear them all.' : create ? 'Start one from a template. It takes a few minutes.' : 'Reports shared with you will appear here.'}
            action={visible.length ? { label: 'Clear filters', onClick: () => setF(NO_FILTERS) } : create ? { label: 'New report', onClick: onNew } : undefined}
          />
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((r) => (
            <ReportCard key={r.id} r={r} author={authorName(r.ownerId)} canEdit={canEditReport(viewer, me.email, r)} canDuplicate={create} onOpen={() => onOpen(r)} me={me} viewer={viewer} />
          ))}
        </ul>
      )}

      {viewer.role === 'admin' && (
        <p className="text-center text-xs text-faint">
          Reports are saved in this browser for the prototype.{' '}
          <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => (resetReports(), toast({ title: 'Example reports restored', tone: 'info' }))}>
            <RotateCcw className="mr-0.5 inline h-3 w-3" /> Reset examples
          </button>
        </p>
      )}
    </>
  )
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} h-9 pr-8 ${value ? 'border-brand font-semibold text-brand dark:text-brand-600' : 'text-body'}`}>
      <option value="">{placeholder}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}

function ReportCard({ r, author, canEdit, canDuplicate, onOpen, me, viewer }: { r: Report; author: string; canEdit: boolean; canDuplicate: boolean; onOpen: () => void; me: { email: string; name: string }; viewer: Viewer }) {
  const t = templateById(r.templateId)
  // Same per-pillar rule as the metrics layer: an untouched pillar means all of its interventions.
  const narrowed = pillarsNarrowed(r.scope)
  const scopeLine =
    !r.scope.interventions.length && r.scope.pillars.length === 3
      ? 'All pillars'
      : [r.scope.interventions.join(', '), ...r.scope.pillars.filter((p) => !narrowed.has(p)).map((p) => `all ${p} interventions`)].filter(Boolean).join(' · ').replace(/^all/, 'All')
  return (
    <li className="group flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)] transition-shadow duration-150 hover:shadow-[0_2px_4px_rgba(16,44,94,0.06),0_12px_28px_-10px_rgba(16,44,94,0.22)]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 gap-4 p-4 text-left">
        <span className="hidden w-20 shrink-0 sm:block">
          <TemplateThumb template={t} landscape={false} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">{t?.name ?? 'Blank report'}</span>
              <span className="mt-1 block font-display text-lg font-semibold leading-snug text-ink">{r.title}</span>
            </span>
            <StatusPill status={r.status} />
          </span>
          <span className="mt-2 block text-[13px] text-body">
            <b className="font-semibold text-ink">{r.period.label}</b>
            {r.period.label !== fmtRange(r.period.start, r.period.end) && <> · {fmtRange(r.period.start, r.period.end)}</>}
          </span>
          <span className="mt-1 block truncate text-xs text-muted">{scopeLine}</span>
          <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {r.scope.pillars.map((p) => (
              <PillarTag key={p} pillar={p} />
            ))}
            <span className="inline-flex h-5 items-center rounded bg-canvas px-1.5 text-[10px] font-semibold text-muted">{AUDIENCE[r.audience].short}</span>
          </span>
        </span>
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-line bg-canvas/50 px-4 py-2.5">
        <span className="min-w-0 truncate text-xs text-muted">
          <span className="font-semibold text-body">{author}</span> · updated {ago(r.updatedAt)}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onOpen} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-brand hover:bg-surface dark:text-brand-600">
            {canEdit ? <Pencil className="h-3.5 w-3.5" /> : null}
            {canEdit ? 'Edit' : 'Open'}
          </button>
          <Popover
            width="w-56"
            trigger={({ toggle }) => (
              <button type="button" onClick={toggle} aria-label="More actions" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            )}
          >
            {(close) => (
              <div className="p-1">
                {canDuplicate && (
                  <MenuItem
                    icon={Copy}
                    onClick={() => {
                      close()
                      const copy = duplicateForNewPeriod(r.id, me)
                      if (copy) toast({ title: 'Duplicated for the next period', body: `${copy.title} · ${copy.period.label}`, tone: 'good' })
                    }}
                  >
                    Duplicate for new period
                  </MenuItem>
                )}
                <MenuItem
                  icon={Download}
                  onClick={() => {
                    close()
                    // Final reports export their latest frozen version; anything else is a watermarked draft.
                    const version = r.status === 'final' ? latestVersion(r.id) : null
                    if (!isPhone()) toast({ title: 'Opening the print window', body: 'Choose “Save as PDF” as the destination to download it.', tone: 'info' })
                    downloadReportPdf({ report: r, viewer, version }).catch((e) => toast({ title: 'The PDF could not be made', body: e instanceof Error ? e.message : 'Try again.', tone: 'bad' }))
                  }}
                >
                  {r.status === 'final' ? 'Download PDF' : 'Download draft PDF'}
                </MenuItem>
                {canEdit && r.status !== 'archived' && (
                  <MenuItem
                    icon={Archive}
                    tone="bad"
                    onClick={() => {
                      close()
                      archiveReport(r.id)
                      toast({ title: 'Report archived', body: r.title, tone: 'info' })
                    }}
                  >
                    Archive
                  </MenuItem>
                )}
              </div>
            )}
          </Popover>
        </span>
      </div>
    </li>
  )
}
