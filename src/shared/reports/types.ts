/**
 * Report tool types. Shapes follow REPORT-TOOL-SPEC §10 so a server-backed version can
 * reuse them unchanged. In this prototype they are stored in the browser (see store.ts).
 */
import type { Pillar, Role } from '../data/mela'

/* ---------- Metrics layer ---------- */

/** Which date decides whether a record falls in the report period (spec §3, step 2). */
export type DateRule = 'session' | 'registration' | 'response'

export type Comparison = 'none' | 'previous' | 'last_year'

/** Reports are aggregates only: these are the only dimensions a metric can be broken down by. */
export type Dimension =
  | 'pillar'
  | 'intervention'
  | 'cohort'
  | 'gender'
  | 'age_group'
  | 'nationality'
  | 'residence'
  | 'disability'
  | 'humanitarian'
  | 'beneficiary_type'
  | 'month'
  | 'quarter'

/** Optional scope filters (spec §3 step 2). Cohort status filters on the cohort, the rest on the person. */
export type FilterKey = Exclude<Dimension, 'pillar' | 'intervention' | 'cohort' | 'month' | 'quarter'> | 'cohort_status'

export type Scope = {
  pillars: Pillar[]
  /** Empty means "all interventions in the chosen pillars". */
  interventions: string[]
  /** Empty means "all cohorts". */
  cohorts: string[]
  filters: Partial<Record<FilterKey, string[]>>
}

export type Period = {
  /** ISO dates, inclusive. */
  start: string
  end: string
  label: string
}

export type Audience = 'internal' | 'partner' | 'public'

/** Who is asking. Permissions and suppression are applied against this, in getMetric only. */
export type Viewer = {
  role: Role
  /** Pillars this person may report on. Admins: all three. */
  pillars: Pillar[]
  /** MELA admins can switch sensitive breakdowns on for Public reports (spec §8). */
  allowSensitive?: boolean
}

export type MetricRequest = {
  code: string
  scope: Scope
  period: Period
  dateRule: DateRule
  breakdown?: Dimension
  comparison?: Comparison
  audience: Audience
}

export type MetricCell = {
  key: string
  label: string
  /** Null when suppressed. */
  value: number | null
  display: string
  /** Share of the total, 0–100. Null when suppressed or not meaningful (rates, averages). */
  pct: number | null
  /** People behind the cell. Null when suppressed. */
  n: number | null
  suppressed: boolean
  /** Hidden only so a suppressed neighbour can't be worked out from the total. */
  secondary?: boolean
}

export type MetricResult = {
  code: string
  label: string
  unit: Unit
  value: number | null
  display: string
  /** People behind the headline value (the base for rates and averages). */
  n: number
  suppressed: boolean
  rows?: MetricCell[]
  comparison?: { label: string; period: Period; value: number | null; display: string; delta: number | null; deltaPct: number | null }
  threshold: number
  definition: string
  definitionVersion: number
  dateRule: DateRule
  asOf: string
}

export type Unit = 'people' | 'count' | 'rate' | 'average' | 'score' | 'nps' | 'amount'

/* ---------- Reports ---------- */

export type ReportStatus = 'draft' | 'in_review' | 'approved' | 'final' | 'archived'

export type ScopeType = 'intervention' | 'cohort' | 'pillar' | 'all_pillars' | 'survey' | 'data_quality' | 'any'

/** A block kind, used for template outlines now and the block library in build step 3. */
export type BlockKind = 'kpi' | 'chart' | 'table' | 'text'

export type ReportTemplate = {
  id: string
  name: string
  description: string
  scopeType: ScopeType
  defaultDateRule: DateRule
  layout: 'a4_portrait' | 'a4_landscape'
  audienceDefault: Audience
  /** Needs MELA approval before it can be finalised (spec §6). */
  needsApproval: boolean
  /** Section outline: drives the thumbnail now and the default blocks in build step 3. */
  sections: { title: string; blocks: BlockKind[]; required?: boolean; locked?: boolean }[]
  version: number
  system: boolean
  active: boolean
}

export type Cover = {
  showLogo: boolean
  /** Uses the pillar's brand colour; MELA reports use the CHII navy. */
  pillarColour: boolean
  /** Name of an uploaded cover image (the file itself stays on the author's device). */
  imageName?: string
  imageDataUrl?: string
}

/* ---------- Blocks (spec §4, §10 report_block) ---------- */

export type ChartKind = 'bar' | 'donut' | 'trend' | 'funnel' | 'feedback_items'
export type TableKind = 'breakdown' | 'intervention_summary' | 'cohort_summary'
/** Which narrative section a text block is (drives its heading and starter prompt). */
export type TextRole = 'executive_summary' | 'highlights' | 'challenges' | 'lessons' | 'recommendations' | 'next_steps' | 'free'

export type BlockSettings = {
  /** Indicator code from the dictionary (KPI tiles, bar/donut/trend charts, breakdown tables). */
  metric?: string
  breakdown?: Dimension
  chart?: ChartKind
  table?: TableKind
  sort?: 'value_desc' | 'value_asc' | 'label'
  /** Show only the largest N rows; null shows all. */
  topN?: number | null
  showComparison?: boolean
  /** KPI tiles: an optional target, in the indicator's unit. */
  target?: number | null
  /** Text blocks: rich text (HTML) that may contain {{placeholders}}. */
  html?: string
  textRole?: TextRole
  /** Block-level overrides (spec §3 step 4). Null/empty means "same as the report". */
  overridePreset?: Exclude<PresetIdLike, 'custom'> | null
  overrideInterventions?: string[]
}

/** Mirrors periods.ts PresetId without importing it (keeps types.ts dependency-free). */
type PresetIdLike = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'h1' | 'h2' | 'this_year' | 'last_year' | 'this_fy' | 'last_fy' | 'custom'

export type ReportBlock = {
  id: string
  sectionId: string
  type: BlockKind
  settings: BlockSettings
  caption: string
}

export type ReportSection = {
  id: string
  title: string
  /** From the template: can't be removed. */
  required?: boolean
  /** From the template: can't be changed at all. */
  locked?: boolean
}

export type Report = {
  id: string
  /** Content (build step 3). Missing on reports created before it: filled from the template on first open. */
  sections?: ReportSection[]
  blocks?: ReportBlock[]
  /** False until the author changes the template's default content, so picking another template can refresh it. */
  contentEdited?: boolean
  templateId: string | null
  templateVersion: number | null
  title: string
  subtitle: string
  audience: Audience
  status: ReportStatus
  scope: Scope
  period: Period
  periodPreset: string
  dateRule: DateRule
  comparison: Comparison
  /** Email of the author (the demo accounts stand in for real users). */
  ownerId: string
  preparedBy: string
  reviewers: string[]
  cover: Cover
  createdAt: string
  updatedAt: string
}

/** Frozen copy of every number at finalising (build step 4). Declared now so storage is stable. */
export type ReportVersion = {
  id: string
  reportId: string
  versionNo: number
  snapshot: unknown
  dataAsOf: string
  finalisedBy: string
  finalisedAt: string
}
