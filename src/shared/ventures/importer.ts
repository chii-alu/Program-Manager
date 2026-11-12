/**
 * Import of the existing HENT venture sheet (VENTURE-REGISTRY-SPEC §3 Import, build step 4).
 *
 *   1. Read the sheet (XLSX, CSV, or rows pasted from a spreadsheet). It has a group header row
 *      (Venture Details / Founder Details / …) above the real column names.
 *   2. Match columns to field-dictionary keys (§2). The mapping is saved for next time.
 *   3. Dry run: every row is checked and labelled new / already in the registry / blocked, and the
 *      founder is matched to a CHII ID or marked as new. Nothing is written.
 *   4. Import: new, valid rows become ventures; each row is stored as the venture's baseline.
 *
 * Importing the same sheet twice adds nothing the second time: rows are matched on the old
 * Venture ID (kept as legacy_id) and on the name, and founders on their email.
 */
import { REPORTING_DATE } from './derive'
import { CURRENCIES, HEALTH_SECTORS, INSTITUTIONS, SOURCES, TRACKS, YOUTH_MAX_AGE, countryCodeFor, regionOf } from './lists'
import { ageOn, personById, resolveBeneficiary } from './people'
import { similar, validateUpdate } from './quality'
import { createVenture, type UpdateInput, type VentureInput } from './store'
import type { LegalStatus, RegistryData, Stage, VentureStatus } from './types'

/* ---------- 1. Reading ---------- */

/** Parse CSV or tab-separated text, with quoted cells that may contain commas, tabs or new lines. */
export function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const sep = firstLine.includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === sep) row.push(cell), (cell = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell), rows.push(row), (row = []), (cell = '')
    } else cell += c
  }
  if (cell !== '' || row.length) row.push(cell), rows.push(row)
  return rows
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const isBlankRow = (r: string[]) => r.every((c) => !String(c ?? '').trim())

/* ---------- 2. Column matching ---------- */

export type ImportField =
  | 'legacy_id'
  | 'venture_name'
  | 'description'
  | 'region'
  | 'country_of_operation'
  | 'health_sector'
  | 'source'
  | 'year_founded'
  | 'intake_year'
  | 'institution'
  | 'founder_name'
  | 'founder_email'
  | 'founder_phone'
  | 'track'
  | 'stage'
  | 'current_status'
  | 'legal_status'
  | 'in_accelerator'
  | 'youth_led'
  | 'women_led'
  | 'cofounders_count'
  | 'cofounders_female_count'
  | 'jobs_total'
  | 'jobs_women'
  | 'jobs_pwd'
  | 'jobs_displaced'
  | 'funding_raised'
  | 'revenue'

