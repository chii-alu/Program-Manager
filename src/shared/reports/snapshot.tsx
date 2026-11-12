/**
 * Finalising, versions and "What changed" (REPORT-TOOL-SPEC §6).
 *
 * Finalising renders the report once with a recording source, so the snapshot holds exactly
 * the answers the report shows: every number, chart dataset, table and placeholder value,
 * plus the content, filters, template version, data check and "as of" time. Final versions
 * are replayed from that snapshot and never change, even if the data is corrected later.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { indicatorByCode } from './indicators'
import { runDataCheck, type DataCheck } from './quality'
import { ReportDocument } from './render/ReportDocument'
import { MetricSource, recordingSource, type Recorded } from './source'
import { templateById } from './templates'
import type { Report, Viewer } from './types'

export type Snapshot = {
  /** The report exactly as finalised: content, scope, period, filters, cover. */
  report: Report
  /** Every number the report shows, keyed by request (source.tsx requestKey). */
  answers: Record<string, Recorded>
  check: DataCheck
  templateVersion: number | null
  override?: { by: string; reason: string }
}

export type FinalVersion = {
  id: string
  reportId: string
  versionNo: number
  snapshot: Snapshot
  dataAsOf: string
  finalisedBy: string
  finalisedAt: string
  /** Who approved it, for reports that need MELA approval. */
  approvedBy?: string
}

/** Render the report once, recording every answer it gives. Nothing is displayed. */
export function collectAnswers(report: Report, viewer: Viewer): Record<string, Recorded> {
  const answers: Record<string, Recorded> = {}
  renderToStaticMarkup(
    <MetricSource ask={recordingSource(viewer, answers)}>
      <ReportDocument report={report} viewer={viewer} />
    </MetricSource>,
  )
  return answers
}

/* ---------- Who can do what at the end (spec §2, §6) ---------- */

export type FinaliseAction =
  | { kind: 'finalise'; label: string }
  | { kind: 'approve'; label: string }
  | { kind: 'submit'; label: string; why: string }
  | { kind: 'none'; why: string }

export function needsApproval(report: Pick<Report, 'audience' | 'templateId'>) {
  return report.audience !== 'internal' || !!templateById(report.templateId)?.needsApproval
}

export function finaliseAction(viewer: Viewer, report: Report, nextVersion: number): FinaliseAction {
  if (report.status === 'final') return { kind: 'none', why: 'This version is final. Create a new version to update it.' }
  if (report.status === 'archived') return { kind: 'none', why: 'Archived reports can’t be finalised.' }
  if (viewer.role === 'none') return { kind: 'none', why: 'Your account has no staff role.' }
  if (viewer.role === 'reviewer') return { kind: 'none', why: 'Reviewers comment on and approve reports; the author finalises them.' }
  const approval = needsApproval(report)
  if (viewer.role === 'admin') {
    return report.status === 'in_review' ? { kind: 'approve', label: `Approve and finalise as v${nextVersion}` } : { kind: 'finalise', label: `Finalise as v${nextVersion}` }
  }
  if (report.status === 'in_review') {
    // A pillar lead finalises internal reports their staff submit; external ones wait for MELA.
    if (viewer.role === 'pillar_lead' && !approval) return { kind: 'finalise', label: `Finalise as v${nextVersion}` }
    return { kind: 'none', why: approval ? 'Waiting for MELA approval.' : 'Waiting for a pillar lead or MELA to finalise it.' }
  }
  if (viewer.role === 'pillar_lead' && !approval) return { kind: 'finalise', label: `Finalise as v${nextVersion}` }
  return {
    kind: 'submit',
    label: 'Submit for review',
    why: approval ? 'Partner/Donor and Public reports, and this template, need MELA approval before they’re final.' : 'Pillar staff submit drafts; a pillar lead or MELA finalises them.',
  }
}

/* ---------- Finalise ---------- */

export class FinaliseBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FinaliseBlockedError'
  }
}

/**
 * Freeze the report into the next version. Critical data issues block this unless a MELA
 * admin gives a reason, which is stored with the version and printed in its data notes.
 */
export function buildVersion(
  report: Report,
  viewer: Viewer,
  me: { email: string; name: string },
  previous: FinalVersion | null,
  opts: { overrideReason?: string } = {},
): FinalVersion {
  const answers = collectAnswers(report, viewer)
  const check = runDataCheck(viewer, report, answers)
  const reason = opts.overrideReason?.trim()
  if (check.counts.critical > 0) {
    if (viewer.role !== 'admin') throw new FinaliseBlockedError('Critical data issues must be fixed first, or overridden by a MELA admin.')
    if (!reason) throw new FinaliseBlockedError('Give a reason to override the critical data issues.')
  }
  const now = new Date().toISOString()
  const frozen: Report = structuredClone({ ...report, status: 'final' })
  return {
    id: `ver-${report.id}-${(previous?.versionNo ?? 0) + 1}`,
    reportId: report.id,
    versionNo: (previous?.versionNo ?? 0) + 1,
    snapshot: { report: frozen, answers, check, templateVersion: report.templateVersion, ...(check.counts.critical && reason ? { override: { by: me.name, reason } } : {}) },
    dataAsOf: now,
    finalisedBy: me.name,
    finalisedAt: now,
    ...(report.status === 'in_review' ? { approvedBy: me.name } : {}),
  }
}

/* ---------- What changed between two versions ---------- */

export type Change = { code: string; label: string; before: string; after: string; delta: number | null }

/** Compare the headline numbers (no breakdown) that both versions asked for. */
export function whatChanged(prev: FinalVersion, next: FinalVersion): Change[] {
  const head = (v: FinalVersion) => {
    const out = new Map<string, { label: string; value: number | null; display: string }>()
    Object.entries(v.snapshot.answers).forEach(([key, a]) => {
      if (!('result' in a)) return
      const [code, , , , , breakdown, comparison] = JSON.parse(key) as [string, unknown, string, string, string, string | null, string]
      if (breakdown || comparison !== 'none' || out.has(code)) return
      out.set(code, { label: a.result.label, value: a.result.value, display: a.result.display })
    })
    return out
  }
  const a = head(prev)
  const b = head(next)
  const changes: Change[] = []
  b.forEach((after, code) => {
    const before = a.get(code)
    if (!before || before.display === after.display) return
    changes.push({ code, label: after.label, before: before.display, after: after.display, delta: before.value != null && after.value != null ? Math.round((after.value - before.value) * 10) / 10 : null })
  })
  // People-count changes first, then rates and scores.
  return changes.sort((x, y) => Number(indicatorByCode.get(y.code)?.unit === 'people') - Number(indicatorByCode.get(x.code)?.unit === 'people'))
}
