/**
 * Venture Registry list (VENTURE-REGISTRY-SPEC §3): every venture with search, column filters
 * (sector, country, region, stage, status, legal status, track, source, institution, youth-led,
 * women-led, year founded…), quick views, column chooser and CSV/XLSX export.
 */
import React, { useMemo, useState } from 'react'
import { AlertTriangle, Briefcase, Clock, DollarSign, Eye, Pencil, Rocket, TrendingUp, Users } from 'lucide-react'
import { Column, DataTable } from '../shared/components/DataTable'
import { StatCards } from '../shared/components/StatStrip'
import { ventureLatest, deriveFlags, type VentureRow } from '../shared/ventures/derive'
import { countryName } from '../shared/ventures/lists'
import { personById } from '../shared/ventures/people'
import { runVentureChecks } from '../shared/ventures/quality'
import type { RegistryData } from '../shared/ventures/types'
import { Chip, VentureStatusPill, StagePill, YesNo, money } from './parts'

type Row = VentureRow & { lead: string; leadEmail: string; coFounders: number; warnings: string[]; pending: number; derivedWomenLed: boolean | null }

const VIEWS = [
  { key: 'all', label: 'All ventures' },
  { key: 'active', label: 'Active' },
  { key: 'women', label: 'Women-led' },
  { key: 'youth', label: 'Youth-led' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'pending', label: 'Updates to accept' },
] as const
type ViewKey = (typeof VIEWS)[number]['key']
const VIEW_KEY = 'mela-venture-view'