export const IMPORT_FIELDS: { key: ImportField; label: string; required?: boolean; synonyms: string[] }[] = [
  { key: 'legacy_id', label: 'Old Venture ID', synonyms: ['ventureid', 'id', 'ventureno', 'venturenumber'] },
  { key: 'venture_name', label: 'Venture name', required: true, synonyms: ['venturename', 'name', 'venture'] },
  { key: 'description', label: 'Description', synonyms: ['description', 'summary'] },
  { key: 'region', label: 'Region (checked, not stored)', synonyms: ['region'] },
  { key: 'country_of_operation', label: 'Country of operation', required: true, synonyms: ['countryofoperation', 'country', 'countries'] },
  { key: 'health_sector', label: 'Health sector', required: true, synonyms: ['healthsector', 'sector'] },
  { key: 'source', label: 'Source', synonyms: ['source'] },
  { key: 'year_founded', label: 'Year founded', synonyms: ['yearfounded', 'founded', 'foundingyear'] },
  { key: 'intake_year', label: 'Intake year', synonyms: ['intakeyear', 'cohort', 'cohortyear', 'yearjoined'] },
  { key: 'institution', label: 'Institution', synonyms: ['institution', 'instituition', 'organisation', 'organization'] },
  { key: 'founder_name', label: 'Lead founder name', synonyms: ['foundername', 'leadfounder', 'founder', 'leadfoundername'] },
  { key: 'founder_email', label: 'Lead founder email', synonyms: ['founderemail', 'email', 'leadfounderemail'] },
  { key: 'founder_phone', label: 'Lead founder phone', synonyms: ['founderphone', 'phone'] },
  { key: 'track', label: 'Track', synonyms: ['track'] },
  { key: 'stage', label: 'Stage', required: true, synonyms: ['stage'] },
  { key: 'current_status', label: 'Current status', required: true, synonyms: ['currentstatus', 'status'] },
  { key: 'legal_status', label: 'Legal status', synonyms: ['legalstatus'] },
  { key: 'in_accelerator', label: 'In an accelerator?', synonyms: ['inaccelerator', 'accelerator'] },
  { key: 'youth_led', label: 'Youth-led?', synonyms: ['youthled'] },
  { key: 'women_led', label: 'Women-led?', synonyms: ['womenled', 'femaleled'] },
  { key: 'cofounders_count', label: 'Co-founders (#)', synonyms: ['cofoundersyes', 'cofounders', 'numberofcofounders', 'cofoundersno'] },
  { key: 'cofounders_female_count', label: 'Co-founders female (#)', synonyms: ['cofoundersfemale', 'femalecofounders'] },
  { key: 'jobs_total', label: 'Total jobs', synonyms: ['totaljobscreated', 'totaljobs', 'jobscreated', 'jobs'] },
  { key: 'jobs_women', label: 'Women jobs', synonyms: ['womenjobscreated', 'womenjobs'] },
  { key: 'jobs_pwd', label: 'PWD jobs', synonyms: ['pwdjobscreated', 'pwdjobs'] },
  { key: 'jobs_displaced', label: 'Displaced persons jobs', synonyms: ['displacedpersonsjobs', 'displacedjobs', 'displacedpersonsjobscreated'] },
  { key: 'funding_raised', label: 'Funding raised', synonyms: ['fundingraised', 'funding', 'totalfundingraised'] },
  { key: 'revenue', label: 'Revenue (last 12 months)', synonyms: ['revenue', 'revenuelast12months', 'annualrevenue'] },
]

export type Mapping = (ImportField | null)[]

/** The row with the column names: the first one with a "Venture Name" cell (skips the group row above). */
export function findHeaderRow(rows: string[][]): number {
  const i = rows.findIndex((r) => r.some((c) => ['venturename', 'venture'].includes(norm(String(c ?? '').split(/\r?\n/)[0]))))
  return i < 0 ? 0 : i
}

/** Match each heading to a field: the whole heading first ("Co-Founders Female#"), then its first line ("Legal Status"). */
export function autoMap(headers: string[]): Mapping {
  const taken = new Set<ImportField>()
  const find = (key: string) => IMPORT_FIELDS.find((f) => f.synonyms.includes(key) && !taken.has(f.key))?.key ?? null
  return headers.map((h) => {
    const text = String(h ?? '')
    const hit = find(norm(text)) ?? find(norm(text.split(/\r?\n/)[0]))
    if (hit) taken.add(hit)
    return hit
  })
}

const MAP_KEY = 'mela-venture-import-mapping'
const signature = (headers: string[]) => headers.map((h) => norm(String(h ?? ''))).join('|')
export function loadSavedMapping(headers: string[]): Mapping | null {
  try {
    const all = JSON.parse(localStorage.getItem(MAP_KEY) || '{}') as Record<string, Mapping>
    return all[signature(headers)] ?? null
  } catch {
    return null
  }
}
export function saveMapping(headers: string[], mapping: Mapping) {
  try {
    const all = JSON.parse(localStorage.getItem(MAP_KEY) || '{}') as Record<string, Mapping>
    localStorage.setItem(MAP_KEY, JSON.stringify({ ...all, [signature(headers)]: mapping }))
  } catch {
    /* the mapping is a convenience; matching runs again next time */
  }
}

/* ---------- Cell parsing ---------- */

/** "$12,000", "KES 1,300,000", "12000 USD", "15k", "" → amount and currency (default USD). */
export function parseMoney(raw: string, fallback = 'USD'): { amount: number; currency: string } | null {
  const s = String(raw ?? '').trim()
  if (!s || s === '-' || s === '—') return { amount: 0, currency: fallback }
  const code = s.match(/[A-Za-z]{3}/)?.[0]?.toUpperCase()
  const currency = s.includes('$') ? 'USD' : s.includes('€') ? 'EUR' : s.includes('£') ? 'GBP' : code && CURRENCIES.includes(code) ? code : fallback
  const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?\s*([kKmM])?/)
  if (!m) return null
  const n = Number(m[0].replace(/[kKmM]/, '').trim()) * (/[kK]/.test(m[2] ?? '') ? 1000 : /[mM]/.test(m[2] ?? '') ? 1_000_000 : 1)
  return Number.isFinite(n) ? { amount: Math.round(n), currency } : null
}

