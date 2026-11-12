import { beforeEach, describe, expect, it } from 'vitest'
import { deriveFlags } from './derive'
import { autoMap, findHeaderRow, parseDelimited, parseMoney, planImport, runImport, sampleSheet, type ImportSettings } from './importer'
import { toUsd } from './lists'
import { resetPeople } from './people'
import { getRegistry, resetRegistry } from './store'

beforeEach(() => {
  resetPeople()
  resetRegistry()
})

const settings: ImportSettings = { intakeYear: 2024, asOf: '2025-11-10', by: 'Test import' }
const plan = () => {
  const rows = parseDelimited(sampleSheet())
  const h = findHeaderRow(rows)
  return planImport(rows, h, autoMap(rows[h]), settings, getRegistry())
}
const row = (name: string, p = plan()) => p.rows.find((r) => r.name === name)!

describe('reading the HENT venture sheet', () => {
  it('skips the group header row and matches every column, including multi-line and misspelt headings', () => {
    const rows = parseDelimited(sampleSheet())
    const h = findHeaderRow(rows)
    expect(h).toBe(1)
    expect(rows[h][2]).toBe('Description\nOne-line summary')
    expect(autoMap(rows[h])).toEqual([
      'legacy_id', 'venture_name', 'description', 'region', 'country_of_operation', 'health_sector', 'source', 'year_founded', 'institution', 'founder_name', 'founder_email', 'track', 'stage', 'current_status',
      'legal_status', 'youth_led', 'women_led', 'cofounders_count', 'cofounders_female_count', 'jobs_total', 'jobs_women', 'jobs_pwd', 'jobs_displaced', 'funding_raised',
    ])
  })

  it('reads amounts with symbols, codes and k/M', () => {
    expect(parseMoney('$12,000')).toEqual({ amount: 12000, currency: 'USD' })
    expect(parseMoney('KES 1,300,000')).toEqual({ amount: 1300000, currency: 'KES' })
    expect(parseMoney('$85K')).toEqual({ amount: 85000, currency: 'USD' })
    expect(parseMoney('')).toEqual({ amount: 0, currency: 'USD' })
    expect(parseMoney('lots')).toBeNull()
  })
})

describe('dry run', () => {
  it('labels each row and writes nothing', () => {
    const before = getRegistry().ventures.length
    const p = plan()
    expect(getRegistry().ventures.length).toBe(before)
    expect(p.counts).toMatchObject({ new: 6, existing: 1, blocked: 3 })
  })
  it('a venture already in the registry is matched on its old Venture ID', () => {
    expect(row('AfyaLink')).toMatchObject({ outcome: 'existing', existingCode: 'VEN-0001' })
  })
  it('blocks rows that break the critical rules, with clear messages', () => {
    expect(row('DawaLink Pharmacy').errors).toContain('Women jobs (9) can’t be more than total jobs (7).')
    expect(row('DawaLink Pharmacy').errors.join(' ')).toMatch(/Country “Nigerria” isn’t recognised/)
    expect(row('NutriKids Senegal').errors.join(' ')).toMatch(/Year founded “1985”/)
    expect(plan().rows.filter((r) => r.name === 'MamaSafe Kits')[1].errors.join(' ')).toMatch(/Same venture name as row/)
  })
  it('matches founders to existing CHII IDs by email, and maps old stage and status names', () => {
    const kasi = row('Kasi Clinic Connect')
    expect(kasi.founder).toMatchObject({ status: 'matched', chiiId: 'CHII-000302', matchedOn: 'email' })
    expect(kasi.venture!.countries).toEqual(['KE', 'UG'])
    expect(row('MamaSafe Kits').baseline!.stage).toBe('Expose')
    expect(row('TibaScan').baseline!.status).toBe('Paused')
    expect(row('TibaScan').warnings.join(' ')).toMatch(/Stalled/)
  })
  it('keeps a sheet value for women-led only when it disagrees with the founders, and warns', () => {
    // Kasi: the sheet says No, but it has a female co-founder.
    expect(row('Kasi Clinic Connect').venture!.womenLedOverride).toBe(false)
    expect(row('Kasi Clinic Connect').warnings.join(' ')).toMatch(/women-led/)
  })
  it('warns about a possible duplicate of a venture already in the registry', () => {
    expect(row('Afya Link Ltd').warnings.join(' ')).toMatch(/Looks like AfyaLink \(VEN-0001\)/)
  })
})

describe('import (spec §7)', () => {
  it('imports the valid rows as baselines, keeping old IDs as legacy IDs', () => {
    const p = plan()
    const { created } = runImport(p, settings)
    expect(created).toHaveLength(6)
    const d = getRegistry()
    const kasi = d.ventures.find((v) => v.name === 'Kasi Clinic Connect')!
    expect(kasi.legacyId).toBe('HV-140')
    expect(kasi.code).toMatch(/^VEN-\d{4}$/)
    const base = d.updates.find((u) => u.ventureId === kasi.id)!
    expect(base).toMatchObject({ updateType: 'baseline', source: 'import', asOf: '2025-11-10', jobsTotal: 9, fundingCurrency: 'KES', fundingUsd: toUsd(1_300_000, 'KES') })
    // The founder is the existing person, and the unnamed female co-founder counts.
    expect(d.members.find((m) => m.ventureId === kasi.id)!.chiiId).toBe('CHII-000302')
    const flags = deriveFlags(d, kasi)
    expect(flags.founders).toBe(2)
    expect(flags.derived.womenLed).toBe(true)
  })

  it('importing the same sheet twice creates no duplicate ventures or founders', () => {
    runImport(plan(), settings)
    const after = { ventures: getRegistry().ventures.length, members: getRegistry().members.length }
    const again = plan()
    expect(again.counts.new).toBe(0)
    expect(runImport(again, settings).created).toHaveLength(0)
    expect({ ventures: getRegistry().ventures.length, members: getRegistry().members.length }).toEqual(after)
  })
})
