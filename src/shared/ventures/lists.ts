/**
 * Controlled lists, countries and regions, exchange rates and the field dictionary
 * (VENTURE-REGISTRY-SPEC §2, §9). Lists marked "provisional" wait for MELA to confirm.
 */
import type { AuRegion, FundingType, LegalStatus, Stage, VentureStatus } from './types'

export const STAGES: Stage[] = ['Expose', 'Build', 'Scale']
export const STATUSES: VentureStatus[] = ['Active', 'Paused', 'Pivoted', 'Acquired', 'Closed']
/** MELA: only Active counts as active, and as still operating (for survival). */
export const isActive = (s: VentureStatus) => s === 'Active'
export const LEGAL_STATUSES: LegalStatus[] = ['Registered', 'Informal', 'In progress']

/** Provisional (spec §9). */
export const HEALTH_SECTORS = [
  'Digital health',
  'Diagnostics',
  'Pharma & supply chain',
  'Primary care',
  'Maternal & child health',
  'Mental health',
  'Nutrition',
  'Health financing',
  'Medical devices',
  'Other',
]
/** Provisional (spec §9). */
export const SOURCES = ['Hackathon', 'Masterclass', 'Venture Funding', 'Mentorship', 'Referral', 'Open call', 'Other']
/** Provisional: MELA to confirm the CHII programme tracks. */
export const TRACKS = ['Incubation', 'Acceleration', 'Venture Funding', 'Alumni']
export const FUNDING_TYPES: { key: FundingType; label: string }[] = [
  { key: 'grant', label: 'Grant' },
  { key: 'equity', label: 'Equity' },
  { key: 'debt', label: 'Debt' },
  { key: 'prize', label: 'Prize' },
  { key: 'revenue_based', label: 'Revenue-based' },
  { key: 'other', label: 'Other' },
]
export const INSTITUTIONS = ['ALU', 'ALCHE', 'ALX', 'Other']

/* ---------- Countries and African Union regions ---------- */

const AU: Record<Exclude<AuRegion, 'Outside Africa'>, [string, string][]> = {
  'Central Africa': [['BI', 'Burundi'], ['CM', 'Cameroon'], ['CF', 'Central African Republic'], ['TD', 'Chad'], ['CG', 'Congo'], ['CD', 'DR Congo'], ['GQ', 'Equatorial Guinea'], ['GA', 'Gabon'], ['ST', 'São Tomé and Príncipe']],
  'East Africa': [['KM', 'Comoros'], ['DJ', 'Djibouti'], ['ER', 'Eritrea'], ['ET', 'Ethiopia'], ['KE', 'Kenya'], ['MG', 'Madagascar'], ['MU', 'Mauritius'], ['RW', 'Rwanda'], ['SC', 'Seychelles'], ['SO', 'Somalia'], ['SS', 'South Sudan'], ['SD', 'Sudan'], ['TZ', 'Tanzania'], ['UG', 'Uganda']],
  'North Africa': [['DZ', 'Algeria'], ['EG', 'Egypt'], ['LY', 'Libya'], ['MR', 'Mauritania'], ['MA', 'Morocco'], ['TN', 'Tunisia']],
  'Southern Africa': [['AO', 'Angola'], ['BW', 'Botswana'], ['SZ', 'Eswatini'], ['LS', 'Lesotho'], ['MW', 'Malawi'], ['MZ', 'Mozambique'], ['NA', 'Namibia'], ['ZA', 'South Africa'], ['ZM', 'Zambia'], ['ZW', 'Zimbabwe']],
  'West Africa': [['BJ', 'Benin'], ['BF', 'Burkina Faso'], ['CV', 'Cabo Verde'], ['CI', "Côte d'Ivoire"], ['GM', 'The Gambia'], ['GH', 'Ghana'], ['GN', 'Guinea'], ['GW', 'Guinea-Bissau'], ['LR', 'Liberia'], ['ML', 'Mali'], ['NE', 'Niger'], ['NG', 'Nigeria'], ['SN', 'Senegal'], ['SL', 'Sierra Leone'], ['TG', 'Togo']],
}
const OUTSIDE: [string, string][] = [['GB', 'United Kingdom'], ['US', 'United States'], ['AE', 'United Arab Emirates'], ['IN', 'India'], ['FR', 'France'], ['DE', 'Germany'], ['CA', 'Canada']]

export type Country = { code: string; name: string; region: AuRegion }
export const COUNTRIES: Country[] = [
  ...(Object.entries(AU) as [Exclude<AuRegion, 'Outside Africa'>, [string, string][]][]).flatMap(([region, list]) => list.map(([code, name]) => ({ code, name, region }))),
  ...OUTSIDE.map(([code, name]) => ({ code, name, region: 'Outside Africa' as const })),
].sort((a, b) => a.name.localeCompare(b.name))

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]))
export const countryName = (code: string) => byCode.get(code)?.name ?? code
/** Region is derived from the country of operation and is read-only (spec §2). */
export const regionOf = (code: string | undefined): AuRegion | null => (code ? (byCode.get(code)?.region ?? 'Outside Africa') : null)
export const countryCodeFor = (name: string) => COUNTRIES.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())?.code ?? null