const yesNo = (raw: string): boolean | null => {
  const n = norm(String(raw ?? ''))
  return ['yes', 'y', 'true', '1'].includes(n) ? true : ['no', 'n', 'false', '0'].includes(n) ? false : null
}
const int = (raw: string): number | null => {
  const s = String(raw ?? '').replace(/,/g, '').trim()
  if (!s) return 0
  const n = Number(s)
  return Number.isInteger(n) ? n : null
}
const pickFrom = (list: readonly string[], raw: string) => list.find((x) => norm(x) === norm(raw)) ?? null

const STAGE_WORDS: Record<string, Stage> = { expose: 'Expose', build: 'Build', scale: 'Scale' }
/** Older stage names (as on the CHII dashboard) and what MELA groups them under. */
const OLD_STAGES: Record<string, Stage> = { idea: 'Expose', ideation: 'Expose', validation: 'Expose', prototype: 'Build', prototypemvp: 'Build', mvp: 'Build', earlygrowth: 'Build', earlyrevenue: 'Build', growth: 'Scale', scaling: 'Scale', investmentfunding: 'Scale' }
const STATUS_WORDS: Record<string, VentureStatus> = { active: 'Active', paused: 'Paused', pivoted: 'Pivoted', acquired: 'Acquired', closed: 'Closed' }
const OLD_STATUS: Record<string, VentureStatus> = { stalled: 'Paused', dormant: 'Paused', inactive: 'Paused', growing: 'Active', shutdown: 'Closed', dissolved: 'Closed' }
const LEGAL_WORDS: Record<string, LegalStatus> = { registered: 'Registered', reg: 'Registered', informal: 'Informal', inprogress: 'In progress', pending: 'In progress', ongoing: 'In progress' }

/* ---------- 3. Dry run ---------- */

export type ImportSettings = { intakeYear: number; asOf: string; by: string }

export type PlannedRow = {
  /** Row number in the sheet (1-based, as a spreadsheet shows it). */
  line: number
  name: string
  legacyId: string
  outcome: 'new' | 'existing' | 'blocked'
  /** For "existing": the registry venture it matched. */
  existingCode?: string
  errors: string[]
  warnings: string[]
  founder: { status: 'matched' | 'new' | 'none'; chiiId?: string; matchedOn?: string; name?: string }
  venture?: VentureInput
  baseline?: UpdateInput
  founderInput?: { name: string; email?: string; phone?: string }
}

export type ImportPlan = { headerRow: number; rows: PlannedRow[]; counts: { new: number; existing: number; blocked: number; warnings: number; foundersMatched: number; foundersNew: number } }

