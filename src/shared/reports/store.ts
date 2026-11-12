/**
 * Report storage and access rules.
 *
 * The prototype has no server, so reports live in this browser's localStorage. The shapes
 * match the spec's tables, so a server version only has to replace load/persist. Access is
 * checked here and in getMetric; on a server the same rules become row-level security.
 */
import { useSyncExternalStore } from 'react'
import { roleMeta, type Pillar } from '../data/mela'
import { customPeriod, nextPeriod, presetPeriod } from './periods'
import { SYSTEM_TEMPLATES } from './templates'
import type { Report, Viewer } from './types'
import type { FinalVersion } from './snapshot'

const KEY = 'mela-reports-v1'

/* ---------- Seed: a few reports so the library shows real states and role rules ---------- */

/** System timestamps use the real clock (data periods use the sample world's "today"). */
const at = (daysAgo: number, hour = 10) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function seed(): Report[] {
  const base = {
    subtitle: '',
    comparison: 'previous' as const,
    cover: { showLogo: true, pillarColour: true },
    reviewers: [] as string[],
  }
  const tpl = (id: string) => SYSTEM_TEMPLATES.find((t) => t.id === id)!
  return [
    {
      ...base,
      id: 'rep-hemp-q3',
      templateId: 'tpl-pillar-quarterly',
      templateVersion: tpl('tpl-pillar-quarterly').version,
      title: 'HEMP quarterly report · Q3 2025',
      subtitle: 'Health Employment pillar',
      audience: 'internal',
      status: 'draft',
      scope: { pillars: ['HEMP'], interventions: [], cohorts: [], filters: {} },
      period: presetPeriod('last_quarter'),
      periodPreset: 'last_quarter',
      dateRule: 'session',
      ownerId: roleMeta.pillar_staff.email,
      preparedBy: roleMeta.pillar_staff.user,
      createdAt: at(9),
      updatedAt: at(2, 15),
    },
    {
      ...base,
      id: 'rep-masterclass-q3',
      templateId: 'tpl-intervention',
      templateVersion: tpl('tpl-intervention').version,
      title: 'Masterclass · Q3 2025',
      audience: 'partner',
      status: 'in_review',
      scope: { pillars: ['HENT'], interventions: ['Masterclass'], cohorts: [], filters: {} },
      period: presetPeriod('last_quarter'),
      periodPreset: 'last_quarter',
      dateRule: 'session',
      ownerId: roleMeta.pillar_lead.email,
      preparedBy: roleMeta.pillar_lead.user,
      reviewers: [roleMeta.reviewer.email],
      createdAt: at(14),
      updatedAt: at(1, 9),
    },
    {
      ...base,
      id: 'rep-chii-h1',
      templateId: 'tpl-chii-biannual',
      templateVersion: tpl('tpl-chii-biannual').version,
      title: 'CHII bi-annual report · H1 2025',
      subtitle: 'All pillars · January to June',
      audience: 'internal',
      status: 'draft',
      scope: { pillars: ['HENT', 'HEMP', 'HECO'], interventions: [], cohorts: [], filters: {} },
      period: presetPeriod('h1'),
      periodPreset: 'h1',
      dateRule: 'session',
      comparison: 'last_year',
      ownerId: roleMeta.admin.email,
      preparedBy: roleMeta.admin.user,
      createdAt: at(30),
      updatedAt: at(6, 11),
    },
    {
      ...base,
      id: 'rep-heco-dq',
      templateId: 'tpl-data-quality',
      templateVersion: tpl('tpl-data-quality').version,
      title: 'HECO data quality · October 2025',
      audience: 'internal',
      status: 'draft',
      scope: { pillars: ['HECO'], interventions: [], cohorts: [], filters: {} },
      period: customPeriod('2025-10-01', '2025-10-31'),
      periodPreset: 'custom',
      dateRule: 'registration',
      comparison: 'none',
      ownerId: roleMeta.admin.email,
      preparedBy: roleMeta.admin.user,
      createdAt: at(8),
      updatedAt: at(8, 16),
    },
  ]
}

/* ---------- Persistence (localStorage can be blocked: fall back to memory) ---------- */

let cache: Report[] | null = null
const listeners = new Set<() => void>()

function load(): Report[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Report[]) : seed()
  } catch {
    cache = seed()
  }
  return cache
}

