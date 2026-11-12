/**
 * Wizard steps 5 and 6 (REPORT-TOOL-SPEC §3 steps 5–6, §6).
 *
 *   5 · Preview and check: the live document beside the data check panel.
 *   6 · Finalise and export: finalise / submit / approve, critical-issue override, the frozen
 *       version, version history with "What changed", and starting the next version.
 */
import React, { useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, ArrowRight, Loader2, CheckCircle2, Clock, Download, FileText, History, Info, Lock, RefreshCcw, Send, ShieldCheck } from 'lucide-react'
import { Button, PanelHeader } from '../shared/components/ui'
import { downloadReportPdf } from '../shared/reports/export/pdf'
import { toast } from '../shared/lib/notify'
import { runDataCheck, type DataCheck, type FixTarget, type Issue, type Severity } from '../shared/reports/quality'
import { ReportDocument } from '../shared/reports/render/ReportDocument'
import { FinaliseBlockedError, buildVersion, collectAnswers, finaliseAction, needsApproval, whatChanged, type FinalVersion } from '../shared/reports/snapshot'
import { MetricSource, replaySource } from '../shared/reports/source'
import { commitVersion, startNewVersion, submitForReview, useVersions } from '../shared/reports/store'
import type { Report, Viewer } from '../shared/reports/types'

/* ---------- Shared: run the check on the report as it stands ---------- */

function useCheck(report: Report, viewer: Viewer) {
  // Rendering the report once gives the exact answers it shows (incl. hidden values).
  return useMemo(() => {
    const answers = collectAnswers(report, viewer)
    return runDataCheck(viewer, report, answers)
  }, [report, viewer])
}

const SEVERITY: Record<Severity, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string; dot: string }> = {
  critical: { label: 'Critical', icon: AlertOctagon, cls: 'border-bad/30 bg-bad-bg text-bad', dot: 'bg-bad' },
  warning: { label: 'Warning', icon: AlertTriangle, cls: 'border-warn/30 bg-warn-bg text-warn', dot: 'bg-warn' },
  info: { label: 'Note', icon: Info, cls: 'border-line bg-canvas text-muted', dot: 'bg-faint' },
}

/* ---------- Step 5: Preview and check ---------- */

export function CheckStep({ report, viewer, onFix }: { report: Report; viewer: Viewer; onFix: (t: FixTarget) => void }) {
  const check = useCheck(report, viewer)
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface px-4 py-2.5 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-muted">This is how the report reads now, with live numbers. A draft PDF is watermarked “DRAFT”.</p>
          <PdfButton report={report} viewer={viewer} />
        </div>
        <div className="rounded-[var(--radius-card)] bg-canvas py-6">
          <ReportDocument report={report} viewer={viewer} notes={{ check, asOf: check.checkedAt }} />
        </div>
      </div>
      <aside className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:self-start xl:overflow-y-auto">
        <DataCheckPanel check={check} onFix={onFix} />
      </aside>
    </div>
  )
}

