/**
 * Worksheets for selective interventions: the selection spreadsheet staff work from.
 *
 * - A worksheet template is a list of columns. Some fill themselves from the platform (CHII ID,
 *   cohort, application answers, reviewers' score); others are filled in by staff (decision,
 *   interview score, notes…). Built-in templates cover selection, interviews and placements;
 *   staff can save their own for an intervention and reuse it every cohort.
 * - A worksheet is a template applied to one cohort, or to every cohort of the intervention
 *   (the master worksheet). Each intervention can generate one automatically for every cohort.
 * - Existing worksheets (Excel or CSV) can be imported: rows are matched to applicants by CHII ID
 *   or email, and their values fill the worksheet's columns.
 *
 * Browser-only like the rest of the prototype (localStorage).
 */
import { useSyncExternalStore } from 'react'
import { applications, participants, type Participant } from './mela'
import type { SessionRun } from './sessionStore'
import { applicationTemplateFor } from '../forms/templates'
import { sampleAnswers } from '../forms/samples'

/* ---------- Columns and templates ---------- */

export type ColumnSource =
  | { kind: 'chii_id' }
  | { kind: 'name' }
  | { kind: 'email' }
  | { kind: 'cohort' }
  | { kind: 'applied' }
  | { kind: 'score' }
  | { kind: 'answer'; question: string }
  /** Filled in by staff (or by an import). */
  | { kind: 'manual'; input: 'text' | 'number' | 'select' | 'date'; options?: string[] }

export type WsColumn = { key: string; label: string; source: ColumnSource }

export type WsTemplate = {
  id: string
  name: string
  description: string
  /** Only for this intervention, or null for any selective intervention. */
  intervention: string | null
  columns: WsColumn[]
  builtIn?: boolean
  createdBy?: string
}

const DECISION: WsColumn = { key: 'decision', label: 'Decision', source: { kind: 'manual', input: 'select', options: ['Selected', 'Waitlisted', 'Not selected', 'Withdrew'] } }
const NOTES: WsColumn = { key: 'notes', label: 'Notes', source: { kind: 'manual', input: 'text' } }
const BASE: WsColumn[] = [
  { key: 'chii_id', label: 'CHII ID', source: { kind: 'chii_id' } },
  { key: 'name', label: 'Name', source: { kind: 'name' } },
  { key: 'cohort', label: 'Cohort', source: { kind: 'cohort' } },
  { key: 'applied', label: 'Applied', source: { kind: 'applied' } },
]

export const BUILT_IN_TEMPLATES: WsTemplate[] = [
  {
    id: 'ws-selection',
    name: 'Selection worksheet',
    description: 'One row per applicant with the reviewers’ score, then a second reviewer, decision and notes.',
    intervention: null,
    builtIn: true,
    columns: [
      ...BASE,
      { key: 'score', label: 'Reviewer score /20', source: { kind: 'score' } },
      { key: 'second', label: 'Second reviewer /20', source: { kind: 'manual', input: 'number' } },
      DECISION,
      NOTES,
    ],
  },
  {
    id: 'ws-interview',
    name: 'Interview worksheet',
    description: 'For shortlisted applicants: interview date, panel scores and a recommendation.',
    intervention: null,
    builtIn: true,
    columns: [
      ...BASE,
      { key: 'score', label: 'Application score /20', source: { kind: 'score' } },
      { key: 'interview_date', label: 'Interview date', source: { kind: 'manual', input: 'date' } },
      { key: 'panel', label: 'Panel score /10', source: { kind: 'manual', input: 'number' } },
      { key: 'recommend', label: 'Recommendation', source: { kind: 'manual', input: 'select', options: ['Strongly recommend', 'Recommend', 'Do not recommend'] } },
      DECISION,
      NOTES,
    ],
  },
  {
    id: 'ws-placement',
    name: 'Placement worksheet',
    description: 'For selected people going to a host: host, department, supervisor and start date.',
    intervention: null,
    builtIn: true,
    columns: [
      ...BASE,
      { key: 'host', label: 'Host organisation', source: { kind: 'manual', input: 'text' } },
      { key: 'department', label: 'Department', source: { kind: 'manual', input: 'text' } },
      { key: 'supervisor', label: 'Supervisor', source: { kind: 'manual', input: 'text' } },
      { key: 'start', label: 'Start date', source: { kind: 'manual', input: 'date' } },
      { key: 'confirmed', label: 'Placement confirmed', source: { kind: 'manual', input: 'select', options: ['Yes', 'Pending', 'No'] } },
      NOTES,
    ],
  },
]

