import { beforeEach, describe, expect, it } from 'vitest'
import { stageHistory, ventureLatest } from './derive'
import { PERIODS, PERIOD_YEARS, VENTURE_INDICATORS, analyse, median, periodStarted, previousPeriod, suppressCount, yearPeriod } from './metrics'
import { resetPeople } from './people'
import { getRegistry, resetRegistry } from './store'

beforeEach(() => {
  resetPeople()
  resetRegistry()
})
const toDate = PERIODS[0]
const year = yearPeriod

describe('the dashboard’s Ventures Portfolio metrics are all defined (spec §4, §7)', () => {
  it('every card and chart on the dashboard page has an indicator', () => {
    const names = VENTURE_INDICATORS.map((i) => i.dashboard ?? '').join(' | ')
    for (const card of ['Ventures Supported', 'Women-Led Ventures Supported', 'PWD-Led Ventures Supported', 'Jobs Created by Ventures', 'Funding Deployed', 'Revenue Generated'])
      expect(names).toContain(`Card · ${card}`)
    for (const chart of ['In Accelerators', 'Venture Survival by Cohort', 'Revenue Trend', 'Stage Progression']) expect(names).toContain(chart)
    expect(new Set(VENTURE_INDICATORS.map((i) => i.code)).size).toBe(VENTURE_INDICATORS.length)
  })
})

describe('values come from the registry with the agreed definitions', () => {
  it('portfolio counts match the registry rows', () => {
    const a = analyse(getRegistry(), toDate)
    const rows = ventureLatest(getRegistry())
    expect(a.values['venture.supported']).toBe(rows.length)
    expect(a.values['venture.active']).toBe(rows.filter((r) => r.status === 'Active').length)
    expect(a.values['venture.women_led']).toBe(rows.filter((r) => r.womenLed).length)
    expect(a.values['venture.jobs']).toBe(rows.reduce((s, r) => s + r.jobsTotal, 0))
    expect(a.values['venture.jobs_per_venture']).toBe(Math.round(a.values['venture.jobs']! / rows.length))
  })

  it('funding deployed is CHII awards only; external funding raised is separate', () => {
    const d = getRegistry()
    const a = analyse(d, toDate)
    expect(a.values['venture.funding_deployed']).toBe(d.awards.reduce((s, x) => s + x.amountUsd, 0))
    expect(a.values['venture.funding_raised']).toBe(ventureLatest(d).reduce((s, r) => s + r.fundingRaisedUsd, 0))
  })

  it('a period is "as of" its end: 2024 leaves out ventures that joined in 2025', () => {
    const a24 = analyse(getRegistry(), year(2024))
    expect(a24.rows.every((r) => r.intakeYear <= 2024)).toBe(true)
    expect(a24.values['venture.supported']!).toBeLessThan(analyse(getRegistry(), toDate).values['venture.supported']!)
    expect(previousPeriod(year(2024)).key).toBe('y2023')
    expect(previousPeriod(toDate).end).toBe('2024-11-10')
  })

  it('filters narrow every number', () => {
    const all = analyse(getRegistry(), toDate)
    const build = analyse(getRegistry(), toDate, { stage: ['Build'] })
    expect(build.values['venture.supported']).toBe(all.breakdowns.stage.find((s) => s.key === 'Build')!.value)
    expect(build.rows.every((r) => r.stage === 'Build')).toBe(true)
  })

  it('survival by cohort = active ÷ ventures in that intake year', () => {
    const a = analyse(getRegistry(), toDate)
    for (const s of a.series.survival) {
      const c = a.rows.filter((r) => String(r.intakeYear) === s.label)
      expect(s.value).toBe(Math.round((c.filter((r) => r.status === 'Active').length / c.length) * 1000) / 10)
    }
  })

  it('stage progression counts moves up a stage, by year', () => {
    const a = analyse(getRegistry(), toDate)
    const up = stageHistory(getRegistry()).filter((m) => (m.from === 'Expose' && m.to !== 'Expose') || (m.from === 'Build' && m.to === 'Scale'))
    expect(a.values['venture.stage_moves']).toBe(up.length)
  })

  it('jobs over time ends at the current total', () => {
    const a = analyse(getRegistry(), toDate)
    expect(a.series.overTime.slice(-1)[0].jobs).toBe(a.values['venture.jobs'])
  })

  it('every bar keeps the ventures behind it, for drill-down', () => {
    const a = analyse(getRegistry(), toDate)
    for (const s of a.breakdowns.sector) expect(s.ids.length).toBe(s.value)
  })
})

describe('periods', () => {
  it('Venture Analytics offers To date, then 2025 to 2030 with their halves', () => {
    expect(PERIOD_YEARS).toEqual([2025, 2026, 2027, 2028, 2029, 2030])
    expect(PERIODS.map((p) => p.label)).toEqual(['To date', ...PERIOD_YEARS.flatMap((y) => [String(y), `H1 ${y}`, `H2 ${y}`])])
  })
  it('years that haven’t started have no data yet; 2025 compares with 2024', () => {
    expect(periodStarted(yearPeriod(2025))).toBe(true)
    expect(periodStarted(yearPeriod(2026))).toBe(false)
    expect(previousPeriod(yearPeriod(2025)).key).toBe('y2024')
  })
})

describe('privacy (spec §4, §7)', () => {
  it('the analysis has no founder names, emails or CHII IDs', () => {
    const json = JSON.stringify(analyse(getRegistry(), toDate))
    expect(json).not.toMatch(/CHII-\d{6}/)
    expect(json).not.toMatch(/@/)
  })
  it('exports hide counts under 5', () => {
    expect(suppressCount(3)).toBe('<5')
    expect(suppressCount(0)).toBe('0')
    expect(suppressCount(12)).toBe('12')
  })
  it('median works for odd and even lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})