export function planImport(rows: string[][], headerRow: number, mapping: Mapping, settings: ImportSettings, d: RegistryData): ImportPlan {
  const col = (k: ImportField) => mapping.indexOf(k)
  const get = (r: string[], k: ImportField) => {
    const i = col(k)
    return i < 0 ? '' : String(r[i] ?? '').trim()
  }
  const seenNames = new Map<string, number>()
  const seenEmails = new Map<string, number>()
  const out: PlannedRow[] = []

  rows.slice(headerRow + 1).forEach((r, k) => {
    if (isBlankRow(r)) return
    const line = headerRow + 2 + k
    const errors: string[] = []
    const warnings: string[] = []
    const name = get(r, 'venture_name')
    const legacyId = get(r, 'legacy_id')

    // Already in the registry? Old Venture ID first, then the name.
    const existing = (legacyId && d.ventures.find((v) => v.legacyId && norm(v.legacyId) === norm(legacyId))) || (name && d.ventures.find((v) => v.name.trim().toLowerCase() === name.toLowerCase()))
    if (existing) {
      out.push({ line, name: name || existing.name, legacyId, outcome: 'existing', existingCode: existing.code, errors: [], warnings: [], founder: { status: 'none' } })
      return
    }

    if (!name) errors.push('No venture name.')
    const dupRow = name ? seenNames.get(name.toLowerCase()) : undefined
    if (dupRow) errors.push(`Same venture name as row ${dupRow}.`)
    if (name) seenNames.set(name.toLowerCase(), line)

    // Countries: "Kenya, Uganda" → KE (primary), UG.
    const countryCells = get(r, 'country_of_operation').split(/[,;/]|\band\b/).map((c) => c.trim()).filter(Boolean)
    const countries = countryCells.map((c) => countryCodeFor(c))
    countryCells.forEach((c, i) => !countries[i] && errors.push(`Country “${c}” isn’t recognised. Use the full country name, e.g. “Côte d'Ivoire”.`))
    const codes = countries.filter((c): c is string => !!c)
    if (!countryCells.length) errors.push('No country of operation.')
    const region = get(r, 'region')
    if (region && codes[0] && norm(region) !== norm(regionOf(codes[0])!) && norm(region) !== norm(regionOf(codes[0])!.replace(' Africa', '')))
      warnings.push(`The sheet says region “${region}”, but ${countryCells[0]} is in ${regionOf(codes[0])}. The region comes from the country.`)

    // Controlled lists.
    const sectorRaw = get(r, 'health_sector')
    let sector = pickFrom(HEALTH_SECTORS, sectorRaw)
    if (!sectorRaw) errors.push('No health sector.')
    else if (!sector) (sector = 'Other'), warnings.push(`Health sector “${sectorRaw}” isn’t on the list, so it’s recorded as Other.`)
    const sourceRaw = get(r, 'source')
    const source = pickFrom(SOURCES, sourceRaw) ?? (sourceRaw ? 'Other' : 'Other')
    if (sourceRaw && !pickFrom(SOURCES, sourceRaw)) warnings.push(`Source “${sourceRaw}” isn’t on the list, so it’s recorded as Other.`)
    const trackRaw = get(r, 'track')
    const track = pickFrom(TRACKS, trackRaw) ?? trackRaw
    if (trackRaw && !pickFrom(TRACKS, trackRaw)) warnings.push(`Track “${trackRaw}” isn’t on the provisional list. It’s kept as written.`)
    const instRaw = get(r, 'institution')
    const institution = pickFrom(INSTITUTIONS, instRaw) ?? (instRaw || 'Other')

    const stageRaw = get(r, 'stage')
    let stage: Stage | null = STAGE_WORDS[norm(stageRaw)] ?? null
    if (!stage && OLD_STAGES[norm(stageRaw)]) (stage = OLD_STAGES[norm(stageRaw)]), warnings.push(`Stage “${stageRaw}” is recorded as ${stage}.`)
    if (!stage) errors.push(stageRaw ? `Stage “${stageRaw}” isn’t Expose, Build or Scale.` : 'No stage.')
    const statusRaw = get(r, 'current_status')
    let status: VentureStatus | null = STATUS_WORDS[norm(statusRaw)] ?? null
    if (!status && OLD_STATUS[norm(statusRaw)]) (status = OLD_STATUS[norm(statusRaw)]), warnings.push(`Status “${statusRaw}” is recorded as ${status}.`)
    if (!status) errors.push(statusRaw ? `Status “${statusRaw}” isn’t Active, Paused, Pivoted, Acquired or Closed.` : 'No current status.')
    const legalRaw = get(r, 'legal_status')
    const legal: LegalStatus = LEGAL_WORDS[norm(legalRaw)] ?? 'Informal'
    if (legalRaw && !LEGAL_WORDS[norm(legalRaw)]) warnings.push(`Legal status “${legalRaw}” isn’t recognised, so it’s recorded as Informal.`)

    // Years.
    const intakeCell = get(r, 'intake_year')
    const intakeYear = intakeCell ? Number(intakeCell) : settings.intakeYear
    const foundedCell = get(r, 'year_founded')
    const yearFounded = foundedCell ? Number(foundedCell) : NaN
    if (!foundedCell) warnings.push(`No year founded: the intake year (${intakeYear}) is used.`)
    else if (!Number.isInteger(yearFounded) || yearFounded < 1990 || yearFounded > Number(REPORTING_DATE.slice(0, 4))) errors.push(`Year founded “${foundedCell}” must be between 1990 and ${REPORTING_DATE.slice(0, 4)}.`)

    // Numbers.
    const num = (k: ImportField, label: string) => {
      const n = int(get(r, k))
      if (n == null || n < 0) errors.push(`${label} “${get(r, k)}” must be a whole number, 0 or more.`)
      return n ?? 0
    }
    const jobsTotal = num('jobs_total', 'Total jobs')
    const jobsWomen = num('jobs_women', 'Women jobs')
    const jobsPwd = num('jobs_pwd', 'PWD jobs')
    const jobsDisplaced = num('jobs_displaced', 'Displaced persons jobs')
    const coCell = get(r, 'cofounders_count')
    const coFemaleCell = get(r, 'cofounders_female_count')
    const cofoundersCount = coCell ? int(coCell) : null
    const cofoundersFemaleCount = coFemaleCell ? int(coFemaleCell) : null
    if (coCell && cofoundersCount == null) errors.push(`Co-founders “${coCell}” must be a whole number.`)
    const money = parseMoney(get(r, 'funding_raised'))
    if (!money) errors.push(`Funding raised “${get(r, 'funding_raised')}” isn’t an amount.`)
    const rev = get(r, 'revenue') ? parseMoney(get(r, 'revenue')) : null

    const baseline: UpdateInput = {
      asOf: settings.asOf,
      stage: stage ?? 'Expose',
      status: status ?? 'Active',
      cofoundersCount,
      cofoundersFemaleCount,
      jobsTotal,
      jobsWomen,
      jobsPwd,
      jobsDisplaced,
      fundingAmount: money?.amount ?? 0,
      fundingCurrency: money?.currency ?? 'USD',
      revenueAmount: rev?.amount ?? null,
      revenueCurrency: rev ? rev.currency : null,
      notes: `Imported from the venture sheet, row ${line}${legacyId ? ` (${legacyId})` : ''}.`,
    }
    for (const m of validateUpdate(baseline)) if (!errors.some((e) => e.startsWith(m.split(' ')[0]))) errors.push(m)

    // Founder: matched to an existing CHII ID by email or phone, or a new one at import.
    const fName = get(r, 'founder_name')
    const fEmail = get(r, 'founder_email')
    const fPhone = get(r, 'founder_phone')
    let founder: PlannedRow['founder'] = { status: 'none' }
    if (fEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fEmail)) errors.push(`Founder email “${fEmail}” doesn’t look like an email address.`)
    else if (fEmail || fPhone) {
      const match = resolveBeneficiary({ name: fName, email: fEmail, phone: fPhone }, { create: false })
      founder = match.chiiId ? { status: 'matched', chiiId: match.chiiId, matchedOn: match.matchedOn ?? undefined, name: fName } : { status: 'new', name: fName }
      if (!fName && !match.chiiId) errors.push('The founder has an email but no name.')
      const dup = seenEmails.get(fEmail.toLowerCase())
      if (fEmail && dup) warnings.push(`The same founder email is on row ${dup}. They’ll be one person (one CHII ID) founding both ventures.`)
      if (fEmail) seenEmails.set(fEmail.toLowerCase(), line)
    } else if (fName) warnings.push(`No email or phone for ${fName}, so they can’t be matched to a CHII ID. The venture is imported without a founder; add them later.`)
    else warnings.push('No founder given. Add the founders later.')

    // Youth-led / women-led: kept as manual values only when they differ from what the founders give.
    const lead = founder.chiiId ? personById(founder.chiiId) : null
    const leadAge = lead ? ageOn(lead.dob, settings.asOf) : null
    const derivedYouth = leadAge == null ? null : leadAge <= YOUTH_MAX_AGE
    const derivedWomen = lead?.gender === 'F' || (cofoundersFemaleCount ?? 0) > 0 ? true : lead && lead.gender !== 'X' && cofoundersFemaleCount === 0 ? false : null
    const sheetYouth = yesNo(get(r, 'youth_led'))
    const sheetWomen = yesNo(get(r, 'women_led'))
    const override = (sheet: boolean | null, derived: boolean | null, label: string) => {
      if (sheet == null) return null
      if (derived == null) return sheet
      if (sheet === derived) return null
      warnings.push(`The sheet says ${label} “${sheet ? 'Yes' : 'No'}”, but the founders’ data says ${derived ? 'Yes' : 'No'}. Kept as a manual value and flagged for checking.`)
      return sheet
    }
    const youthLedOverride = override(sheetYouth, derivedYouth, 'youth-led')
    const womenLedOverride = override(sheetWomen, derivedWomen, 'women-led')

    // Possible duplicate of a venture already in the registry (similar name, same country).
    const prim = new Map(d.countries.filter((c) => c.isPrimary).map((c) => [c.ventureId, c.countryCode]))
    const lookalike = name && codes[0] ? d.ventures.find((v) => prim.get(v.id) === codes[0] && similar(v.name, name)) : undefined
    if (lookalike) warnings.push(`Looks like ${lookalike.name} (${lookalike.code}) already in the registry. It will be imported as a new venture and flagged as a possible duplicate.`)

    const description = get(r, 'description')
    if (description.length > 200) errors.push(`The description is ${description.length} characters. Keep it to 200.`)

    const venture: VentureInput = {
      legacyId: legacyId || undefined,
      name,
      description,
      healthSector: sector ?? 'Other',
      source,
      yearFounded: Number.isInteger(yearFounded) ? yearFounded : intakeYear,
      intakeYear,
      institution,
      track,
      legalStatus: legal,
      inAccelerator: yesNo(get(r, 'in_accelerator')) ?? false,
      youthLedOverride,
      womenLedOverride,
      pwdLedOverride: null,
      countries: codes,
    }
    out.push({
      line,
      name,
      legacyId,
      outcome: errors.length ? 'blocked' : 'new',
      errors,
      warnings,
      founder,
      venture,
      baseline,
      founderInput: fEmail || fPhone ? { name: fName || lead?.name || '', email: fEmail || undefined, phone: fPhone || undefined } : undefined,
    })
  })

  const counts = {
    new: out.filter((r) => r.outcome === 'new').length,
    existing: out.filter((r) => r.outcome === 'existing').length,
    blocked: out.filter((r) => r.outcome === 'blocked').length,
    warnings: out.filter((r) => r.outcome === 'new' && r.warnings.length).length,
    foundersMatched: out.filter((r) => r.outcome === 'new' && r.founder.status === 'matched').length,
    foundersNew: out.filter((r) => r.outcome === 'new' && r.founder.status === 'new').length,
  }
  return { headerRow, rows: out, counts }
}