function persist(next: Report[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked: keep the in-memory copy for this session */
  }
  listeners.forEach((l) => l())
}

export function useReports(): Report[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    load,
    load,
  )
}

export const getReport = (id: string) => load().find((r) => r.id === id) ?? null

export function saveReport(r: Report) {
  const list = load()
  const updated = { ...r, updatedAt: new Date().toISOString() }
  persist(list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? updated : x)) : [updated, ...list])
  return updated
}

/** "Same report, new period" (spec §6): every setting copied, dates moved forward one period. */
export function duplicateForNewPeriod(id: string, owner: { email: string; name: string }): Report | null {
  const src = getReport(id)
  if (!src) return null
  const period = nextPeriod(src.period)
  const now = new Date().toISOString()
  const copy: Report = {
    ...src,
    id: newId(),
    title: src.title.includes(src.period.label) ? src.title.replace(src.period.label, period.label) : `${src.title} · ${period.label}`,
    status: 'draft',
    // A duplicate is a new report: it starts with no finalised versions of its own.
    currentVersion: undefined,
    period,
    periodPreset: 'custom',
    ownerId: owner.email,
    preparedBy: owner.name,
    createdAt: now,
    updatedAt: now,
  }
  persist([copy, ...load()])
  return copy
}

export function archiveReport(id: string) {
  persist(load().map((r) => (r.id === id ? { ...r, status: 'archived', updatedAt: new Date().toISOString() } : r)))
}

export const newId = () => `rep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/** Clears saved reports and restores the examples (used by tests and the demo reset). */
export function resetReports() {
  persistVersions([])
  persist(seed())
}

/* ---------- Versions (spec §6): finalised snapshots, never edited ---------- */

const VERSIONS_KEY = 'mela-report-versions-v1'
let versionCache: FinalVersion[] | null = null

function loadVersions(): FinalVersion[] {
  if (versionCache) return versionCache
  try {
    versionCache = JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]') as FinalVersion[]
  } catch {
    versionCache = []
  }
  return versionCache
}

function persistVersions(next: FinalVersion[]) {
  versionCache = next
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked: keep the in-memory copy for this session */
  }
  listeners.forEach((l) => l())
}

/** All finalised versions of a report, oldest first. */
export const versionsOf = (reportId: string) => loadVersions().filter((v) => v.reportId === reportId).sort((a, b) => a.versionNo - b.versionNo)
export const latestVersion = (reportId: string) => versionsOf(reportId).slice(-1)[0] ?? null

export function useVersions(reportId: string | undefined): FinalVersion[] {
  useReports() // re-render on any store change
  return reportId ? versionsOf(reportId) : []
}

/** Store a finalised version and mark the report final. Versions are append-only. */
export function commitVersion(report: Report, version: FinalVersion): Report {
  if (loadVersions().some((v) => v.reportId === report.id && v.versionNo === version.versionNo)) throw new Error(`v${version.versionNo} already exists`)
  persistVersions([...loadVersions(), version])
  return saveReport({ ...report, status: 'final', currentVersion: version.versionNo })
}

export function submitForReview(report: Report): Report {
  return saveReport({ ...report, status: 'in_review' })
}

/** Reopen a final report as a draft for the next version. The frozen versions are untouched. */
export function startNewVersion(report: Report): Report {
  return saveReport({ ...report, status: 'draft' })
}

/* ---------- Access (spec §2) ---------- */

const within = (pillars: Pillar[], allowed: Pillar[]) => pillars.length > 0 && pillars.every((p) => allowed.includes(p))

/** Admins see everything; reviewers see reports assigned to them; staff see reports inside their pillars. */
export function canViewReport(viewer: Viewer, email: string, r: Report) {
  if (viewer.role === 'admin') return true
  if (viewer.role === 'reviewer') return r.reviewers.includes(email)
  if (viewer.role === 'none') return false
  return within(r.scope.pillars, viewer.pillars)
}

/** Drafts can be edited by staff, leads and admins with access. Reviewers comment; they don't edit. */
export function canEditReport(viewer: Viewer, email: string, r: Report) {
  if (r.status !== 'draft') return false
  if (viewer.role === 'reviewer' || viewer.role === 'none') return false
  return canViewReport(viewer, email, r)
}

export const canCreateReports = (viewer: Viewer) => viewer.role === 'admin' || viewer.role === 'pillar_lead' || viewer.role === 'pillar_staff'
