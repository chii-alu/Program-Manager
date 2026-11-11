import React, { useState } from 'react'
import { AlertTriangle, ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert, DoorOpen, Plus, QrCode, EyeOff, RotateCcw, UserCheck, Users } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel, PillarTag, StatusBadge } from '../shared/components/ui'
import { Pillar, Portal, Role, Session, SessionStatus,attention, pillarStats, pillarsFor, portalMeta, roleMeta, sessions } from '../shared/data/mela'
import { CountUp, Delta, StatCards } from '../shared/components/StatStrip'
import { EmptyState } from '../shared/components/EmptyState'
import { previous, seriesFor, totals, useTimeRange } from '../shared/lib/time'
import { CalendarX2, CheckCircle2 } from 'lucide-react'
import { NewSessionModal } from '../shared/components/NewSessionModal'
import { Popover } from '../shared/components/Popover'
import { Column, ColFilter, HeaderMenu } from '../shared/components/DataTable'
import { ChartTooltip, Legend, axisProps, gridProps, valueAxisProps, categoryAxisProps, valueLabelProps } from '../shared/components/charts'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export const args = {
  role: 'admin',
  portal: 'admin',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onOpenSession?: (id: string) => void
}

const statuses: SessionStatus[] = ['open', 'upcoming', 'completed', 'draft']

/** Columns of the All sessions table; `value` drives sorting and the column filters. */
const allSessionCols: Column<Session>[] = [
  { key: 'name', label: 'Session', value: (s) => s.name },
  { key: 'pillar', label: 'Pillar', value: (s) => s.pillar },
  { key: 'dates', label: 'Dates', value: (s) => s.dates },
  { key: 'status', label: 'Status', value: (s) => s.status },
  { key: 'registered', label: 'Registered', value: (s) => s.registered, numeric: true },
  { key: 'attended', label: 'Attended', value: (s) => s.attended, numeric: true },
  { key: 'feedback', label: 'Feedback', value: (s) => s.feedback, numeric: true },
]