/* ---------- 4. Import ---------- */

/** Import the rows the dry run marked "new". Rows that became duplicates since then are skipped. */
export function runImport(plan: ImportPlan, settings: ImportSettings) {
  const created: { line: number; code: string; id: string }[] = []
  const skipped: { line: number; reason: string }[] = []
  for (const r of plan.rows) {
    if (r.outcome !== 'new' || !r.venture || !r.baseline) continue
    try {
      const { venture } = createVenture(r.venture, r.founderInput ? [{ person: r.founderInput, role: 'lead_founder' }] : [], r.baseline, settings.by, 'import')
      created.push({ line: r.line, code: venture.code, id: venture.id })
    } catch (e) {
      skipped.push({ line: r.line, reason: e instanceof Error ? e.message : String(e) })
    }
  }
  return { created, skipped }
}

/* ---------- Sample sheet (for trying the importer) ---------- */

/** A small copy of the HENT venture sheet layout, with typical problems in it. */
export function sampleSheet(): string {
  const group = ['Venture Details', '', '', '', '', '', '', '', '', 'Founder Details', '', '', 'Stage & Status', '', '', '', '', '', '', 'Outcomes (Baseline)', '', '', '', '']
  const head = [
    'Venture ID', 'Venture Name', '"Description\nOne-line summary"', 'Region', 'Country of Operation', 'Health Sector', 'Source', 'Year Founded', 'Instituition', 'Founder Name', 'Founder Email', 'Track', 'Stage', 'Current Status',
    '"Legal Status\nReg./Informal/In Progress"', '"Youth-Led?\nYes/No"', '"Women-Led?\nYes/No"', '"Co-Founders\n Yes #"', '"Co-Founders\n Female#"', 'Total Jobs Created #', 'Women Jobs Created #', 'PWD Jobs Created #', '"Displaced Persons\nJobs #"', 'Funding Raised',
  ]
  const rows = [
    ['HV-101', 'AfyaLink', 'Last-mile medicine delivery', 'Southern Africa', 'South Africa', 'Nutrition', 'Venture Funding', '2023', 'ALU', 'Thabo Nkosi', 't.nkosi@outlook.com', 'Venture Funding', 'Expose', 'Active', 'In Progress', 'Yes', 'No', '0', '0', '4', '2', '0', '0', '$12,000'],
    ['HV-140', 'Kasi Clinic Connect', 'Booking for township clinics', 'East', 'Kenya, Uganda', 'Primary care', 'Masterclass', '2022', 'ALU', 'Kwame Asante', 'k.asante@alustudent.com', 'Incubation', 'Build', 'Active', 'Reg.', 'Yes', 'No', '1', '1', '9', '5', '1', '0', 'KES 1,300,000'],
    ['HV-141', 'MamaSafe Kits', 'Clean delivery kits for rural mothers', 'West', 'Ghana', 'Maternal & child health', 'Hackathon', '2024', 'ALCHE', 'Efua Mensah', 'efua.mensah@gmail.com', 'Incubation', 'Ideation', 'Active', 'Informal', 'Yes', 'Yes', '2', '1', '3', '2', '0', '0', '5000'],
    ['HV-142', 'TibaScan', 'Portable ultrasound on rent', 'East', 'Rwanda', 'Diagnostics', 'Open call', '2021', 'Other', 'Jean Bosco Habimana', 'jb.habimana@tibascan.rw', 'Acceleration', 'Scale', 'Stalled', 'Registered', 'No', 'No', '1', '0', '14', '6', '1', '2', '$85K'],
    ['HV-143', 'Akili Moyo', 'Peer mental health circles', 'East', 'Tanzania', 'Mental health', 'Mentorship', '2023', 'ALU', 'Neema Kileo', '', 'Alumni', 'Build', 'Active', 'Informal', 'Yes', 'Yes', '0', '0', '5', '4', '0', '1', '0'],
    ['HV-144', 'DawaLink Pharmacy', 'Stock alerts for pharmacies', 'West', 'Nigerria', 'Pharma & supply chain', 'Referral', '2022', 'ALU', 'Ifeoma Obi', 'ifeoma@dawalink.ng', 'Incubation', 'Build', 'Active', 'Registered', 'Yes', 'Yes', '1', '0', '7', '9', '0', '0', 'NGN 4,500,000'],
    ['HV-145', 'CareBridge Rehab', 'Home physiotherapy visits', 'Southern', 'Zambia', 'Rehabilitation', 'Open call', '2024', 'ALX', 'Mwila Banda', 'mwila.banda@gmail.com', 'Incubation', 'Expose', 'Active', 'Informal', 'Yes', 'No', '0', '0', '2', '1', '1', '0', ''],
    ['HV-146', 'Afya Link Ltd', 'Medicine delivery to clinics', 'Southern Africa', 'South Africa', 'Pharma & supply chain', 'Open call', '2024', 'Other', 'Sizwe Dlamini', 'sizwe@afyalinkltd.co.za', 'Incubation', 'Expose', 'Active', 'In Progress', 'Yes', 'No', '0', '0', '1', '0', '0', '0', '$0'],
    ['HV-147', 'MamaSafe Kits', 'Clean delivery kits (copy)', 'West', 'Ghana', 'Maternal & child health', 'Hackathon', '2024', 'ALCHE', 'Efua Mensah', 'efua.mensah@gmail.com', 'Incubation', 'Expose', 'Active', 'Informal', 'Yes', 'Yes', '2', '1', '3', '2', '0', '0', '5000'],
    ['HV-148', 'NutriKids Senegal', 'School nutrition tracking', 'West Africa', 'Senegal', 'Nutrition', 'Hackathon', '1985', 'ALU', 'Awa Diop', 'awa.diop@nutrikids.sn', 'Incubation', 'Expose', 'Active', 'Informal', 'Yes', 'Yes', '0', '0', '2', '2', '0', '0', '$3,000'],
  ]
  return [group, head, ...rows].map((r) => r.join('\t')).join('\n')
}
