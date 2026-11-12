/**
 * HENT Venture Registry: types (VENTURE-REGISTRY-SPEC §2, §6, reconciled in step 1).
 *
 * The prototype has no database, so each "table" is an array kept in browser storage (see
 * store.ts). The shapes follow the spec's tables, so a server version can reuse them as they are.
 *
 * Decisions from MELA (12 Nov 2026):
 *  - Women-led = at least one female founder (lead or co-founder).
 *  - Stages are Expose / Build / Scale. Only "Active" counts as active or still operating.
 *  - Ventures by Country counts all ventures. Trends are shown by intake year and by update date.
 *  - Revenue is recorded. "In an accelerator" is a yes/no field.
 *  - The registry becomes the source of venture numbers; the dashboard reads from it.
 */

export type Stage = 'Expose' | 'Build' | 'Scale'
export type VentureStatus = 'Active' | 'Paused' | 'Pivoted' | 'Acquired' | 'Closed'
export type LegalStatus = 'Registered' | 'Informal' | 'In progress'
export type MemberRole = 'lead_founder' | 'co_founder' | 'team'
export type UpdateType = 'baseline' | 'update'
export type UpdateSource = 'import' | 'staff' | 'founder_form' | 'survey'
export type FundingType = 'grant' | 'equity' | 'debt' | 'prize' | 'revenue_based' | 'other'
export type AuRegion = 'Central Africa' | 'East Africa' | 'North Africa' | 'Southern Africa' | 'West Africa' | 'Outside Africa'

/** `venture` */
export type Venture = {
  id: string
  /** VEN-0001: from a sequence, permanent, never reused. */
  code: string
  /** The ID the venture had in the old sheet, kept when imported. */
  legacyId?: string
  name: string
  /** One line, at most 200 characters. */
  description: string
  healthSector: string
  source: string
  /** The CHII cohort the venture came from, when it came from an intervention. */
  sourceCohortId?: string
  yearFounded: number
  /** Year the venture joined the CHII portfolio. Drives the dashboard's Year filter and cohort charts. */
  intakeYear: number
  /** Organisation, e.g. ALU. */
  institution: string
  track: string
  /** Current values: set from the latest accepted update. */
  stage: Stage
  currentStatus: VentureStatus
  legalStatus: LegalStatus
  inAccelerator: boolean
  /** Manual values. Null means "use the value derived from the founders". */
  youthLedOverride: boolean | null
  womenLedOverride: boolean | null
  pwdLedOverride: boolean | null
  createdAt: string
  updatedAt: string
}

/** `venture_country`: ISO 3166 alpha-2 codes. The primary country is the main one. */
export type VentureCountry = { ventureId: string; countryCode: string; isPrimary: boolean }

/** `venture_member`: every founder is a person with a CHII ID (via resolveBeneficiary). */
export type VentureMember = {
  id: string
  ventureId: string
  chiiId: string
  role: MemberRole
  isPrimary: boolean
  joinedOn: string
  leftOn: string | null
}

/** `venture_update`: the baseline and every later update. Nothing is overwritten. */
export type VentureUpdate = {
  id: string
  ventureId: string
  updateType: UpdateType
  /** ISO date the values describe. */
  asOf: string
  source: UpdateSource
  stage: Stage
  status: VentureStatus
  /** Entered only when founders aren't recorded; otherwise derived from venture_member. */
  cofoundersCount: number | null
  cofoundersFemaleCount: number | null
  jobsTotal: number
  jobsWomen: number
  jobsPwd: number
  jobsDisplaced: number
  /** External funding raised to date (cumulative), in the original currency and in USD. */
  fundingAmount: number
  fundingCurrency: string
  fundingUsd: number
  /** Revenue over the last 12 months to `asOf`. */
  revenueAmount: number | null
  revenueCurrency: string | null
  revenueUsd: number | null
  notes: string
  submittedBy: string
  /** Founder form updates wait here until staff accept them. */
  acceptedBy: string | null
  acceptedAt: string | null
}

/** `venture_funding`: detail of external funding (not CHII money). */
export type VentureFunding = {
  id: string
  ventureId: string
  asOf: string
  amount: number
  currency: string
  amountUsd: number
  fundingType: FundingType
  funder: string
}

/** `funding_award`: CHII Venture Funding awards. "Funding Deployed" is the sum of these. */
export type FundingAward = {
  id: string
  ventureId: string
  awardedOn: string
  amountUsd: number
  instrument: 'grant' | 'convertible' | 'equity' | 'prize'
  cohortId?: string
}

/** Audit trail for the venture page's History tab. */
export type VentureHistory = {
  id: string
  ventureId: string
  at: string
  by: string
  action: 'created' | 'edited' | 'founder_added' | 'founder_removed' | 'update_added' | 'update_accepted' | 'funding_added' | 'award_added'
  detail: string
}

/**
 * Restricted person record (beneficiary_identity / beneficiary_contact). Only the registry's
 * staff pages read names and emails; analytics only ever sees CHII IDs and derived flags.
 */
export type Person = {
  chiiId: string
  name: string
  email: string
  phone?: string
  studentId?: string
  gender: 'F' | 'M' | 'X'
  /** ISO date of birth, when known. */
  dob?: string
  disability?: boolean
}

export type RegistryData = {
  /** Last Venture ID number handed out. Never goes down, so codes are never reused. */
  seq: number
  ventures: Venture[]
  countries: VentureCountry[]
  members: VentureMember[]
  updates: VentureUpdate[]
  funding: VentureFunding[]
  awards: FundingAward[]
  history: VentureHistory[]
}
