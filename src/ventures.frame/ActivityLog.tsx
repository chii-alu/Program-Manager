/**
 * The registry's activity log: who did what, and when, for registrations and update rounds.
 * Entries never name founders; they name the venture (by ID) and the staff member or form.
 */
import React, { useState } from 'react'
import { BellRing, CalendarClock, Check, FileInput, History, Inbox, Link2, Lock, Send, Unlock, X } from 'lucide-react'
import type { ActivityEntry, RegistryData } from '../shared/ventures/types'
import { Chip } from './parts'

const ICON: Record<ActivityEntry['action'], { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  registration_received: { icon: Inbox, tone: 'text-brand-600 bg-brand-50' },
  registration_accepted: { icon: Check, tone: 'text-good bg-good-bg' },
  registration_declined: { icon: X, tone: 'text-bad bg-bad-bg' },
  form_opened: { icon: Unlock, tone: 'text-good bg-good-bg' },
  form_closed: { icon: Lock, tone: 'text-muted bg-canvas' },
  links_created: { icon: Link2, tone: 'text-brand-600 bg-brand-50' },
  links_sent: { icon: Send, tone: 'text-brand-600 bg-brand-50' },
  links_reminded: { icon: BellRing, tone: 'text-warn bg-warn-bg' },
  founder_update_received: { icon: FileInput, tone: 'text-brand-600 bg-brand-50' },
  update_accepted: { icon: Check, tone: 'text-good bg-good-bg' },
  schedule_changed: { icon: CalendarClock, tone: 'text-muted bg-canvas' },
}

export type LogFilter = { key: string; label: string; actions: ActivityEntry['action'][] }

const when = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export function ActivityLog({
  data,
  area,
  filters,
  onOpen,
  pageSize = 12,
}: {
  data: RegistryData
  area: ActivityEntry['area']
  filters: LogFilter[]
  onOpen: (ventureId: string) => void
  pageSize?: number
}) {
  const [filter, setFilter] = useState('all')
  const [shown, setShown] = useState(pageSize)
  const all = (data.activity ?? []).filter((e) => e.area === area).sort((a, b) => b.at.localeCompare(a.at))
  const f = filters.find((x) => x.key === filter)
  const list = f ? all.filter((e) => f.actions.includes(e.action)) : all
  const code = (id?: string) => (id ? data.ventures.find((v) => v.id === id)?.code : undefined)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-3">
        <Chip on={filter === 'all'} onClick={() => (setFilter('all'), setShown(pageSize))}>
          All <span className={`tabular-nums ${filter === 'all' ? 'text-white/80' : 'text-faint'}`}>{all.length}</span>
        </Chip>
        {filters.map((x) => {
          const n = all.filter((e) => x.actions.includes(e.action)).length
          return (
            <Chip key={x.key} on={filter === x.key} onClick={() => (setFilter(x.key), setShown(pageSize))}>
              {x.label} <span className={`tabular-nums ${filter === x.key ? 'text-white/80' : 'text-faint'}`}>{n}</span>
            </Chip>
          )
        })}
      </div>
      {list.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
          <History className="h-4 w-4" /> Nothing recorded yet.
        </p>
      ) : (
        <ol className="divide-y divide-line">
          {list.slice(0, shown).map((e) => {
            const { icon: Icon, tone } = ICON[e.action]
            const c = code(e.ventureId)
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{e.detail}</span>
                  <span className="block text-xs text-muted">
                    <b className="font-semibold text-body">{e.by}</b> · {when(e.at)}
                  </span>
                </span>
                {c && (
                  <button type="button" onClick={() => onOpen(e.ventureId!)} className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs font-medium text-brand-600 hover:bg-brand-50">
                    {c}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {list.length > shown && (
        <div className="border-t border-line px-4 py-2.5 text-center">
          <button type="button" onClick={() => setShown((n) => n + pageSize)} className="text-xs font-semibold text-brand-600 hover:underline">
            Show {Math.min(pageSize, list.length - shown)} more of {list.length - shown}
          </button>
        </div>
      )}
    </div>
  )
}
