/**
 * HENT Incubation (Expose → Build → Scale): the shapes behind the screens.
 *
 * Interface first: the prototype keeps these in browser storage (store.ts). They follow the build
 * addendum's tables loosely so a server version can map onto them later, but nothing here is a
 * schema decision.
 */

export type IncStage = 'expose' | 'build' | 'scale'
export const STAGE_LABEL: Record<IncStage, string> = { expose: 'Expose', build: 'Build', scale: 'Scale' }

/* ---------- Curriculum template (reused by every cohort of a stage) ---------- */

export type CurriculumModule = { code: string; stage: IncStage; title: string; position: number; pages?: string }

export type CurriculumSession = { moduleCode: string; no: number; title: string; keyIdea?: string; takeaway?: string }

export type AssessmentKind = 'assignment' | 'final_brief' | 'skills_quiz' | 'confidence_survey' | 'gate_portfolio'
export type Timepoint = 'intake' | 'end_i1' | 'end_i2' | 'end_i3' | 'end_i4' | 'gate'
export const TIMEPOINT_LABEL: Record<Timepoint, string> = { intake: 'Intake', end_i1: 'End of I1', end_i2: 'End of I2', end_i3: 'End of I3', end_i4: 'End of I4', gate: 'Gate' }

export type Assessment = {
  /** 'I1-A1', 'I1-FINAL', 'QUIZ-intake', 'CONF-end_i4', 'GATE'. */
  code: string
  kind: AssessmentKind
  title: string
  moduleCode?: string
  /** Due after this session of the module (2, 5, 8, 10). */
  dueAfter?: number
  timepoint?: Timepoint
  /** Quiz total or survey maximum; rubric work has none. */
  maxScore?: number
}

export type Curriculum = {
  version: string
  modules: CurriculumModule[]
  sessions: CurriculumSession[]
  assessments: Assessment[]
  /** Rubric criteria per module (assignments use their module's criteria). */
  criteria: Record<string, string[]>
  /** The 1–N rubric scale. */
  scaleMax: number
  updatedBy?: string
  updatedAt?: string
}

/* ---------- Cohorts and their class meetings ---------- */

export type Cohort = {
  id: string
  name: string
  stage: IncStage
  startsOn: string
  endsOn?: string
  /** Canvas course IDs: one for all modules, or one per module (keyed I1–I4). */
  canvas: { mode: 'one' | 'per_module'; courses: Record<string, string> }
  /** Share of a module's sessions a founder must attend to complete it (0–1). */
  threshold: number
  curriculumVersion?: string
  createdBy: string
  createdAt: string
}

export type Delivered = 'as_planned' | 'changed' | 'skipped' | 'rescheduled'
export const DELIVERED_LABEL: Record<Delivered, string> = { as_planned: 'As planned', changed: 'Changed', skipped: 'Skipped', rescheduled: 'Rescheduled' }

export type DeliveryLog = {
  delivered: Delivered
  facilitator: string
  durationMin: number | null
  readingAssigned: boolean
  activityDone: boolean
  changes: string
  issues: string
  loggedBy: string
  loggedAt: string
}

/** One class meeting of a cohort (I1 S01 … I4 S10). */
export type ClassSession = {
  id: string
  cohortId: string
  moduleCode: string
  no: number
  title: string
  date?: string
  /** CHII IDs present. */
  present: string[]
  delivery?: DeliveryLog
}

/* ---------- Founders and their work ---------- */

export const PATHWAYS = ['medical_device', 'therapeutics', 'health_saas', 'diagnostics_samd', 'service_delivery', 'integrated'] as const
export type Pathway = (typeof PATHWAYS)[number]
export const PATHWAY_LABEL: Record<Pathway, string> = {
  medical_device: 'Medical device',
  therapeutics: 'Therapeutics',
  health_saas: 'Health SaaS',
  diagnostics_samd: 'Diagnostics / SaMD',
  service_delivery: 'Service delivery',
  integrated: 'Integrated',
}

/** A founder's place in a cohort. Founders in the same venture are assessed individually. */
export type Founder = {
  cohortId: string
  chiiId: string
  ventureId?: string
  pathway?: Pathway
  status: 'enrolled' | 'withdrawn'
  /** Extra questions (flexible fields). */
  originalIdea?: string
  ideaChanged?: boolean
  ideaChangedWhy?: string
  stakeholders?: number
  observationType?: 'real' | 'simulated' | 'anonymised case'
  permissionsRecorded?: boolean
  joinedOn: string
}

export type ResultSource = 'canvas' | 'staff' | 'import'

/** One founder's result for one assessment in one cohort. */
export type Result = {
  id: string
  cohortId: string
  code: string
  chiiId: string
  submittedAt?: string
  dueAt?: string
  /** Rubric scores by criterion index (1–scaleMax). */
  scores: Record<number, number>
  /** Quiz or survey score. */
  score?: number
  source: ResultSource
  reviewer?: string
  canvasSubmissionId?: string
}

export type Exemption = {
  id: string
  cohortId: string
  chiiId: string
  moduleCode: string
  requestedOn: string
  /** Staff-only. */
  evidence: string
  decision: 'pending' | 'approved' | 'declined'
  decidedBy?: string
  decidedOn?: string
}

export type GateChoice = 'build' | 'more_ideation' | 'other_pathway' | 'withdrawn'
export const GATE_LABEL: Record<GateChoice, string> = { build: 'Build', more_ideation: 'More ideation', other_pathway: 'Another pathway', withdrawn: 'Withdrawn' }

export type GateDecision = {
  id: string
  cohortId: string
  ventureId?: string
  /** The lead founder. */
  chiiId: string
  gate: 'ebi_evidence'
  decision: GateChoice
  score?: number
  decidedBy: string
  decidedOn: string
  nextCohortId?: string
  /** Staff-only. */
  notes: string
}

/** One founder's end-of-module feedback: one per founder per module. */
export type ModuleFeedback = { id: string; cohortId: string; chiiId: string; moduleCode: string; rating: number; comment: string; at: string }

/* ---------- Canvas ---------- */

export type CanvasUser = { canvasId: string; name: string; email: string }
export type SyncRun = { id: string; cohortId: string; startedAt: string; finishedAt: string; status: 'ok' | 'failed'; read: number; written: number; unmatched: number; by: string; error?: string }

export type CanvasState = {
  /** Canvas assignment / quiz ID → assessment code, per cohort. */
  mapping: Record<string, Record<string, string>>
  /** Canvas user ID → CHII ID. The CHII ID is never written to Canvas. */
  links: Record<string, { chiiId: string; matchedBy: 'email' | 'staff'; at: string }>
  /** Canvas users the last sync couldn't match, per cohort. */
  unmatched: Record<string, CanvasUser[]>
  runs: SyncRun[]
}

/** Status history: every exemption and gate decision, and other changes. */
export type IncLog = { id: string; at: string; by: string; cohortId?: string; action: string; detail: string }

export type IncubationData = {
  curriculum: Curriculum
  cohorts: Cohort[]
  sessions: ClassSession[]
  founders: Founder[]
  results: Result[]
  exemptions: Exemption[]
  gate: GateDecision[]
  feedback: ModuleFeedback[]
  canvas: CanvasState
  log: IncLog[]
}