export function Registry({ data, showIdentity, onOpen, onEdit }: { data: RegistryData; showIdentity: boolean; onOpen: (id: string) => void; onEdit: (id: string) => void }) {
  const [view, setView] = useState<ViewKey>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as ViewKey) || 'all'
    } catch {
      return 'all'
    }
  })
  const choose = (v: ViewKey) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* per-viewer convenience only */
    }
  }

  const rows: Row[] = useMemo(() => {
    const issues = runVentureChecks(data)
    return ventureLatest(data).map((r) => {
      const v = data.ventures.find((x) => x.id === r.ventureId)!
      const founders = data.members.filter((m) => m.ventureId === r.ventureId && m.role !== 'team' && !m.leftOn)
      const lead = founders.find((m) => m.isPrimary) ?? founders[0]
      const person = lead ? personById(lead.chiiId) : null
      return {
        ...r,
        lead: person?.name ?? '',
        leadEmail: person?.email ?? '',
        coFounders: Math.max(0, founders.length - 1),
        warnings: issues.filter((i) => i.ventureId === r.ventureId).map((i) => `${i.rule}: ${i.detail}`),
        pending: data.updates.filter((u) => u.ventureId === r.ventureId && !u.acceptedAt).length,
        derivedWomenLed: deriveFlags(data, v).derived.womenLed,
      }
    })
  }, [data])

  const shown = rows.filter((r) =>
    view === 'active' ? r.active : view === 'women' ? r.womenLed : view === 'youth' ? r.youthLed : view === 'attention' ? r.warnings.length > 0 : view === 'pending' ? r.pending > 0 : true,
  )
  const count = (k: ViewKey) => rows.filter((r) => (k === 'active' ? r.active : k === 'women' ? r.womenLed : k === 'youth' ? r.youthLed : k === 'attention' ? r.warnings.length > 0 : k === 'pending' ? r.pending > 0 : true)).length

  const active = rows.filter((r) => r.active).length
  const women = rows.filter((r) => r.womenLed).length
  const jobs = rows.reduce((s, r) => s + r.jobsTotal, 0)
  const deployed = rows.reduce((s, r) => s + r.chiiFundingUsd, 0)

  const yesNo = (b: boolean | null) => (b == null ? 'Unknown' : b ? 'Yes' : 'No')
  const columns: Column<Row>[] = [
    { key: 'code', label: 'Venture ID', render: (r) => <span className="whitespace-nowrap font-mono text-[13px] font-medium text-brand-600">{r.code}</span> },
    {
      key: 'name',
      label: 'Venture',
      filterable: false,
      render: (r) => (
        <div className="max-w-[240px]">
          <div className="truncate font-semibold text-ink">{r.name}</div>
          <div className="truncate text-xs text-muted">{r.sector}</div>
        </div>
      ),
    },
    {
      key: 'lead',
      label: 'Lead founder',
      restricted: true,
      filterable: false,
      render: (r) =>
        r.lead ? (
          <div className="max-w-[200px]">
            <div className="truncate">{r.lead}</div>
            {r.coFounders > 0 && <div className="text-xs text-muted">+{r.coFounders} co-founder{r.coFounders === 1 ? '' : 's'}</div>}
          </div>
        ) : (
          <span className="text-xs text-warn">No founder linked</span>
        ),
    },
    { key: 'leadEmail', label: 'Lead founder email', restricted: true, exportOnly: true },
    { key: 'sector', label: 'Health sector' },
    {
      key: 'country',
      label: 'Country',
      value: (r) => (r.country ? countryName(r.country) : ''),
      render: (r) => (
        <div className="whitespace-nowrap">
          <div>{r.country ? countryName(r.country) : '—'}</div>
          {r.countries.length > 1 && <div className="text-xs text-muted">+{r.countries.length - 1} more</div>}
        </div>
      ),
    },
    { key: 'region', label: 'Region', value: (r) => r.region ?? '' },
    { key: 'stage', label: 'Stage', render: (r) => <StagePill stage={r.stage} /> },
    { key: 'status', label: 'Status', render: (r) => <VentureStatusPill status={r.status} /> },
    { key: 'intakeYear', label: 'Intake year', numeric: true },
    { key: 'jobsTotal', label: 'Jobs', numeric: true },
    { key: 'fundingRaisedUsd', label: 'Funding raised', numeric: true, render: (r) => <span className="tabular-nums">{money(r.fundingRaisedUsd)}</span> },
    { key: 'chiiFundingUsd', label: 'CHII funding', numeric: true, render: (r) => <span className="tabular-nums">{money(r.chiiFundingUsd)}</span> },
    { key: 'revenueUsd', label: 'Revenue (12 mo)', numeric: true, value: (r) => r.revenueUsd ?? 0, render: (r) => <span className="tabular-nums">{money(r.revenueUsd)}</span> },
    { key: 'womenLed', label: 'Women-led', value: (r) => yesNo(r.womenLed), render: (r) => <YesNo value={r.womenLed} derived={r.derivedWomenLed} /> },
    { key: 'youthLed', label: 'Youth-led', value: (r) => yesNo(r.youthLed), render: (r) => <YesNo value={r.youthLed} /> },
    { key: 'pwdLed', label: 'PWD-led', value: (r) => yesNo(r.pwdLed), render: (r) => <YesNo value={r.pwdLed} /> },
    { key: 'inAccelerator', label: 'In accelerator', value: (r) => yesNo(r.inAccelerator) },
    { key: 'legalStatus', label: 'Legal status' },
    { key: 'track', label: 'Track' },
    { key: 'source', label: 'Source' },
    { key: 'institution', label: 'Institution' },
    { key: 'yearFounded', label: 'Year founded', numeric: true },
    { key: 'latestAsOf', label: 'Last update', className: 'whitespace-nowrap', filterable: false },
    {
      key: 'warnings',
      label: 'Data checks',
      value: (r) => (r.warnings.length ? `${r.warnings.length} to check` : 'OK'),
      render: (r) =>
        r.warnings.length ? (
          <span title={r.warnings.join('\n')} className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-warn-bg px-2 text-xs font-semibold text-warn">
            <AlertTriangle className="h-3 w-3" /> {r.warnings.length}
          </span>
        ) : r.pending ? (
          <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-brand-50 px-2 text-xs font-semibold text-brand-600">
            <Clock className="h-3 w-3" /> Update
          </span>
        ) : (
          <span className="text-xs text-good">OK</span>
        ),
    },
  ]

  return (
    <>
      <StatCards
        items={[
          { label: 'Ventures', value: rows.length, icon: Briefcase, hint: `${active} active`, tip: 'Ventures in the registry, any status (dashboard: Ventures Supported).' },
          { label: 'Women-led', value: women, icon: Users, hint: `${rows.length ? Math.round((women / rows.length) * 100) : 0}% of ventures`, tip: 'Ventures with at least one female founder (lead or co-founder).' },
          { label: 'Jobs created', value: jobs, icon: TrendingUp, hint: 'latest values', tip: 'Total jobs from each venture’s latest accepted update.' },
          { label: 'CHII funding', value: deployed, display: money(deployed), icon: DollarSign, hint: 'awards to date', tip: 'CHII Venture Funding awards (dashboard: Funding Deployed). External funding is counted separately.' },
        ]}
      />

      <DataTable
        heading="Venture registry"
        description={`${rows.length} ventures · one row per venture, with its latest accepted values`}
        title="HENT Venture Registry"
        rows={shown}
        columns={columns}
        rowKey={(r) => r.ventureId}
        canSeeRestricted={showIdentity}
        onRowClick={(r) => onOpen(r.ventureId)}
        searchPlaceholder={showIdentity ? 'Search venture, founder, sector or ID' : 'Search venture, sector or ID'}
        initialSort={{ key: 'code', dir: 1 }}
        initialHidden={['region', 'chiiFundingUsd', 'revenueUsd', 'youthLed', 'pwdLed', 'inAccelerator', 'legalStatus', 'track', 'source', 'institution', 'yearFounded']}
        above={
          <div className="flex flex-wrap gap-1.5">
            {VIEWS.map((v) => (
              <Chip key={v.key} on={view === v.key} onClick={() => choose(v.key)}>
                {v.label}
                <span className={`tabular-nums ${view === v.key ? 'text-white/80' : 'text-faint'}`}>{count(v.key)}</span>
              </Chip>
            ))}
          </div>
        }
        empty={{ title: 'No ventures in this view', body: 'Try another view or clear the column filters.' }}
        emptyIcon={Rocket}
        rowActions={[
          { label: 'Open venture', icon: Eye, onClick: (r) => onOpen(r.ventureId) },
          { label: 'Edit', icon: Pencil, onClick: (r) => onEdit(r.ventureId) },
        ]}
        mobileRow={(r) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">{r.name}</span>
                <StagePill stage={r.stage} />
              </div>
              <div className="mt-0.5 truncate text-xs text-muted">
                <span className="font-mono text-brand-600">{r.code}</span> · {r.country ? countryName(r.country) : '—'} · {r.jobsTotal} jobs
              </div>
            </div>
            <VentureStatusPill status={r.status} />
          </div>
        )}
      />
    </>
  )
}