/** Fields a custom template can include, for an intervention (its application answers included). */
export function availableColumns(intervention: string): WsColumn[] {
  const t = applicationTemplateFor(intervention)
  const answers: WsColumn[] = (t?.questions ?? [])
    .filter((q) => !q.identity && !q.sensitive && (q.type === 'radio' || q.type === 'select' || q.type === 'checkboxes' || q.type === 'textarea'))
    .map((q) => ({ key: `a_${q.id}`, label: q.label.length > 40 ? `${q.label.slice(0, 38)}…` : q.label, source: { kind: 'answer', question: q.id } }))
  return [...BASE, { key: 'email', label: 'Email', source: { kind: 'email' } }, { key: 'score', label: 'Reviewer score /20', source: { kind: 'score' } }, ...answers]
}

/* ---------- Applicants ---------- */

export type Applicant = { person: Participant; cohort: string; sessionId: string; applied: string; score: number | null; answers: Record<string, string | string[] | undefined> }

/**
 * The applicants of a cohort, the same way the session's Applications tab lists them (sample
 * data in the prototype; the application responses once there's a server).
 */
export function applicantsOf(s: SessionRun): Applicant[] {
  const pool = participants.filter((x) => x.interventions.includes(s.intervention))
  const list = (pool.length >= 8 ? pool : participants.slice(0, 24)).slice(0, s.created ? s.registered : undefined)
  const t = applicationTemplateFor(s.intervention, s.name)
  return list.map((p, i) => ({
    person: p,
    cohort: s.name,
    sessionId: s.id,
    applied: p.joined,
    score: (i * 7) % 5 === 0 ? null : 9 + ((i * 13) % 12),
    answers: applications.find((a) => a.id === p.id)?.answers ?? (t ? sampleAnswers(t, p.id) : {}),
  }))
}

/* ---------- Worksheets ---------- */

export type Worksheet = {
  id: string
  intervention: string
  /** The cohort it covers, or null for the master worksheet (every cohort). */
  sessionId: string | null
  templateId: string
  name: string
  createdBy: string
  createdAt: string
  updatedAt: string
  /** Values typed in or imported, by CHII ID then column key. */
  values: Record<string, Record<string, string>>
  /** Columns that came from an import and aren't in the template. */
  extraColumns?: WsColumn[]
  imports?: { file: string; at: string; by: string; matched: number; unmatched: number }[]
  auto?: boolean
}

type Settings = { defaultTemplate: string; autoGenerate: boolean }
type State = { worksheets: Worksheet[]; templates: WsTemplate[]; settings: Record<string, Settings> }

const KEY = 'mela-worksheets-v1'
let cache: State | null = null
const listeners = new Set<() => void>()
function load(): State {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as State) : { worksheets: [], templates: [], settings: {} }
  } catch {
    cache = { worksheets: [], templates: [], settings: {} }
  }
  return cache
}
function persist(next: State) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* keep in memory */
  }
  listeners.forEach((l) => l())
}
export const useWorksheets = () => useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), load, load)
export const getWorksheets = load
const now = () => new Date().toISOString()

export const templatesFor = (intervention: string) => [...BUILT_IN_TEMPLATES, ...load().templates.filter((t) => t.intervention === intervention || t.intervention === null)]
export const templateById = (id: string) => [...BUILT_IN_TEMPLATES, ...load().templates].find((t) => t.id === id)
/** Each intervention's reused template and whether a worksheet is made for every new cohort (on by default). */
export const settingsFor = (intervention: string): Settings => load().settings[intervention] ?? { defaultTemplate: 'ws-selection', autoGenerate: true }

export function setSettings(intervention: string, patch: Partial<Settings>) {
  const s = load()
  persist({ ...s, settings: { ...s.settings, [intervention]: { ...settingsFor(intervention), ...patch } } })
}

export class WorksheetError extends Error {}