/* ---------- Money ---------- */

/**
 * USD per unit. Provisional fixed rates: MELA to choose the exchange-rate source (spec §9).
 * A server version would look up the rate on the update's date.
 */
export const USD_RATES: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, KES: 0.0077, NGN: 0.00065, RWF: 0.00071, GHS: 0.064, UGX: 0.00027, TZS: 0.00037, ZAR: 0.055, XOF: 0.0016, ETB: 0.0082 }
export const CURRENCIES = Object.keys(USD_RATES)
export const toUsd = (amount: number, currency: string) => Math.round(amount * (USD_RATES[currency] ?? NaN))

/* ---------- Field dictionary (spec §2): keys used by workbooks, reports and imports ---------- */

export type FieldDef = {
  key: string
  label: string
  group: 'Venture details' | 'Founder details' | 'Stage and status' | 'Outcomes'
  type: 'text' | 'longtext' | 'number' | 'year' | 'boolean' | 'list' | 'country' | 'money' | 'derived'
  required?: boolean
  /** Identity data: only staff with access to restricted data see it. */
  restricted?: boolean
  list?: readonly string[]
}

export const FIELD_DICTIONARY: FieldDef[] = [
  { key: 'venture_code', label: 'Venture ID', group: 'Venture details', type: 'derived' },
  { key: 'legacy_id', label: 'Old Venture ID', group: 'Venture details', type: 'text' },
  { key: 'venture_name', label: 'Venture Name', group: 'Venture details', type: 'text', required: true },
  { key: 'description', label: 'Description', group: 'Venture details', type: 'longtext' },
  { key: 'region', label: 'Region', group: 'Venture details', type: 'derived' },
  { key: 'country_of_operation', label: 'Country of Operation', group: 'Venture details', type: 'country', required: true },
  { key: 'health_sector', label: 'Health Sector', group: 'Venture details', type: 'list', required: true, list: HEALTH_SECTORS },
  { key: 'source', label: 'Source', group: 'Venture details', type: 'list', list: SOURCES },
  { key: 'year_founded', label: 'Year Founded', group: 'Venture details', type: 'year' },
  { key: 'intake_year', label: 'Intake Year', group: 'Venture details', type: 'year', required: true },
  { key: 'institution', label: 'Institution', group: 'Venture details', type: 'list', list: INSTITUTIONS },
  { key: 'founder_name', label: 'Founder Name', group: 'Founder details', type: 'text', restricted: true },
  { key: 'founder_email', label: 'Founder Email', group: 'Founder details', type: 'text', restricted: true },
  { key: 'track', label: 'Track', group: 'Founder details', type: 'list', list: TRACKS },
  { key: 'stage', label: 'Stage', group: 'Stage and status', type: 'list', required: true, list: STAGES },
  { key: 'current_status', label: 'Current Status', group: 'Stage and status', type: 'list', required: true, list: STATUSES },
  { key: 'legal_status', label: 'Legal Status', group: 'Stage and status', type: 'list', list: LEGAL_STATUSES },
  { key: 'in_accelerator', label: 'In an Accelerator?', group: 'Stage and status', type: 'boolean' },
  { key: 'youth_led', label: 'Youth-Led?', group: 'Stage and status', type: 'boolean' },
  { key: 'women_led', label: 'Women-Led?', group: 'Stage and status', type: 'boolean' },
  { key: 'pwd_led', label: 'PWD-Led?', group: 'Stage and status', type: 'boolean' },
  { key: 'cofounders_count', label: 'Co-Founders (#)', group: 'Stage and status', type: 'number' },
  { key: 'cofounders_female_count', label: 'Co-Founders Female (#)', group: 'Stage and status', type: 'number' },
  { key: 'jobs_total', label: 'Total Jobs Created', group: 'Outcomes', type: 'number' },
  { key: 'jobs_women', label: 'Women Jobs Created', group: 'Outcomes', type: 'number' },
  { key: 'jobs_pwd', label: 'PWD Jobs Created', group: 'Outcomes', type: 'number' },
  { key: 'jobs_displaced', label: 'Displaced Persons Jobs', group: 'Outcomes', type: 'number' },
  { key: 'funding_raised', label: 'Funding Raised', group: 'Outcomes', type: 'money' },
  { key: 'revenue', label: 'Revenue (last 12 months)', group: 'Outcomes', type: 'money' },
]

/** Youth-led age limit (MELA to confirm; spec suggests 35). */
export const YOUTH_MAX_AGE = 35
