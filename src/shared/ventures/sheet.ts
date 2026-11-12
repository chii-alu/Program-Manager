import { foundersOf, ventureLatest } from './derive'
import { countryName } from './lists'
import { personById } from './people'
import type { RegistryData } from './types'

export type SheetCol = { key: string; label: string; restricted?: boolean; numeric?: boolean; extra?: boolean }
export type SheetRow = Record<string, string | number>

/**
 * The HENT workbook's Ventures sheet (VENTURE-REGISTRY-SPEC §8 step 7): v_venture_latest, one row
 * per venture. De-identified by default: the lead founder's CHII ID, name and email are
 * restricted columns, shown to roles that see identity and downloaded only when included
 * (logged as a restricted export).
 */
export function buildVentures(d: RegistryData): { cols: SheetCol[]; rows: SheetRow[] } {
  const yn = (v: boolean | null) => (v == null ? '' : v ? 'Yes' : 'No')
  const rows: SheetRow[] = ventureLatest(d).map((v) => {
    const lead = foundersOf(d, v.ventureId).find((m) => m.role === 'lead_founder')
    const person = lead ? personById(lead.chiiId) : undefined
    return {
      code: v.code,
      name: v.name,
      country: v.country ? countryName(v.country) : '',
      region: v.region ?? '',
      sector: v.sector,
      source: v.source,
      institution: v.institution,
      track: v.track,
      intake: v.intakeYear,
      founded: v.yearFounded,
      stage: v.stage,
      status: v.status,
      legal: v.legalStatus,
      accelerator: v.inAccelerator ? 'Yes' : 'No',
      women: yn(v.womenLed),
      youth: yn(v.youthLed),
      pwd: yn(v.pwdLed),
      founders: v.founders,
      female: v.femaleFounders,
      jobs: v.jobsTotal,
      jobsWomen: v.jobsWomen,
      jobsPwd: v.jobsPwd,
      jobsDisplaced: v.jobsDisplaced,
      raised: v.fundingRaisedUsd,
      deployed: v.chiiFundingUsd,
      revenue: v.revenueUsd ?? '',
      latest: v.latestAsOf,
      baseline: v.baselineAsOf,
      leadId: lead?.chiiId ?? '',
      leadName: person?.name ?? '',
      leadEmail: person?.email ?? '',
      date: v.latestAsOf,
    }
  })
  return {
    cols: [
      { key: 'code', label: 'Venture ID' },
      { key: 'name', label: 'Venture name' },
      { key: 'country', label: 'Country of operation' },
      { key: 'region', label: 'Region' },
      { key: 'sector', label: 'Health sector' },
      { key: 'source', label: 'Source' },
      { key: 'institution', label: 'Institution' },
      { key: 'track', label: 'Track' },
      { key: 'intake', label: 'Intake year', numeric: true },
      { key: 'founded', label: 'Year founded', numeric: true },
      { key: 'stage', label: 'Stage' },
      { key: 'status', label: 'Current status' },
      { key: 'legal', label: 'Legal status' },
      { key: 'accelerator', label: 'In accelerator' },
      { key: 'women', label: 'Women-led' },
      { key: 'youth', label: 'Youth-led' },
      { key: 'pwd', label: 'PWD-led' },
      { key: 'founders', label: 'Founders', numeric: true },
      { key: 'female', label: 'Female founders', numeric: true },
      { key: 'jobs', label: 'Total jobs', numeric: true },
      { key: 'jobsWomen', label: 'Women jobs', numeric: true },
      { key: 'jobsPwd', label: 'PWD jobs', numeric: true },
      { key: 'jobsDisplaced', label: 'Displaced persons jobs', numeric: true },
      { key: 'raised', label: 'Funding raised (USD)', numeric: true },
      { key: 'deployed', label: 'CHII funding (USD)', numeric: true },
      { key: 'revenue', label: 'Revenue, 12 months (USD)', numeric: true },
      { key: 'latest', label: 'Latest update' },
      { key: 'baseline', label: 'Baseline date' },
      { key: 'leadId', label: 'Lead founder CHII ID', restricted: true },
      { key: 'leadName', label: 'Lead founder', restricted: true },
      { key: 'leadEmail', label: 'Lead founder email', restricted: true },
    ],
    rows,
  }
}