/** Save a custom template for an intervention, to reuse for every cohort. */
export function saveTemplate(t: Omit<WsTemplate, 'id' | 'builtIn'>, id?: string): WsTemplate {
  if (!t.name.trim()) throw new WorksheetError('Name the template.')
  if (!t.columns.some((c) => c.key === 'chii_id')) throw new WorksheetError('A worksheet needs the CHII ID column, to match rows.')
  const s = load()
  const tpl: WsTemplate = { ...t, name: t.name.trim(), id: id ?? `wst-${Date.now().toString(36)}` }
  persist({ ...s, templates: id ? s.templates.map((x) => (x.id === id ? tpl : x)) : [...s.templates, tpl] })
  return tpl
}

export function deleteTemplate(id: string) {
  const s = load()
  persist({ ...s, templates: s.templates.filter((t) => t.id !== id) })
}

/** Make a worksheet from a template, for one cohort or (sessionId null) every cohort. */
export function generateWorksheet(input: { intervention: string; sessionId: string | null; templateId: string; by: string; cohortName?: string; auto?: boolean }): Worksheet {
  const t = templateById(input.templateId)
  if (!t) throw new WorksheetError('Choose a template.')
  const ws: Worksheet = {
    id: `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    intervention: input.intervention,
    sessionId: input.sessionId,
    templateId: t.id,
    name: `${t.name} · ${input.sessionId ? input.cohortName ?? 'Cohort' : `${input.intervention}, all cohorts`}`,
    createdBy: input.by,
    createdAt: now(),
    updatedAt: now(),
    values: {},
    auto: input.auto,
  }
  const s = load()
  persist({ ...s, worksheets: [ws, ...s.worksheets] })
  return ws
}

/** "Always generate": every cohort of the intervention without a worksheet gets one, from the reused template. */
export function ensureCohortWorksheets(intervention: string, runs: SessionRun[], by: string) {
  const st = settingsFor(intervention)
  if (!st.autoGenerate) return 0
  const have = new Set(load().worksheets.filter((w) => w.intervention === intervention).map((w) => w.sessionId))
  let n = 0
  for (const r of runs) if (!have.has(r.id)) (generateWorksheet({ intervention, sessionId: r.id, templateId: st.defaultTemplate, by, cohortName: r.name, auto: true }), n++)
  return n
}

export function deleteWorksheet(id: string) {
  const s = load()
  persist({ ...s, worksheets: s.worksheets.filter((w) => w.id !== id) })
}

export function setCell(id: string, chiiId: string, key: string, value: string) {
  const s = load()
  persist({
    ...s,
    worksheets: s.worksheets.map((w) => (w.id === id ? { ...w, updatedAt: now(), values: { ...w.values, [chiiId]: { ...w.values[chiiId], [key]: value } } } : w)),
  })
}

/** The worksheet's columns: its template's, plus any added by an import. */
export const columnsOf = (w: Worksheet) => [...(templateById(w.templateId)?.columns ?? []), ...(w.extraColumns ?? [])]

/** The rows to show: applicants of the cohort(s), with platform values filled in and staff values on top. */
export function rowsOf(w: Worksheet, runs: SessionRun[]): { key: string; id: string; cells: Record<string, string> }[] {
  const cohorts = runs.filter((r) => r.intervention === w.intervention && (w.sessionId == null || r.id === w.sessionId))
  const cols = columnsOf(w)
  const seen = new Set<string>()
  return cohorts.flatMap(applicantsOf).flatMap((a) => {
    // The master worksheet lists a person once per cohort they applied to.
    const id = w.sessionId == null ? `${a.person.id}|${a.sessionId}` : a.person.id
    if (seen.has(id)) return []
    seen.add(id)
    const cells: Record<string, string> = {}
    for (const c of cols) {
      const src = c.source
      cells[c.key] =
        src.kind === 'chii_id'
          ? a.person.id
          : src.kind === 'name'
            ? a.person.name
            : src.kind === 'email'
              ? a.person.email
              : src.kind === 'cohort'
                ? a.cohort
                : src.kind === 'applied'
                  ? a.applied
                  : src.kind === 'score'
                    ? a.score == null ? '' : String(a.score)
                    : src.kind === 'answer'
                      ? [a.answers[src.question] ?? ''].flat().join(', ')
                      : ''
    }
    const typed = w.values[a.person.id] ?? {}
    for (const [k, v] of Object.entries(typed)) cells[k] = v
    return [{ key: id, id: a.person.id, cells }]
  })
}

/* ---------- Import ---------- */

export type ImportPlan = { header: string[]; mapping: Record<number, string>; idColumn: number; matched: string[]; unmatched: number; newColumns: string[] }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Plan an import: find the column that identifies people (CHII ID, else email), match each
 * other column to a worksheet column by its heading, and count the rows that match an applicant.
 * Columns that match nothing are added to the worksheet as new columns.
 */
export function planImport(rows: string[][], w: Worksheet, runs: SessionRun[]): ImportPlan {
  const header = (rows[0] ?? []).map((h) => String(h ?? '').trim())
  const cols = columnsOf(w)
  const idColumn = header.findIndex((h) => /chii\s*id/i.test(h))
  const emailColumn = header.findIndex((h) => /e-?mail/i.test(h))
  const key = idColumn >= 0 ? idColumn : emailColumn
  if (key < 0) throw new WorksheetError('The sheet needs a “CHII ID” or “Email” column to match people.')
  const people = rowsOf(w, runs)
  const byEmail = new Map(people.map((p) => [participants.find((x) => x.id === p.id)?.email.toLowerCase(), p.id]))
  const known = new Set(people.map((p) => p.id))
  const mapping: Record<number, string> = {}
  const newColumns: string[] = []
  header.forEach((h, i) => {
    if (i === key || !h) return
    const c = cols.find((x) => norm(x.label) === norm(h) || norm(x.key) === norm(h))
    if (c) {
      if (c.source.kind === 'manual') mapping[i] = c.key
    } else {
      mapping[i] = `x_${norm(h).replace(/ /g, '_')}`
      newColumns.push(h)
    }
  })
  const matched: string[] = []
  let unmatched = 0
  for (const r of rows.slice(1)) {
    const v = String(r[key] ?? '').trim()
    if (!v) continue
    const id = idColumn >= 0 ? v.toUpperCase() : byEmail.get(v.toLowerCase())
    if (id && known.has(id)) matched.push(id)
    else unmatched++
  }
  return { header, mapping, idColumn: key, matched, unmatched, newColumns }
}

export function runImport(id: string, rows: string[][], plan: ImportPlan, file: string, by: string, runs: SessionRun[]) {
  const s = load()
  const w = s.worksheets.find((x) => x.id === id)
  if (!w) throw new WorksheetError('This worksheet doesn’t exist any more.')
  const people = rowsOf(w, runs)
  const byEmail = new Map(people.map((p) => [participants.find((x) => x.id === p.id)?.email.toLowerCase(), p.id]))
  const isId = /chii\s*id/i.test(plan.header[plan.idColumn])
  const values = { ...w.values }
  for (const r of rows.slice(1)) {
    const v = String(r[plan.idColumn] ?? '').trim()
    const pid = isId ? v.toUpperCase() : byEmail.get(v.toLowerCase())
    if (!pid || !people.some((p) => p.id === pid)) continue
    const next = { ...values[pid] }
    for (const [i, k] of Object.entries(plan.mapping)) {
      const cell = r[Number(i)]
      if (cell != null && String(cell).trim() !== '') next[k] = String(cell).trim()
    }
    values[pid] = next
  }
  const extra = [...(w.extraColumns ?? [])]
  plan.newColumns.forEach((h) => {
    const k = `x_${norm(h).replace(/ /g, '_')}`
    if (!extra.some((c) => c.key === k)) extra.push({ key: k, label: h, source: { kind: 'manual', input: 'text' } })
  })
  const next: Worksheet = { ...w, values, extraColumns: extra, updatedAt: now(), imports: [...(w.imports ?? []), { file, at: now(), by, matched: plan.matched.length, unmatched: plan.unmatched }] }
  persist({ ...s, worksheets: s.worksheets.map((x) => (x.id === id ? next : x)) })
  return next
}

export function resetWorksheets() {
  persist({ worksheets: [], templates: [], settings: {} })
}
