/**
 * Venture page (VENTURE-REGISTRY-SPEC §3): header, data checks, and the tabs
 * Overview · Outcomes · Funding · Interventions · History.
 */
import React, { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Clock, ExternalLink, History as HistoryIcon, Pencil, Plus, UserRound } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Modal } from '../shared/components/Modal'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { toast } from '../shared/lib/notify'
import { REPORTING_DATE, acceptedUpdates, deriveFlags, foundersOf, ventureChange } from '../shared/ventures/derive'
import { CURRENCIES, FUNDING_TYPES, STAGES, STATUSES, countryName, regionOf } from '../shared/ventures/lists'
import { ageOn, interventionsOf, personById } from '../shared/ventures/people'
import { runVentureChecks } from '../shared/ventures/quality'
import { VentureValidationError, acceptUpdate, addUpdate, type UpdateInput } from '../shared/ventures/store'
import type { RegistryData, Stage, VentureStatus, VentureUpdate } from '../shared/ventures/types'
import { ErrorBox, Field, VentureStatusPill, StagePill, YesNo, fmtDate, inputCls, money, moneyFull } from './parts'

const TABS = ['Overview', 'Outcomes', 'Funding', 'Interventions', 'History'] as const
type Tab = (typeof TABS)[number]

export function VenturePage({
  data,
  ventureId,
  me,
  showIdentity,
  onBack,
  onEdit,
  onOpenPerson,
}: {
  data: RegistryData
  ventureId: string
  me: string
  showIdentity: boolean
  onBack: () => void
  onEdit: () => void
  onOpenPerson: (chiiId: string) => void
}) {
  const [tab, setTab] = useState<Tab>('Overview')
  const [recording, setRecording] = useState(false)
  const v = data.ventures.find((x) => x.id === ventureId)!
  const countries = data.countries.filter((c) => c.ventureId === v.id).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  const primary = countries[0]?.countryCode
  const issues = useMemo(() => runVentureChecks(data).filter((i) => i.ventureId === v.id), [data, v.id])
  const pending = data.updates.filter((u) => u.ventureId === v.id && !u.acceptedAt)

  return (
    <>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> All ventures
      </button>
      <PageHeader
        crumbs={['HENT', 'Ventures', 'Registry', v.code]}
        title={v.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="font-mono">{v.code}</span>
            {v.legacyId && <span className="text-white/60">(was {v.legacyId})</span>}
            <span>·</span>
            <span>{v.healthSector}</span>
            <span>·</span>
            <span>
              {primary ? countryName(primary) : '—'}
              {primary && `, ${regionOf(primary)}`}
            </span>
            <span>·</span>
            <span>Intake {v.intakeYear}</span>
            <StagePill stage={v.stage} onDark />
            <VentureStatusPill status={v.currentStatus} />
          </span>
        }
        actions={
          <>
            <Button onClick={() => setRecording(true)}>
              <Plus className="h-4 w-4" /> Record update
            </Button>
            <Button variant="primary" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Edit venture
            </Button>
          </>
        }
      />

      {(issues.length > 0 || pending.length > 0) && (
        <div className="space-y-2">
          {pending.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-600/30 bg-brand-50 px-4 py-3 text-sm text-brand-600">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <b>A founder sent an update</b> (as of {fmtDate(pending[0].asOf)}). It doesn’t count until you accept it.
              </span>
              <Button variant="primary" onClick={() => setTab('Outcomes')}>
                Review it
              </Button>
            </div>
          )}
          {issues.length > 0 && (
            <div className="rounded-lg border border-warn/30 bg-warn-bg px-4 py-3 text-sm text-warn">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> {issues.length} data {issues.length === 1 ? 'check needs' : 'checks need'} a look
              </p>
              <ul className="mt-1 space-y-0.5 pl-6 text-[13px] text-body">
                {issues.map((i) => (
                  <li key={i.rule + i.detail}>
                    <b className="text-ink">{i.rule}</b> · {i.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto rounded-[var(--radius-card)] border border-[color:var(--card-border)] bg-surface p-1.5 shadow-[var(--shadow-soft)]">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-[13px] font-semibold transition-colors duration-150 ease-out ${tab === t ? 'bg-brand text-white' : 'text-body hover:bg-canvas'}`}
          >
            {t}
            {t === 'Outcomes' && pending.length > 0 && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-warn" />}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab data={data} ventureId={v.id} showIdentity={showIdentity} onOpenPerson={onOpenPerson} />}
      {tab === 'Outcomes' && <OutcomesTab data={data} ventureId={v.id} me={me} />}
      {tab === 'Funding' && <FundingTab data={data} ventureId={v.id} />}
      {tab === 'Interventions' && <InterventionsTab data={data} ventureId={v.id} showIdentity={showIdentity} onOpenPerson={onOpenPerson} />}
      {tab === 'History' && <HistoryTab data={data} ventureId={v.id} />}

      {recording && <RecordUpdate open onClose={() => setRecording(false)} data={data} ventureId={v.id} me={me} />}
    </>
  )
}

/* ---------- Overview ---------- */

function OverviewTab({ data, ventureId, showIdentity, onOpenPerson }: { data: RegistryData; ventureId: string; showIdentity: boolean; onOpenPerson: (id: string) => void }) {
  const v = data.ventures.find((x) => x.id === ventureId)!
  const flags = deriveFlags(data, v)
  const countries = data.countries.filter((c) => c.ventureId === v.id).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  const founders = foundersOf(data, v.id)
  const last = acceptedUpdates(data, v.id).slice(-1)[0]

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-5">
        <Panel title="Venture details">
          <Dl
            rows={[
              ['Venture name', v.name],
              ['Description', v.description || '—'],
              ['Countries of operation', countries.map((c) => `${countryName(c.countryCode)}${c.isPrimary && countries.length > 1 ? ' (primary)' : ''}`).join(', ') || '—'],
              ['Region', regionOf(countries[0]?.countryCode) ?? '—'],
              ['Health sector', v.healthSector],
              ['Source', v.source],
              ['Year founded', String(v.yearFounded)],
              ['Intake year', String(v.intakeYear)],
              ['Institution', v.institution],
              ['Track', v.track],
            ]}
          />
        </Panel>
        <Panel title="Stage and status" sub="Stage and status come from the latest accepted update.">
          <Dl
            rows={[
              ['Stage', <StagePill key="s" stage={v.stage} />],
              ['Current status', <VentureStatusPill key="st" status={v.currentStatus} />],
              ['Legal status', v.legalStatus],
              ['In an accelerator', v.inAccelerator ? 'Yes' : 'No'],
              ['Women-led', <Flag key="w" value={flags.value.womenLed} derived={flags.derived.womenLed} rule="At least one female founder" />],
              ['Youth-led', <Flag key="y" value={flags.value.youthLed} derived={flags.derived.youthLed} rule="Lead founder aged 35 or under" />],
              ['PWD-led', <Flag key="p" value={flags.value.pwdLed} derived={flags.derived.pwdLed} rule="At least one founder with a disability" />],
              ['Co-founders', founders.length ? `${founders.length} (${flags.femaleFounders} female) · from the founders below` : `${last?.cofoundersCount ?? '—'} (${last?.cofoundersFemaleCount ?? '—'} female) · entered`],
            ]}
          />
        </Panel>
      </div>

      <Panel title="Founders" sub={showIdentity ? 'Each founder is one person with a CHII ID.' : 'Names are hidden for your role.'}>
        {founders.length ? (
          <ul className="divide-y divide-line">
            {founders.map((m) => {
              const p = personById(m.chiiId)
              const age = ageOn(p?.dob, REPORTING_DATE)
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {showIdentity ? p?.name : m.chiiId}
                      <span className="ml-2 rounded bg-canvas px-1.5 py-px text-[10px] font-bold uppercase text-muted">{m.role === 'lead_founder' ? 'Lead founder' : m.role === 'co_founder' ? 'Co-founder' : 'Team'}</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {showIdentity && <span className="font-mono text-brand-600">{m.chiiId} · </span>}
                      {p?.gender === 'F' ? 'Female' : p?.gender === 'M' ? 'Male' : 'Gender not given'}
                      {age != null && ` · ${age}`}
                      {p?.disability && ' · PWD'}
                      {showIdentity && p?.email && ` · ${p.email}`}
                    </p>
                  </div>
                  {showIdentity && (
                    <button type="button" onClick={() => onOpenPerson(m.chiiId)} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                      Journey <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="flex gap-2 px-4 py-4 text-sm text-warn">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            No founder is linked to a CHII ID yet. Edit the venture to add them.
          </p>
        )}
      </Panel>
    </div>
  )
}

function Flag({ value, derived, rule }: { value: boolean | null; derived: boolean | null; rule: string }) {
  const manual = value !== derived && value != null
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <YesNo value={value} />
      <span className="text-xs text-muted">{manual ? `Set by hand · founders’ data says ${derived == null ? 'unknown' : derived ? 'Yes' : 'No'}` : `${rule}`}</span>
    </span>
  )
}

function Dl({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([k, val]) => (
        <div key={k} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-[13px] text-muted">{k}</dt>
          <dd className="min-w-0 text-[13.5px] text-ink">{val}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ---------- Outcomes ---------- */

const CHANGE_LABEL = { jobsTotal: 'Total jobs', jobsWomen: 'Women jobs', jobsPwd: 'PWD jobs', jobsDisplaced: 'Displaced persons jobs', fundingUsd: 'Funding raised', revenueUsd: 'Revenue (12 months)' } as const

function OutcomesTab({ data, ventureId, me }: { data: RegistryData; ventureId: string; me: string }) {
  const changes = ventureChange(data, ventureId)
  const all = data.updates.filter((u) => u.ventureId === ventureId).sort((a, b) => b.asOf.localeCompare(a.asOf))
  const series = acceptedUpdates(data, ventureId).map((u) => ({ date: fmtDate(u.asOf), jobs: u.jobsTotal, women: u.jobsWomen }))
  const isMoney = (f: string) => f === 'fundingUsd' || f === 'revenueUsd'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        {changes.map((c) => (
          <div key={c.field} className="rounded-[var(--radius-card)] bg-surface px-4 py-3.5" style={{ border: '1px solid var(--stat-border)', borderLeft: '5px solid var(--color-brand)', boxShadow: 'var(--shadow-soft)' }}>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--stat-label)]">{CHANGE_LABEL[c.field]}</p>
            <p className="mt-1.5 font-display text-[24px] font-semibold leading-none text-brand-deep tabular-nums">{isMoney(c.field) ? money(c.latest) : (c.latest ?? '—')}</p>
            <p className="mt-1.5 text-[11px] text-muted">
              Baseline {isMoney(c.field) ? money(c.baseline) : (c.baseline ?? '—')}
              {c.change != null && c.change !== 0 && <span className={c.change > 0 ? 'font-semibold text-good' : 'font-semibold text-bad'}> · {c.change > 0 ? '+' : '−'}{isMoney(c.field) ? money(Math.abs(c.change)) : Math.abs(c.change)}</span>}
            </p>
          </div>
        ))}
      </div>

      <Panel title="Jobs over time" sub="From each accepted update, baseline first.">
        <div className="h-60 px-2 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-faint)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--color-faint)' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line dataKey="jobs" name="Total jobs" stroke="var(--color-navy)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              <Line dataKey="women" name="Women jobs" stroke="var(--color-sky)" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Updates" sub="Nothing is overwritten: each update is kept with its date and source.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="bg-brand-50/60 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-brand-600">
                {['As of', 'Type', 'Source', 'Stage', 'Status', 'Jobs (women / PWD / displaced)', 'Funding raised', 'Revenue', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {all.map((u) => (
                <tr key={u.id} className={u.acceptedAt ? '' : 'bg-warn-bg/40'}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">{fmtDate(u.asOf)}</td>
                  <td className="px-4 py-2.5">{u.updateType === 'baseline' ? <span className="rounded bg-brand-50 px-1.5 py-px text-[11px] font-bold uppercase text-brand-600">Baseline</span> : 'Update'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-body">{SOURCE[u.source]}</td>
                  <td className="px-4 py-2.5">
                    <StagePill stage={u.stage} />
                  </td>
                  <td className="px-4 py-2.5">
                    <VentureStatusPill status={u.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                    <b className="text-ink">{u.jobsTotal}</b> <span className="text-muted">({u.jobsWomen} / {u.jobsPwd} / {u.jobsDisplaced})</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                    {moneyFull(u.fundingUsd)}
                    {u.fundingCurrency !== 'USD' && <span className="block text-[11px] text-muted">{u.fundingCurrency} {u.fundingAmount.toLocaleString()}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{moneyFull(u.revenueUsd)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    {u.acceptedAt ? (
                      <span className="text-xs text-muted">Accepted</span>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => {
                          acceptUpdate(u.id, me)
                          toast({ title: 'Update accepted', body: 'The venture’s latest values now use it. The baseline is unchanged.', tone: 'good' })
                        }}
                      >
                        <Check className="h-4 w-4" /> Accept
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

const SOURCE: Record<VentureUpdate['source'], string> = { import: 'Sheet import', staff: 'Staff', founder_form: 'Founder form', survey: 'Bi-annual survey' }

/* ---------- Funding ---------- */

function FundingTab({ data, ventureId }: { data: RegistryData; ventureId: string }) {
  const awards = data.awards.filter((a) => a.ventureId === ventureId)
  const rows = data.funding.filter((f) => f.ventureId === ventureId).sort((a, b) => b.asOf.localeCompare(a.asOf))
  const last = acceptedUpdates(data, ventureId).slice(-1)[0]
  const chii = awards.reduce((s, a) => s + a.amountUsd, 0)
  const typeLabel = (k: string) => FUNDING_TYPES.find((t) => t.key === k)?.label ?? k
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="External funding raised" value={money(last?.fundingUsd)} hint="latest update, to date" />
        <Tile label="CHII funding" value={money(chii)} hint={`${awards.length} award${awards.length === 1 ? '' : 's'} · counted separately`} />
        <Tile label="Funding rounds recorded" value={String(rows.length)} hint="external, with funder and type" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="CHII Venture Funding awards" sub="Counted as Funding Deployed, never as funding raised.">
          <SimpleTable head={['Awarded', 'Instrument', 'Amount']} rows={awards.map((a) => [fmtDate(a.awardedOn), a.instrument, moneyFull(a.amountUsd)])} empty="No CHII awards." />
        </Panel>
        <Panel title="External funding" sub="Behind the “funding raised” total.">
          <SimpleTable head={['As of', 'Funder', 'Type', 'Amount']} rows={rows.map((f) => [fmtDate(f.asOf), f.funder, typeLabel(f.fundingType), moneyFull(f.amountUsd)])} empty="No external funding recorded." />
        </Panel>
      </div>
    </div>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-surface px-4 py-3.5 text-center" style={{ border: '1px solid var(--stat-border)', borderLeft: '5px solid var(--color-brand)', boxShadow: 'var(--shadow-soft)' }}>
      <p className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--stat-label)]">{label}</p>
      <p className="mt-1.5 font-display text-[26px] font-semibold leading-none text-brand-deep tabular-nums">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
    </div>
  )
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="px-4 py-4 text-sm text-muted">{empty}</p>
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="bg-brand-50/60 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-brand-600">
          {head.map((h, i) => (
            <th key={h} className={`px-4 py-2.5 ${i === head.length - 1 ? 'text-right' : ''}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={`px-4 py-2.5 ${j === r.length - 1 ? 'text-right font-semibold tabular-nums text-ink' : 'text-body'} ${j === 1 ? 'capitalize' : ''}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------- Interventions ---------- */

function InterventionsTab({ data, ventureId, showIdentity, onOpenPerson }: { data: RegistryData; ventureId: string; showIdentity: boolean; onOpenPerson: (id: string) => void }) {
  const v = data.ventures.find((x) => x.id === ventureId)!
  const founders = foundersOf(data, ventureId)
  const map = new Map<string, string[]>()
  for (const m of founders) for (const iv of interventionsOf(m.chiiId)) map.set(iv, [...(map.get(iv) ?? []), m.chiiId])
  const list = [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title="CHII programmes the founders took part in" sub="From each founder’s CHII ID, so a founder counts once across programmes.">
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map(([iv, ids]) => (
              <li key={iv} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{iv}</span>
                <span className="flex flex-wrap gap-1.5">
                  {ids.map((id) =>
                    showIdentity ? (
                      <button key={id} type="button" onClick={() => onOpenPerson(id)} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:underline">
                        {personById(id)?.name}
                      </button>
                    ) : (
                      <span key={id} className="rounded-full bg-canvas px-2.5 py-1 font-mono text-xs text-muted">
                        {id}
                      </span>
                    ),
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-4 text-sm text-muted">{founders.length ? 'The founders haven’t taken part in other CHII programmes yet.' : 'Link the founders to see their CHII programmes.'}</p>
        )}
      </Panel>
      <Panel title="How the venture came to CHII">
        <Dl
          rows={[
            ['Source', v.source],
            ['Track', v.track],
            ['Intake year', String(v.intakeYear)],
            ['In an accelerator', v.inAccelerator ? 'Yes' : 'No'],
          ]}
        />
      </Panel>
    </div>
  )
}

/* ---------- History ---------- */

function HistoryTab({ data, ventureId }: { data: RegistryData; ventureId: string }) {
  const rows = data.history.filter((h) => h.ventureId === ventureId).sort((a, b) => b.at.localeCompare(a.at))
  return (
    <Panel title="History" sub="Every change to this venture, newest first.">
      <ol className="divide-y divide-line">
        {rows.map((h) => (
          <li key={h.id} className="flex gap-3 px-4 py-3">
            <HistoryIcon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{h.detail}</p>
              <p className="text-xs text-muted">
                {h.by} · {new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/* ---------- Record an update (staff) ---------- */

function RecordUpdate({ open, onClose, data, ventureId, me }: { open: boolean; onClose: () => void; data: RegistryData; ventureId: string; me: string }) {
  const last = acceptedUpdates(data, ventureId).slice(-1)[0]
  const blank = (): UpdateInput => ({
    asOf: REPORTING_DATE,
    stage: last?.stage ?? 'Expose',
    status: last?.status ?? 'Active',
    cofoundersCount: last?.cofoundersCount ?? null,
    cofoundersFemaleCount: last?.cofoundersFemaleCount ?? null,
    jobsTotal: last?.jobsTotal ?? 0,
    jobsWomen: last?.jobsWomen ?? 0,
    jobsPwd: last?.jobsPwd ?? 0,
    jobsDisplaced: last?.jobsDisplaced ?? 0,
    fundingAmount: last?.fundingAmount ?? 0,
    fundingCurrency: last?.fundingCurrency ?? 'USD',
    revenueAmount: last?.revenueAmount ?? null,
    revenueCurrency: last?.revenueCurrency ?? 'USD',
    notes: '',
  })
  const [u, setU] = useState<UpdateInput>(blank)
  const [errors, setErrors] = useState<string[]>([])
  const set = (p: Partial<UpdateInput>) => setU((x) => ({ ...x, ...p }))
  const num = (k: keyof UpdateInput) => (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.value === '' ? 0 : Number(e.target.value) } as Partial<UpdateInput>)
  const save = () => {
    try {
      addUpdate(ventureId, u, me, 'staff')
      toast({ title: 'Update recorded', body: `As of ${fmtDate(u.asOf)}. The baseline is unchanged.`, tone: 'good' })
      setErrors([])
      onClose()
    } catch (e) {
      if (e instanceof VentureValidationError) setErrors(e.messages)
      else throw e
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Record an update"
      description="Current stage, status, jobs and funding. It’s added as a new update; earlier ones stay as they were."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            <Check className="h-4 w-4" /> Save update
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBox errors={errors} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="As of" required>
            <input type="date" className={inputCls} value={u.asOf} max={REPORTING_DATE} onChange={(e) => set({ asOf: e.target.value })} />
          </Field>
          <Field label="Stage" required>
            <select className={inputCls} value={u.stage} onChange={(e) => set({ stage: e.target.value as Stage })}>
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Status" required>
            <select className={inputCls} value={u.status} onChange={(e) => set({ status: e.target.value as VentureStatus })}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Total jobs">
            <input type="number" min={0} className={inputCls} value={u.jobsTotal} onChange={num('jobsTotal')} />
          </Field>
          <Field label="Women jobs">
            <input type="number" min={0} className={inputCls} value={u.jobsWomen} onChange={num('jobsWomen')} />
          </Field>
          <Field label="PWD jobs">
            <input type="number" min={0} className={inputCls} value={u.jobsPwd} onChange={num('jobsPwd')} />
          </Field>
          <Field label="Displaced persons jobs">
            <input type="number" min={0} className={inputCls} value={u.jobsDisplaced} onChange={num('jobsDisplaced')} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Funding raised to date" hint="External funding only. CHII awards are recorded separately.">
            <div className="flex gap-2">
              <select className={`${inputCls} w-24`} value={u.fundingCurrency} onChange={(e) => set({ fundingCurrency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input type="number" min={0} className={inputCls} value={u.fundingAmount} onChange={num('fundingAmount')} />
            </div>
          </Field>
          <Field label="Revenue, last 12 months">
            <div className="flex gap-2">
              <select className={`${inputCls} w-24`} value={u.revenueCurrency ?? 'USD'} onChange={(e) => set({ revenueCurrency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input type="number" min={0} className={inputCls} value={u.revenueAmount ?? ''} placeholder="Not reported" onChange={(e) => set({ revenueAmount: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
          </Field>
        </div>
        <Field label="Notes" hint="Explain any big change, e.g. a new contract or a funding round.">
          <textarea className={`${inputCls} h-20 py-2`} value={u.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}
