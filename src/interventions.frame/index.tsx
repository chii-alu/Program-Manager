import React, { useState } from 'react'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel, StatusBadge } from '../shared/components/ui'
import { NewSessionModal } from '../shared/components/NewSessionModal'
import { Portal, Role, interventions, participants, pillarsFor, portalMeta, sessions } from '../shared/data/mela'
import { EmptyState } from '../shared/components/EmptyState'
import { inRange, useTimeRange } from '../shared/lib/time'

export const args = {
  role: 'admin',
  portal: 'admin',
  newSession: false,
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onOpenSession?: (id: string) => void
  onCloseNew?: () => void
}

export default function Interventions(props: Props) {
  const { role: r, portal: p, newSession, onNavigate, onPortalChange, onSignOut, onOpenSession, onCloseNew } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const pillars = pillarsFor(portal)
  const [open, setOpen] = useState<string | null>('i5')
  const [kind, setKind] = useState<'all' | 'open' | 'selective'>('all')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(newSession)
  const reduce = useReducedMotion()
  const { range, label } = useTimeRange()
  const activeBy = (name: string) => participants.filter((x) => x.interventions.includes(name) && inRange(range, x.lastActive)).length

  const list = interventions.filter((i) => pillars.includes(i.pillar) && (kind === 'all' || i.kind === kind) && i.name.toLowerCase().includes(q.toLowerCase()))
  const nav = (to: string) => (to === 'new-session' ? setModal(true) : onNavigate?.(to))

  return (
    <AppShell role={role} portal={portal} active="interventions" onNavigate={nav} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <NewSessionModal
        open={modal}
        pillars={pillars}
        onClose={() => {
          setModal(false)
          onCloseNew?.()
        }}
      />
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
        <PageHeader
          crumbs={[portalMeta[portal].label, 'Interventions']}
          title="Interventions"
          description={`${list.length} interventions · people active in ${label.toLowerCase()} · open ones take registrations, selective ones take applications.`}
          actions={
            <Button variant="primary" className="w-full sm:w-auto" onClick={() => setModal(true)}>
              <Plus className="h-4 w-4" /> New session
            </Button>
          }
        />

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search interventions"
              className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-faint focus:border-brand-600 focus:ring-3 focus:ring-brand-100"
            />
          </label>
          <div className="flex gap-0.5 rounded-lg bg-surface p-0.5 shadow-[0_0_0_1px_var(--color-line)]">
            {(['all', 'open', 'selective'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`h-8 flex-1 rounded-md px-3 text-xs font-medium capitalize transition-colors duration-150 ease-out sm:flex-none ${
                  kind === k ? 'bg-brand-50 text-brand-600' : 'text-muted hover:text-ink'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {pillars.map((pl) => {
          const rows = list.filter((i) => i.pillar === pl)
          if (!rows.length) return null
          return (
            <section key={pl}>
              {pillars.length > 1 && (
                <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  {pl} <span className="text-xs font-normal text-muted">{portalMeta[pl.toLowerCase() as Portal].full}</span>
                </h2>
              )}
              <Panel>
                <div className="hidden grid-cols-[minmax(0,1fr)_100px_80px_90px_140px_24px] gap-4 border-b border-line px-5 py-2.5 text-xs text-muted md:grid">
                  <span>Intervention</span>
                  <span>Type</span>
                  <span className="text-right">Sessions</span>
                  <span className="text-right" title={`Active in ${label.toLowerCase()}`}>Active</span>
                  <span>Completion</span>
                  <span />
                </div>
                <ul className="divide-y divide-line">
                  {rows.map((i) => {
                    const isOpen = open === i.id
                    const runs = sessions.filter((s) => s.intervention === i.name)
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : i.id)}
                          aria-expanded={isOpen}
                          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-canvas md:grid-cols-[minmax(0,1fr)_100px_80px_90px_140px_24px] md:px-5"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{i.name}</span>
                            <span className="block text-xs text-muted md:hidden">
                              {i.kind} · {i.sessions} sessions · {activeBy(i.name)} active
                            </span>
                            <span className="hidden text-xs text-muted md:block">Last session {i.last}</span>
                          </span>
                          <span className="hidden md:block">
                            <KindTag kind={i.kind} />
                          </span>
                          <span className="hidden text-right text-sm tabular-nums md:block">{i.sessions}</span>
                          <span className="hidden text-right text-sm tabular-nums md:block">{activeBy(i.name)}</span>
                          <span className="hidden items-center gap-2 md:flex">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${i.completion}%` }} />
                            </span>
                            <span className="w-9 text-right text-xs tabular-nums text-muted">{i.completion ? `${i.completion}%` : '—'}</span>
                          </span>
                          <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ease-out ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-line bg-canvas/60 px-4 py-3 md:px-5">
                                {runs.length ? (
                                  <ul className="space-y-1.5">
                                    {runs.map((s) => (
                                      <li key={s.id}>
                                        <button
                                          type="button"
                                          onClick={() => onOpenSession?.(s.id)}
                                          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors duration-150 ease-out hover:border-line-strong"
                                        >
                                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                                          <span className="text-xs text-muted">{s.dates}</span>
                                          <span className="text-xs tabular-nums text-muted">{s.registered} reg.</span>
                                          <StatusBadge status={s.status} />
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-muted">Past sessions are archived. Start a new run to collect registrations.</p>
                                )}
                                <button type="button" onClick={() => setModal(true)} className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
                                  <Plus className="h-4 w-4" /> Add a session to {i.name}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            </section>
          )
        })}
        {list.length === 0 && (
          <Panel>
            <EmptyState icon={Search} title={q ? `No interventions match “${q}”` : `No ${kind} interventions here`} body="Clear the search or switch the type filter." action={{ label: 'Clear filters', onClick: () => (setQ(''), setKind('all')) }} />
          </Panel>
        )}
      </div>
    </AppShell>
  )
}

function KindTag({ kind }: { kind: 'open' | 'selective' }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium capitalize ${kind === 'open' ? 'bg-canvas text-body' : 'bg-brand-50 text-brand-600'}`}>
      {kind}
    </span>
  )
}

