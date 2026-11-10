import React, { useState } from 'react'
import { CheckCircle2, EyeOff, PartyPopper, Search } from 'lucide-react'
import { EmptyState } from '../shared/components/EmptyState'
import { notify } from '../shared/lib/notify'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { Modal } from '../shared/components/Modal'
import { Portal, Role, applications, portalMeta } from '../shared/data/mela'

export const args = {
  role: 'reviewer',
  portal: 'hemp',
  selected: 'CHII-000231',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

const criteria = [
  { id: 'motivation', label: 'Motivation', hint: 'Clear reason to join, tied to health' },
  { id: 'fit', label: 'Programme fit', hint: 'Will benefit from this intervention now' },
  { id: 'experience', label: 'Relevant experience', hint: 'Projects, clubs, work or study' },
  { id: 'communication', label: 'Communication', hint: 'Clear, specific, well-argued' },
]

export default function Applications(props: Props) {
  const { role: r, portal: p, selected, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hemp' : p) as Portal
  const [scores, setScores] = useState<Record<string, number | null>>(() => {
    const o: Record<string, number | null> = {}
    applications.forEach((a) => (o[a.id] = a.score))
    return o
  })
  const [active, setActive] = useState(selected)
  const [mobileOpen, setMobileOpen] = useState(false)
  const app = applications.find((a) => a.id === active) ?? applications[0]
  const left = applications.filter((a) => scores[a.id] == null).length
  const [q, setQ] = useState('')
  const [show, setShow] = useState<'all' | 'todo' | 'done'>('all')
  const [sessionF, setSessionF] = useState('all')
  const sessionList = Array.from(new Set(applications.map((a) => a.session)))
  const list = applications.filter(
    (a) =>
      (show === 'all' || (show === 'todo') === (scores[a.id] == null)) &&
      (sessionF === 'all' || a.session === sessionF) &&
      `${a.id} ${a.motivation}`.toLowerCase().includes(q.toLowerCase()),
  )

  const submit = (total: number) => {
    const next = { ...scores, [app.id]: total }
    setScores(next)
    const remaining = applications.filter((a) => next[a.id] == null).length
    notify({ title: `Scored ${app.id} · ${total}/20`, body: remaining ? `${remaining} left in your queue` : 'Your queue is clear', tone: remaining ? 'info' : 'good', to: 'applications' })
    const upcoming = applications.find((a) => next[a.id] == null)
    if (upcoming) setActive(upcoming.id)
    else setMobileOpen(false)
  }

  return (
    <AppShell role={role} portal={portal} active="applications" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1240px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <PageHeader
          crumbs={[portalMeta[portal].label, 'Applications']}
          title="Applications"
          description={
            <span className="inline-flex items-center gap-1.5">
              {left} left to score · <EyeOff className="h-3.5 w-3.5" /> identity hidden
            </span>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Panel className="self-start">
            <div className="space-y-2 border-b border-line p-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search CHII ID or answer text" className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100" />
              </label>
              <div className="flex gap-2">
                <div className="flex flex-1 gap-0.5 rounded-lg bg-canvas p-0.5">
                  {([
                    ['all', 'All'],
                    ['todo', `To score ${left}`],
                    ['done', 'Scored'],
                  ] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setShow(k)} className={`h-8 flex-1 whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors duration-150 ease-out ${show === k ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <select value={sessionF} onChange={(e) => setSessionF(e.target.value)} aria-label="Session" className={`h-9 w-full rounded-lg border bg-surface px-2.5 text-sm outline-none ${sessionF !== 'all' ? 'border-brand-200 bg-brand-50 text-brand-600' : 'border-line-strong text-body'}`}>
                <option value="all">All sessions</option>
                {sessionList.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            {list.length === 0 &&
              (show === 'todo' && !q && sessionF === 'all' ? (
                <EmptyState compact icon={PartyPopper} title="Queue cleared" body="Every application assigned to you has a score." action={{ label: 'Review scored ones', onClick: () => setShow('done') }} />
              ) : (
                <EmptyState compact icon={Search} title="No applications match" action={{ label: 'Clear filters', onClick: () => (setQ(''), setShow('all'), setSessionF('all')) }} />
              ))}
            <ul className="divide-y divide-line">
              {list.map((a) => {
                const s = scores[a.id]
                const on = a.id === active
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActive(a.id)
                        setMobileOpen(true)
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out ${on ? 'lg:bg-brand-50' : 'hover:bg-canvas'}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={`block font-mono text-[13px] font-medium ${on ? 'text-brand-600' : ''}`}>{a.id}</span>
                        <span className="block truncate text-xs text-muted">
                          {a.session} · {a.submitted}
                        </span>
                      </span>
                      {s != null ? (
                        <span className="text-sm font-semibold tabular-nums">
                          {s}
                          <span className="text-xs font-normal text-muted">/20</span>
                        </span>
                      ) : (
                        <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-medium text-warn">To score</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel className="hidden self-start lg:block">
            <ScoreForm key={app.id} app={app} existing={scores[app.id]} onSubmit={submit} />
          </Panel>
        </div>
      </div>

      <div className="lg:hidden">
        <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title={app.id} description={app.session} size="lg">
          <ScoreForm key={app.id} app={app} existing={scores[app.id]} onSubmit={submit} bare />
        </Modal>
      </div>
    </AppShell>
  )
}

const ScoreForm: React.FC<{ app: (typeof applications)[number]; existing: number | null; onSubmit: (n: number) => void; bare?: boolean }> = ({ app, existing, onSubmit, bare }) => {
  const [vals, setVals] = useState<Record<string, number>>({})
  const total = criteria.reduce((n, c) => n + (vals[c.id] ?? 0), 0)
  const complete = criteria.every((c) => vals[c.id])
  return (
    <div>
      {!bare && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          <div>
            <div className="font-mono text-sm font-semibold text-brand-600">{app.id}</div>
            <div className="text-xs text-muted">
              {app.session} · submitted {app.submitted}
            </div>
          </div>
          {existing != null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-good">
              <CheckCircle2 className="h-3.5 w-3.5" /> You scored {existing}/20
            </span>
          )}
        </div>
      )}
      <div className={bare ? '' : 'px-5 py-4'}>
        <h3 className="text-xs font-medium text-muted">Why do you want to join?</h3>
        <p className="mt-1.5 text-[15px] leading-7 text-ink">{app.motivation}</p>

        <div className="mt-5 space-y-4 border-t border-line pt-4">
          {criteria.map((c) => (
            <div key={c.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-muted">{c.hint}</div>
              </div>
              <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={c.label}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={vals[c.id] === n}
                    onClick={() => setVals({ ...vals, [c.id]: n })}
                    className={`h-9 rounded-md border text-sm font-semibold tabular-nums transition-colors duration-150 ease-out sm:w-10 ${
                      vals[c.id] === n ? 'border-brand-600 bg-brand text-white' : 'border-line-strong text-body hover:bg-canvas'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-medium">Notes for the panel</span>
          <textarea rows={3} placeholder="Optional, visible to other reviewers" className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100" />
        </label>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <div className="text-sm">
            <span className="text-2xl font-semibold tabular-nums">{total}</span>
            <span className="text-muted"> / 20</span>
          </div>
          <Button variant="primary" onClick={() => complete && onSubmit(total)} className={complete ? '' : 'pointer-events-none opacity-50'}>
            Submit & next
          </Button>
        </div>
      </div>
    </div>
  )
}