export default function Overview(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut, onOpenSession } = { ...args, ...props }
  const [newOpen, setNewOpen] = useState(false)
  const nav = (to: string) => (to === 'new-session' ? setNewOpen(true) : onNavigate?.(to))
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const [filter, setFilter] = useState<'all' | SessionStatus>('all')
  const [pillarFilter, setPillarFilter] = useState<'all' | Pillar>('all')
  const pillars = pillarsFor(portal)
  const mine = sessions.filter((s) => pillars.includes(s.pillar))
  // The Pillar column and filter only matter in the MELA view, where all three pillars show.
  const multiPillar = pillars.length > 1
  const sessionCols = multiPillar ? allSessionCols : allSessionCols.filter((c) => c.key !== 'pillar')
  const byStatus = mine.filter((s) => (filter === 'all' || s.status === filter) && (pillarFilter === 'all' || s.pillar === pillarFilter))

  // Excel-style column menus: sort, tick values to filter, number ranges.
  const [colFilters, setColFilters] = useState<Record<string, ColFilter>>({})
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const colVal = (key: string, s: Session) => sessionCols.find((c) => c.key === key)!.value!(s)
  const colActive = Object.entries(colFilters).filter(([, f]) => f.values?.length || f.min != null || f.max != null)
  const shown = byStatus
    .filter((s) =>
      colActive.every(([k, f]) => {
        const v = colVal(k, s)
        if (f.values?.length) return f.values.includes(String(v))
        const n = Number(v)
        return (f.min == null || n >= f.min) && (f.max == null || n <= f.max)
      }),
    )
    .sort((a, b) => {
      if (!sort) return 0
      const x = colVal(sort.key, a)
      const y = colVal(sort.key, b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir
    })
  const setColFilter = (k: string, f: ColFilter | null) =>
    setColFilters((prev) => {
      const next = { ...prev }
      if (f) next[k] = f
      else delete next[k]
      return next
    })
  const clearCols = () => {
    setColFilters({})
    setSort(null)
  }
  const anyFilter = filter !== 'all' || pillarFilter !== 'all' || colActive.length > 0 || !!sort
  /** Reset: Pillar and Status back to all, and every column filter and sort cleared. */
  const resetAll = () => {
    setFilter('all')
    setPillarFilter('all')
    clearCols()
  }
  const todo = attention.filter((a) => pillars.includes(a.pillar))
  const firstName = roleMeta[role].user.split(' ')[0]
  const { range, label } = useTimeRange()
  const now = totals(range)
  const prev = totals(previous(range))
  const all = now.HENT + now.HEMP + now.HECO || 1
  const share = pillars.reduce((n, pl) => n + now[pl], 0) / all
  const trend = seriesFor(range).map((d) => ({ label: d.label, registered: Math.round(d.registered * share), attended: Math.round(d.attended * share) }))
  const showRate = now.registered ? Math.round((now.attended / now.registered) * 100) : 0
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell role={role} portal={portal} active="overview" onNavigate={nav} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <NewSessionModal open={newOpen} onClose={() => setNewOpen(false)} pillars={pillars} />
      {role === 'reviewer' ? (
        <ReviewerHome name={firstName} onNavigate={onNavigate} />
      ) : (
        <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
          <PageHeader
            crumbs={[portalMeta[portal].label, 'Overview']}
            title={`${greeting}, ${firstName}`}
            description={
              portal === 'admin'
                ? 'Every session across HENT, HEMP and HECO.'
                : `${portalMeta[portal].full} · ${mine.length} sessions in your pillar.`
            }
            actions={
              <>
                <Button className="hidden sm:inline-flex" onClick={() => onNavigate?.('analytics')}>
                  View analytics
                </Button>
                <Button variant="primary" className="flex-1 sm:flex-none" onClick={() => setNewOpen(true)}>
                  <Plus className="h-4 w-4" /> New session
                </Button>
              </>
            }
          />

          {/* Pillar summary: one panel, divided, not a strip of tiles */}
          {pillars.length > 1 ? (
            <StatCards
              columns={3}
              items={pillars.map((pl) => {
                const s = pillarStats[pl]
                return {
                  label: `${pl} · people reached`,
                  value: now[pl],
                  prev: prev[pl],
                  icon: Users,
                  tip: `Unique people who took part in a ${pl} session in the selected period. The arrow compares with the period before.`,
                  hint: `${s.sessions} sessions · ${label.toLowerCase()} · ${healthLabel[s.health]}`,
                }
              })}
            />
          ) : (
            <SinglePillar pillar={pillars[0]} reached={now[pillars[0]]} prev={prev[pillars[0]]} />
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* Needs attention: first on phones, right rail on desktop */}
            <Panel className="lg:order-2 lg:self-start">
              {/* Red header bar, in the chart-card style, so the alert list stands out */}
              <div className="flex items-center justify-between gap-2.5 rounded-t-[calc(var(--radius-card)_-_1px)] bg-alert px-4 py-[11px] sm:px-5">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-white">
                  <CircleAlert className="h-4 w-4" /> Needs attention
                </h2>
                <span className="rounded-full bg-white/20 px-2 text-xs font-semibold tabular-nums text-white">{todo.length}</span>
              </div>
              {todo.length === 0 ? (
                <EmptyState compact icon={CheckCircle2} title="Nothing needs fixing" body="Every session in this pillar is on track." />
              ) : (
                <ul className="divide-y divide-line">
                  {todo.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => onOpenSession?.(a.pillar === 'HECO' ? 's4' : a.pillar === 'HENT' ? 's5' : 's2')} className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-canvas sm:px-5">
                        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${a.tone === 'bad' ? 'text-bad' : 'text-warn'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{a.title}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted">{a.detail}</span>
                        </span>
                        <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-600">
                          Fix <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="min-w-0 space-y-5 lg:order-1">
            {/* Trend */}
            <Panel
              title="Registrations vs attendance"
              sub={`${label} · ${showRate}% of registrants showed up`}
            >
              <div className="h-52 px-2 pb-2 pt-4 sm:h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                    <YAxis {...valueAxisProps} width={44} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-line-strong)', strokeDasharray: '3 3' }} />
                    <Area type="monotone" dataKey="registered" name="Registered" stroke="var(--color-sky)" fill="var(--color-sky)" fillOpacity={0.18} strokeWidth={2.5} animationDuration={280} animationEasing="ease-out" />
                    <Area type="monotone" dataKey="attended" name="Attended" stroke="var(--color-navy)" fill="var(--color-navy)" fillOpacity={0.22} strokeWidth={2.5} animationDuration={280} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Executive ChartLegend: centred swatch row beneath the chart */}
              <div className="pb-3.5 pt-1">
                <Legend
                  center
                  items={[
                    { label: 'Registered', color: 'var(--color-sky)' },
                    { label: 'Attended', color: 'var(--color-navy)' },
                  ]}
                />
              </div>
            </Panel>

            </div>
          </div>

            {/* All sessions: full width under the chart and Needs attention, so every column fits */}
            <Panel>
              {/* Navy title bar, like the chart card headers */}
              <div className="flex flex-col gap-3 rounded-t-[calc(var(--radius-card)_-_1px)] bg-brand px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <h2 className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-white">
                  <span className="h-[15px] w-[3px] shrink-0 rounded-full bg-accent" />
                  All sessions{' '}
                  <span className="font-normal normal-case text-white/70 tabular-nums">{shown.length === mine.length ? mine.length : `${shown.length} of ${mine.length}`}</span>
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {multiPillar && (
                    <HeaderFilter
                      label="Pillar"
                      value={pillarFilter}
                      options={['all', ...pillars]}
                      display={(v) => (v === 'all' ? 'All pillars' : v)}
                      onChange={(v) => setPillarFilter(v as 'all' | Pillar)}
                    />
                  )}
                  <HeaderFilter
                    label="Status"
                    value={filter}
                    options={['all', ...statuses]}
                    display={(v) => (v === 'all' ? 'All statuses' : v[0].toUpperCase() + v.slice(1))}
                    onChange={(v) => setFilter(v as 'all' | SessionStatus)}
                  />
                  <button
                    type="button"
                    onClick={resetAll}
                    disabled={!anyFilter}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-white/85 transition-colors duration-150 ease-out hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                </div>
              </div>

              {/* Table on tablet and up */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      {sessionCols.map((c, i) => (
                        <th key={c.key} className={`${i === 0 || i === sessionCols.length - 1 ? 'px-5' : 'px-3'} font-medium ${c.numeric ? 'text-center' : 'text-left'}`}>
                          <HeaderMenu
                            col={c}
                            align={i > sessionCols.length / 2 ? 'right' : 'left'}
                            values={Array.from(new Set(byStatus.map((s) => String(c.value!(s))))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))}
                            filter={colFilters[c.key]}
                            sortDir={sort?.key === c.key ? sort.dir : null}
                            onSort={(dir) => setSort(dir ? { key: c.key, dir } : null)}
                            onFilter={(f) => setColFilter(c.key, f)}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shown.map((s) => (
                      <tr key={s.id} onClick={() => onOpenSession?.(s.id)} className="cursor-pointer transition-colors duration-150 ease-out hover:bg-canvas">
                        <td className="min-w-[240px] px-5 py-3">
                          <div className="font-medium leading-5">{s.name}</div>
                          <div className="mt-0.5 text-xs text-muted">
                            {s.intervention} · {s.kind}
                          </div>
                        </td>
                        {multiPillar && (
                          <td className="px-3 py-3 text-left">
                            <PillarTag pillar={s.pillar} />
                          </td>
                        )}
                        <td className="whitespace-nowrap px-3 py-3 text-left text-body">{s.dates}</td>
                        <td className="px-3 py-3 text-left">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums">{s.registered || '—'}</td>
                        <td className="px-3 py-3 text-center tabular-nums">{s.attended || '—'}</td>
                        <td className="px-5 py-3 text-center tabular-nums">
                          {s.attended ? (
                            <span>
                              {s.feedback}
                              <span className="ml-1 text-xs text-muted">{Math.round((s.feedback / s.attended) * 100)}%</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rows on phones */}
              <ul className="divide-y divide-line md:hidden">
                {shown.map((s) => (
                  <li key={s.id} onClick={() => onOpenSession?.(s.id)} className="cursor-pointer px-4 py-3.5 active:bg-canvas">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-5">{s.name}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          {portal === 'admin' && <PillarTag pillar={s.pillar} />}
                          <span className="truncate">{s.dates}</span>
                        </div>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      {[
                        ['Registered', s.registered],
                        ['Attended', s.attended],
                        ['Feedback', s.feedback],
                      ].map(([k, v]) => (
                        <div key={k as string} className="rounded-md bg-canvas px-2.5 py-1.5">
                          <dt className="text-muted">{k}</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums">{v || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>

              {shown.length === 0 && (
                <EmptyState
                  compact
                  icon={CalendarX2}
                  title="No sessions match these filters"
                  body={filter === 'draft' && !colActive.length ? 'Drafts appear here until their forms are opened.' : 'Change the Pillar or Status filter, or reset them.'}
                  action={{ label: 'Reset filters', onClick: resetAll }}
                />
              )}

              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 sm:px-5">
                <button type="button" onClick={() => onNavigate?.('interventions')} className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                  View all interventions <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {(colActive.length > 0 || sort) && (
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {shown.length} of {byStatus.length} shown
                    <button type="button" onClick={clearCols} className="font-semibold text-brand-600 hover:underline">
                      Clear filters
                    </button>
                  </span>
                )}
              </div>
            </Panel>
        </div>
      )}
    </AppShell>
  )
}

const healthLabel = { good: 'On track', warn: 'Needs a look', bad: 'At risk' } as const

/** A filter dropdown for the navy table header: "Pillar: All pillars ▾", highlighted while set. */
function HeaderFilter({
  label,
  value,
  options,
  display,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  display: (v: string) => string
  onChange: (v: string) => void
}) {
  const active = value !== 'all'
  return (
    <Popover
      width="w-48"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150 ease-out ${
            active ? 'bg-white text-brand' : 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
          }`}
        >
          <span className={active ? 'text-brand/70' : 'text-white/60'}>{label}:</span>
          <span className="font-semibold">{display(value)}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ease-out ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    >
      {(close) => (
        <div className="p-1">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o)
                close()
              }}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-body hover:bg-canvas"
            >
              <span className="flex-1">{display(o)}</span>
              {o === value && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

function SinglePillar({ pillar, reached, prev }: { pillar: 'HENT' | 'HEMP' | 'HECO'; reached: number; prev: number }) {
  const s = pillarStats[pillar]
  return (
    <StatCards
      columns={4}
      items={[
        { label: 'People reached', value: reached, prev, icon: Users, hint: healthLabel[s.health], tip: 'Unique people who took part in a session of this pillar in the selected period' },
        { label: 'Sessions', value: s.sessions, icon: CalendarDays, tip: 'Sessions run or scheduled by this pillar' },
        { label: 'Open now', value: s.open, icon: DoorOpen, tip: 'Sessions whose forms are currently taking registrations or applications' },
        { label: 'Check-ins', value: s.attendances, icon: UserCheck, tip: 'Attendance records: QR check-ins, walk-ins and imported sheets' },
      ]}
    />
  )
}

const queue = [
  { session: 'SIE Cohort 4', pillar: 'HEMP' as const, done: 41, total: 64, due: 'Fri 14 Nov' },
  { session: 'Public Sector Fellowship 2026', pillar: 'HECO' as const, done: 6, total: 58, due: 'Mon 17 Nov' },
  { session: 'Mentorship Circle · Founders', pillar: 'HENT' as const, done: 42, total: 42, due: 'Closed' },
]

const applicants = [
  { id: 'CHII-000231', session: 'SIE Cohort 4', submitted: '2 Nov', words: 412 },
  { id: 'CHII-000284', session: 'SIE Cohort 4', submitted: '2 Nov', words: 380 },
  { id: 'CHII-000317', session: 'Public Sector Fellowship 2026', submitted: '4 Nov', words: 655 },
  { id: 'CHII-000341', session: 'SIE Cohort 4', submitted: '5 Nov', words: 298 },
  { id: 'CHII-000263', session: 'Public Sector Fellowship 2026', submitted: '6 Nov', words: 520 },
]

function ReviewerHome({ name, onNavigate }: { name: string; onNavigate?: (to: string) => void }) {
  const left = queue.reduce((n, q) => n + (q.total - q.done), 0)
  return (
    <div className="mx-auto max-w-[1100px] space-y-5 px-4 py-5 sm:px-5">
      <PageHeader
        crumbs={['Review', 'Queue']}
        title={`${left} applications to score`}
        description={`Hi ${name}, here's what's assigned to you.`}
        actions={
          <Button variant="primary" className="w-full sm:w-auto" onClick={() => onNavigate?.('applications')}>
            Score next <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />
      <Panel>
        <ul className="divide-y divide-line">
          {queue.map((q) => {
            const pct = Math.round((q.done / q.total) * 100)
            return (
              <li key={q.session} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_200px_110px] sm:px-5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{q.session}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <PillarTag pillar={q.pillar} /> Due {q.due}
                  </div>
                </div>
                <div className="col-span-2 row-start-2 flex items-center gap-2.5 sm:col-span-1 sm:row-start-auto">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                    <div className={`h-full rounded-full ${pct === 100 ? 'bg-good' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs tabular-nums text-muted">{pct}%</span>
                </div>
                <div className="col-start-2 row-start-1 text-right text-sm tabular-nums sm:col-start-auto sm:row-start-auto">
                  <span className="font-semibold">{q.done}</span>
                  <span className="text-muted"> / {q.total}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Next in queue</h2>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <EyeOff className="h-3.5 w-3.5" /> Identity hidden for reviewers
          </span>
        </div>
        <ul className="divide-y divide-line">
          {applicants.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className="font-mono text-[13px] font-medium text-brand">{a.id}</span>
              <span className="hidden min-w-0 flex-1 truncate text-sm text-body sm:block">{a.session}</span>
              <span className="ml-auto hidden text-xs text-muted md:block">
                {a.words} words · {a.submitted}
              </span>
              <Button className="ml-auto h-8 px-3 text-xs md:ml-0" onClick={() => onNavigate?.('applications')}>
                Score
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
