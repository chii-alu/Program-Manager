import React, { useState } from 'react'
import { AlertTriangle, ArrowRight, CalendarDays, ChevronRight, CircleAlert, DoorOpen, Plus, QrCode, EyeOff, UserCheck, Users } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel, PillarTag, StatusBadge } from '../shared/components/ui'
import { Portal, Role, SessionStatus, attention, pillarStats, pillarsFor, portalMeta, roleMeta, sessions } from '../shared/data/mela'
import { CountUp, Delta, StatCards } from '../shared/components/StatStrip'
import { EmptyState } from '../shared/components/EmptyState'
import { previous, seriesFor, totals, useTimeRange } from '../shared/lib/time'
import { CalendarX2, CheckCircle2 } from 'lucide-react'
import { NewSessionModal } from '../shared/components/NewSessionModal'
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

const filters: ('all' | SessionStatus)[] = ['all', 'open', 'upcoming', 'completed', 'draft']

export default function Overview(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut, onOpenSession } = { ...args, ...props }
  const [newOpen, setNewOpen] = useState(false)
  const nav = (to: string) => (to === 'new-session' ? setNewOpen(true) : onNavigate?.(to))
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const [filter, setFilter] = useState<(typeof filters)[number]>('all')
  const pillars = pillarsFor(portal)
  const mine = sessions.filter((s) => pillars.includes(s.pillar))
  const shown = mine.filter((s) => filter === 'all' || s.status === filter)
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
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <CircleAlert className="h-4 w-4 text-warn" /> Needs attention
                </h2>
                <span className="rounded-full bg-warn-bg px-2 text-xs font-semibold tabular-nums text-warn">{todo.length}</span>
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
              headerRight={
                <Legend
                  onDark
                  items={[
                    { label: 'Registered', color: 'var(--color-sky)' },
                    { label: 'Attended', color: 'var(--color-navy)' },
                  ]}
                />
              }
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
            </Panel>

            {/* All sessions: the primary panel */}
            <Panel>
              <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <h2 className="text-sm font-semibold">
                  All sessions <span className="ml-1 font-normal text-muted tabular-nums">{mine.length}</span>
                </h2>
                <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <div className="flex w-max gap-1 rounded-lg bg-canvas p-0.5">
                    {filters.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={`h-7 rounded-md px-2.5 text-xs font-medium capitalize transition-colors duration-150 ease-out ${
                          filter === f ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table on tablet and up */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-5 py-2.5 font-medium">Session</th>
                      <th className="px-3 py-2.5 font-medium">Dates</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 text-right font-medium">Reg.</th>
                      <th className="px-3 py-2.5 text-right font-medium">Attended</th>
                      <th className="px-5 py-2.5 text-right font-medium">Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shown.map((s) => (
                      <tr key={s.id} onClick={() => onOpenSession?.(s.id)} className="cursor-pointer transition-colors duration-150 ease-out hover:bg-canvas">
                        <td className="max-w-0 px-5 py-3">
                          <div className="truncate font-medium">{s.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                            {portal === 'admin' && <PillarTag pillar={s.pillar} />}
                            <span className="truncate">
                              {s.intervention} · {s.kind}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-body">{s.dates}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{s.registered || '—'}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{s.attended || '—'}</td>
                        <td className="px-5 py-3 text-right tabular-nums">
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
                        <div className="truncate text-sm font-medium">{s.name}</div>
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
                  title={`No ${filter} sessions`}
                  body={filter === 'draft' ? 'Drafts appear here until their forms are opened.' : 'Try another status, or create a session.'}
                  action={{ label: 'Show all sessions', onClick: () => setFilter('all') }}
                />
              )}

              <div className="border-t border-line px-4 py-2.5 sm:px-5">
                <button type="button" onClick={() => onNavigate?.('interventions')} className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                  View all interventions <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </Panel>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

const healthLabel = { good: 'On track', warn: 'Needs a look', bad: 'At risk' } as const

function SinglePillar({ pillar, reached, prev }: { pillar: 'HENT' | 'HEMP' | 'HECO'; reached: number; prev: number }) {
  const s = pillarStats[pillar]
  return (
    <StatCards
      columns={4}
      items={[
        { label: 'People reached', value: reached, prev, icon: Users, hint: healthLabel[s.health] },
        { label: 'Sessions', value: s.sessions, icon: CalendarDays },
        { label: 'Open now', value: s.open, icon: DoorOpen },
        { label: 'Check-ins', value: s.attendances, icon: UserCheck },
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