function DataCheckPanel({ check, onFix }: { check: DataCheck; onFix: (t: FixTarget) => void }) {
  const { critical, warning } = check.counts
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)]">
      <PanelHeader title="Data check" sub={`${check.people.toLocaleString()} people in scope · checked just now`} info="Completeness and data quality issues for this report’s scope and period. Warnings are listed in the report’s data notes; critical issues block finalising." />
      <div
        className={`flex items-start gap-2.5 border-b border-line px-4 py-3 text-[13px] ${critical ? 'bg-bad-bg text-bad' : warning ? 'bg-warn-bg text-warn' : 'bg-good-bg text-good'}`}
      >
        {critical ? <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" /> : warning ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {critical ? (
            <>
              <b>{critical} critical {critical === 1 ? 'issue blocks' : 'issues block'} finalising.</b> Fix {critical === 1 ? 'it' : 'them'}, or a MELA admin can override with a reason.
            </>
          ) : warning ? (
            <>
              <b>Ready to finalise, with {warning} {warning === 1 ? 'warning' : 'warnings'}.</b> {warning === 1 ? 'It' : 'They'} will be listed in the data notes.
            </>
          ) : (
            <b>No issues. Ready to finalise.</b>
          )}
        </span>
      </div>

      <div className="border-b border-line p-4">
        <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">Completeness</p>
        <ul className="space-y-2.5">
          {check.completeness.map((c) => {
            const v = c.pct ?? 0
            const tone = c.pct == null ? 'bg-line-strong' : v >= 90 ? 'bg-good' : v >= 60 ? 'bg-brand-600' : 'bg-warn'
            return (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="font-medium text-ink">{c.label}</span>
                  <span className="tabular-nums text-body">{c.pct == null ? '—' : `${c.pct}%`}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} />
                </div>
                <p className="mt-0.5 text-[10.5px] text-faint">{c.detail}</p>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="p-4">
        <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">Issues</p>
        {check.issues.length ? (
          <ul className="space-y-2">
            {check.issues.map((i) => (
              <IssueRow key={i.id} issue={i} onFix={onFix} />
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-body">Nothing to fix for this scope and period.</p>
        )}
      </div>
    </section>
  )
}

function IssueRow({ issue, onFix }: { issue: Issue; onFix?: (t: FixTarget) => void }) {
  const s = SEVERITY[issue.severity]
  const Icon = s.icon
  return (
    <li className={`rounded-lg border px-3 py-2.5 ${s.cls}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold leading-5">{issue.title}</p>
          <p className="mt-0.5 text-[11.5px] leading-5 text-body">{issue.detail}</p>
          {issue.fix && onFix && (
            <button type="button" onClick={() => onFix(issue.fix!)} className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline dark:text-brand-600">
              {issue.fix.label} <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

/* ---------- Step 6: Finalise and export ---------- */

export function FinaliseStep({
  report,
  viewer,
  me,
  canEditContent,
  onChange,
  onFix,
}: {
  report: Report
  viewer: Viewer
  me: { email: string; name: string }
  /** Whether this person may start a new version (same people who may edit drafts). */
  canEditContent: boolean
  onChange: (r: Report) => void
  onFix: (t: FixTarget) => void
}) {
  const versions = useVersions(report.id)
  const latest = versions.length ? versions[versions.length - 1] : null
  const [shown, setShown] = useState<number | null>(null)

  if (report.status === 'final' && latest) {
    const v = versions.find((x) => x.versionNo === (shown ?? latest.versionNo)) ?? latest
    return (
      <FinalView
        version={v}
        versions={versions}
        viewer={viewer}
        onShow={setShown}
        canStartNext={canEditContent || viewer.role === 'admin' || viewer.role === 'pillar_lead' || viewer.role === 'pillar_staff'}
        onStartNext={() => {
          const next = startNewVersion(report)
          toast({ title: `Started v${latest.versionNo + 1}`, body: 'The draft shows live data again. v1 stays frozen.', tone: 'info' })
          onChange(next)
        }}
      />
    )
  }
  return <ReadyView report={report} viewer={viewer} me={me} previous={latest} onChange={onChange} onFix={onFix} />
}

function ReadyView({ report, viewer, me, previous, onChange, onFix }: { report: Report; viewer: Viewer; me: { email: string; name: string }; previous: FinalVersion | null; onChange: (r: Report) => void; onFix: (t: FixTarget) => void }) {
  const check = useCheck(report, viewer)
  const nextNo = (previous?.versionNo ?? 0) + 1
  const action = finaliseAction(viewer, report, nextNo)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const critical = check.counts.critical
  const overriding = critical > 0 && viewer.role === 'admin'
  const blocked = critical > 0 && (viewer.role !== 'admin' || !reason.trim())
  const textLeft = check.issues.filter((i) => i.id.startsWith('starter-')).length

  const run = () => {
    setError('')
    try {
      if (action.kind === 'submit') {
        onChange(submitForReview(report))
        toast({ title: 'Submitted for review', body: needsApproval(report) ? 'MELA will review and approve it.' : 'A pillar lead or MELA will finalise it.', tone: 'good' })
        return
      }
      const v = buildVersion(report, viewer, me, previous, { overrideReason: overriding ? reason : undefined })
      onChange(commitVersion(report, v))
      toast({ title: `Finalised as v${v.versionNo}`, body: 'Its numbers are now frozen.', tone: 'good' })
    } catch (e) {
      if (e instanceof FinaliseBlockedError) setError(e.message)
      else throw e
    }
  }

  const checklist: { ok: boolean; label: string; detail?: string; warn?: boolean }[] = [
    { ok: !!report.title.trim(), label: 'Title', detail: report.title || 'Missing' },
    { ok: (report.blocks?.length ?? 0) > 0, label: 'Content', detail: `${report.sections?.length ?? 0} sections · ${report.blocks?.length ?? 0} blocks` },
    { ok: textLeft === 0, warn: true, label: 'Narrative written', detail: textLeft ? `${textLeft} ${textLeft === 1 ? 'section still has' : 'sections still have'} template text` : 'All text sections written' },
    { ok: critical === 0, label: 'No critical data issues', detail: critical ? `${critical} critical ${critical === 1 ? 'issue' : 'issues'}${viewer.role === 'admin' ? ': override below with a reason' : ''}` : `${check.counts.warning} warnings will go in the data notes` },
    { ok: !needsApproval(report) || viewer.role === 'admin', warn: true, label: 'Approval', detail: needsApproval(report) ? (viewer.role === 'admin' ? 'You can approve it as MELA' : 'Needs MELA approval') : 'Internal: no approval needed' },
  ]

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)]">
          <PanelHeader title={previous ? `Finalise v${nextNo}` : 'Finalise'} sub="Finalising freezes every number, chart, table and placeholder. The final report never changes, even if data is corrected later." />
          <ul className="divide-y divide-line">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-start gap-3 px-5 py-3">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 text-good" /> : c.warn ? <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warn" /> : <AlertOctagon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-bad" />}
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">{c.label}</span>
                  <span className="block text-xs text-muted">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          {critical > 0 && (
            <div className="border-t border-line p-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-bad">Critical issues</p>
              <ul className="space-y-2">
                {check.issues
                  .filter((i) => i.severity === 'critical')
                  .map((i) => (
                    <IssueRow key={i.id} issue={i} onFix={onFix} />
                  ))}
              </ul>
              {overriding && (
                <label className="mt-4 block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <ShieldCheck className="h-4 w-4 text-brand-600" /> Override as MELA admin
                  </span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why can this report be finalised anyway? e.g. Attendance sheet lost; numbers agreed with the pillar lead."
                    className="h-20 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                  <span className="mt-1 block text-xs text-muted">The reason is stored with the version and printed in its data notes.</span>
                </label>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas/60 px-5 py-4">
            <p className="text-xs text-muted">{action.kind === 'none' || action.kind === 'submit' ? action.why : `Will be finalised by ${me.name}${previous ? ` · v${previous.versionNo} stays as it is` : ''}`}</p>
            {action.kind !== 'none' && (
              <Button variant="primary" onClick={run} className={action.kind !== 'submit' && blocked ? 'pointer-events-none opacity-50' : ''}>
                {action.kind === 'submit' ? <Send className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {action.label}
              </Button>
            )}
          </div>
          {error && <p className="border-t border-line bg-bad-bg px-5 py-2.5 text-xs font-semibold text-bad">{error}</p>}
        </section>

        <ExportCard report={report} viewer={viewer} />
      </div>

      <aside className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:self-start xl:overflow-y-auto">
        <DataCheckPanel check={check} onFix={onFix} />
      </aside>
    </div>
  )
}

function FinalView({
  version,
  versions,
  viewer,
  onShow,
  canStartNext,
  onStartNext,
}: {
  version: FinalVersion
  versions: FinalVersion[]
  viewer: Viewer
  onShow: (n: number) => void
  canStartNext: boolean
  onStartNext: () => void
}) {
  const replay = useMemo(() => replaySource(version.snapshot.answers), [version])
  const latestNo = versions[versions.length - 1].versionNo
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-good/30 bg-good-bg px-4 py-3 text-sm text-good">
          <Lock className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <b>Version {version.versionNo} is final.</b> Numbers are frozen as of {fmt(version.dataAsOf)}
            {version.versionNo !== latestNo && <span className="font-semibold"> · an older version (latest is v{latestNo})</span>}.
          </span>
        </div>
        <div className="rounded-[var(--radius-card)] bg-canvas py-6">
          {/* Replayed from the snapshot: these numbers are the ones frozen at finalising. */}
          <MetricSource ask={replay}>
            <ReportDocument report={version.snapshot.report} viewer={viewer} notes={{ check: version.snapshot.check, asOf: version.dataAsOf, version: version.versionNo, override: version.snapshot.override }} />
          </MetricSource>
        </div>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)] xl:self-start xl:overflow-y-auto">
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)]">
          <PanelHeader title="Versions" sub="Each version is frozen. A new one is regenerated from current data." />
          <ol className="divide-y divide-line">
            {[...versions].reverse().map((v, i, arr) => {
              const prev = arr[i + 1]
              const changes = prev ? whatChanged(prev, v) : []
              const on = v.versionNo === version.versionNo
              return (
                <li key={v.id} className={on ? 'bg-brand-50/50 dark:bg-brand-50' : ''}>
                  <button type="button" onClick={() => onShow(v.versionNo)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-canvas">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-semibold ${on ? 'bg-brand text-white' : 'bg-canvas text-body'}`}>v{v.versionNo}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-ink">
                        Final · {fmt(v.finalisedAt)}
                        {v.versionNo === latestNo && <span className="ml-1.5 rounded bg-good-bg px-1.5 py-px text-[10px] font-bold uppercase text-good">Latest</span>}
                      </span>
                      <span className="block text-xs text-muted">
                        {v.approvedBy ? `Approved by ${v.approvedBy}` : `By ${v.finalisedBy}`}
                        {v.snapshot.override && ' · critical issues overridden'}
                      </span>
                      {prev && (
                        <span className="mt-1.5 block rounded-md border border-line bg-surface px-2.5 py-2 text-[11.5px] text-body">
                          <span className="mb-1 flex items-center gap-1 font-semibold text-ink">
                            <History className="h-3 w-3" /> What changed since v{prev.versionNo}
                          </span>
                          {changes.length ? (
                            changes.slice(0, 6).map((c) => (
                              <span key={c.code} className="block">
                                {c.label}: {c.before} → <b className="text-ink">{c.after}</b>
                              </span>
                            ))
                          ) : (
                            <span className="block text-muted">No headline numbers changed.</span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          {canStartNext && (
            <div className="border-t border-line bg-canvas/60 p-4">
              <Button variant="primary" onClick={onStartNext} className="w-full">
                <RefreshCcw className="h-4 w-4" /> Start v{latestNo + 1} from current data
              </Button>
              <p className="mt-2 text-[11px] leading-4 text-muted">Reopens the report as a draft with live numbers. Finalising it adds v{latestNo + 1}; earlier versions stay frozen.</p>
            </div>
          )}
        </section>
        <ExportCard report={version.snapshot.report} viewer={viewer} version={version} />
      </aside>
    </div>
  )
}

/** Downloads the report as a PDF: a watermarked draft with live numbers, or a frozen version. */
export function PdfButton({ report, viewer, version, variant = 'secondary', className = '' }: { report: Report; viewer: Viewer; version?: FinalVersion | null; variant?: 'primary' | 'secondary'; className?: string }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const name = await downloadReportPdf({ report, viewer, version })
      toast({ title: version ? `Downloaded v${version.versionNo} as PDF` : 'Downloaded draft PDF', body: name, tone: 'good' })
    } catch (e) {
      console.error(e)
      toast({ title: 'The PDF could not be made', body: e instanceof Error ? e.message : 'Try again.', tone: 'bad' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant={variant} onClick={run} className={`${busy ? 'pointer-events-none opacity-70' : ''} ${className}`}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? 'Making PDF…' : version ? `Download v${version.versionNo} (PDF)` : 'Download draft (PDF)'}
    </Button>
  )
}

function ExportCard({ report, viewer, version }: { report: Report; viewer: Viewer; version?: FinalVersion }) {
  const later = [
    { label: 'XLSX', body: 'The data behind every block' },
    { label: 'DOCX', body: 'Editable, for partners' },
    { label: 'PPTX', body: 'One slide per section' },
  ]
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface shadow-[var(--shadow-soft)]">
      <PanelHeader
        title="Export"
        sub={version ? `Exports use frozen version ${version.versionNo}.` : 'Drafts download with a DRAFT watermark and live numbers. Clean copies come from final versions.'}
      />
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3 rounded-lg border border-line p-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">PDF</p>
            <p className="text-[11.5px] text-muted">
              {version ? 'Print-ready A4, with cover, contents and data notes.' : 'Every page watermarked DRAFT, with the time the numbers were pulled.'}
            </p>
            <PdfButton report={report} viewer={viewer} version={version} variant="primary" className="mt-2.5" />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {later.map((f) => (
            <button key={f.label} type="button" disabled title="Coming next in build step 5" className="flex cursor-not-allowed items-start gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-left opacity-60">
              <span>
                <span className="block text-[13px] font-semibold text-ink">{f.label}</span>
                <span className="block text-[11px] leading-4 text-muted">{f.body}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-[11px] text-muted">
        <Clock className="h-3 w-3" /> XLSX, DOCX and PPTX come next.
      </p>
    </section>
  )
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
