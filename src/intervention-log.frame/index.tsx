/**
 * Interventions → Activity log (HEMP and HECO portals): who did what to the pillar's sessions,
 * and when. Sessions created, forms opened and closed, applicant decisions, application scores,
 * attendance and sheet imports. Participants appear by CHII ID at most, never by name.
 */
import React, { useMemo, useState } from 'react'
import { CalendarCheck, CalendarPlus, Check, ClipboardCheck, FileInput, History, Lock, Pencil, Search, ShieldOff, Unlock, Users } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { EmptyState } from '../shared/components/EmptyState'
import { PageHeader, Panel } from '../shared/components/ui'
import { Pillar, Portal, Role, portalMeta, sessions } from '../shared/data/mela'
import { ACTION_LABEL, entriesFor, useLog, type LogAction } from '../shared/lib/interventionLog'

export const args = { role: 'pillar_staff', portal: 'hemp' }

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onOpenSession?: (id: string) => void
}

/** Pillars that have the log (the user asked for HEMP and HECO). */
export const LOG_PORTALS: Portal[] = ['hemp', 'heco']

const ICON: Record<LogAction, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  session_created: { icon: CalendarPlus, tone: 'text-brand-600 bg-brand-50' },
  form_opened: { icon: Unlock, tone: 'text-good bg-good-bg' },
  form_closed: { icon: Lock, tone: 'text-muted bg-canvas' },
  form_draft: { icon: Pencil, tone: 'text-warn bg-warn-bg' },
  applicants_decided: { icon: Users, tone: 'text-brand-600 bg-brand-50' },
  application_scored: { icon: ClipboardCheck, tone: 'text-good bg-good-bg' },
  attendance_marked: { icon: CalendarCheck, tone: 'text-good bg-good-bg' },
  sheet_imported: { icon: FileInput, tone: 'text-brand-600 bg-brand-50' },
}

const FILTERS: { key: string; label: string; actions: LogAction[] }[] = [
  { key: 'sessions', label: 'Sessions', actions: ['session_created'] },
  { key: 'forms', label: 'Forms', actions: ['form_opened', 'form_closed', 'form_draft'] },
  { key: 'applicants', label: 'Applicants', actions: ['applicants_decided', 'application_scored'] },
  { key: 'attendance', label: 'Attendance', actions: ['attendance_marked'] },
  { key: 'imports', label: 'Imports', actions: ['sheet_imported'] },
]

const PAGE = 15
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

export default function InterventionLog(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut, onOpenSession } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hemp' : p) as Portal
  const all = useLog()
  const [filter, setFilter] = useState('all')
  const [session, setSession] = useState('all')
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)

  const allowed = LOG_PORTALS.includes(portal)
  const pillar = portal.toUpperCase() as Pillar
  const mine = useMemo(() => (allowed ? entriesFor(all, pillar) : []), [all, pillar, allowed])
  const sessionNames = [...new Set(mine.map((x) => x.session).filter(Boolean) as string[])].sort()
  const f = FILTERS.find((x) => x.key === filter)
  const list = mine.filter(
    (x) =>
      (!f || f.actions.includes(x.action)) &&
      (session === 'all' || x.session === session) &&
      (!q.trim() || `${x.by} ${x.detail} ${x.session ?? ''} ${ACTION_LABEL[x.action]}`.toLowerCase().includes(q.trim().toLowerCase())),
  )
  const visible = list.slice(0, shown)
  const people = new Set(mine.map((x) => x.by)).size
  const reset = () => setShown(PAGE)

  return (
    <AppShell role={role} portal={portal} active="interventions-log" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
        {!allowed ? (
          <div className="grid min-h-[50vh] place-items-center">
            <EmptyState icon={ShieldOff} title="No activity log here" body="The Interventions activity log is in the HEMP and HECO portals." action={{ label: 'Go to interventions', onClick: () => onNavigate?.('interventions') }} />
          </div>
        ) : (
          <>
            <PageHeader
              crumbs={[portalMeta[portal].label, 'Interventions', 'Activity Log']}
              title="Interventions Activity Log"
              description={`Who did what to ${portalMeta[portal].label}’s sessions, and when: ${mine.length} actions by ${people} ${people === 1 ? 'person' : 'people'}. Participants appear by CHII ID only.`}
            />

            <Panel>
              <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
                <div className="flex flex-wrap gap-1.5">
                  <Chip on={filter === 'all'} onClick={() => (setFilter('all'), reset())}>
                    All <Count n={mine.length} on={filter === 'all'} />
                  </Chip>
                  {FILTERS.map((x) => (
                    <Chip key={x.key} on={filter === x.key} onClick={() => (setFilter(x.key), reset())}>
                      {x.label} <Count n={mine.filter((m) => x.actions.includes(m.action)).length} on={filter === x.key} />
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:ml-auto">
                  <select value={session} onChange={(e) => (setSession(e.target.value), reset())} aria-label="Session" className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-brand-600">
                    <option value="all">All sessions</option>
                    {sessionNames.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <label className="relative min-w-0 sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                    <input
                      value={q}
                      onChange={(e) => (setQ(e.target.value), reset())}
                      placeholder="Search who or what"
                      className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                    />
                  </label>
                </div>
              </div>

              {list.length === 0 ? (
                <EmptyState compact icon={History} title={mine.length ? 'Nothing matches these filters' : 'Nothing recorded yet'} body={mine.length ? 'Try another filter, session or search.' : 'Actions on this pillar’s sessions appear here.'} />
              ) : (
                <ol>
                  {visible.map((x, i) => {
                    const { icon: Icon, tone } = ICON[x.action]
                    const newDay = i === 0 || dayOf(visible[i - 1].at) !== dayOf(x.at)
                    const s = sessions.find((se) => se.name === x.session)
                    return (
                      <React.Fragment key={x.id}>
                        {newDay && <li className="border-b border-line bg-canvas px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{dayOf(x.at)}</li>}
                        <li className="flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-0">
                          <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-ink">{x.detail}</span>
                            <span className="block text-xs text-muted">
                              <b className="font-semibold text-body">{x.by}</b> · {timeOf(x.at)} · {ACTION_LABEL[x.action]}
                            </span>
                          </span>
                          {x.session &&
                            (s ? (
                              <button type="button" onClick={() => onOpenSession?.(s.id)} className="hidden max-w-[260px] shrink-0 truncate rounded-md px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50 sm:block">
                                {x.session}
                              </button>
                            ) : (
                              <span className="hidden max-w-[260px] shrink-0 truncate px-2 py-0.5 text-xs text-muted sm:block">{x.session}</span>
                            ))}
                        </li>
                      </React.Fragment>
                    )
                  })}
                </ol>
              )}
              {list.length > shown && (
                <div className="border-t border-line px-4 py-2.5 text-center">
                  <button type="button" onClick={() => setShown((n) => n + PAGE)} className="text-xs font-semibold text-brand-600 hover:underline">
                    Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}
                  </button>
                </div>
              )}
            </Panel>
            <p className="flex items-center gap-1.5 text-xs text-faint">
              <Check className="h-3.5 w-3.5" /> New actions on {portalMeta[portal].label}’s sessions are added as they happen, with the name of whoever made them.
            </p>
          </>
        )}
      </div>
    </AppShell>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${on ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-body hover:bg-canvas'}`}>
      {children}
    </button>
  )
}

const Count = ({ n, on }: { n: number; on: boolean }) => <span className={`tabular-nums ${on ? 'text-white/80' : 'text-faint'}`}>{n}</span>
