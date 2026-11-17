/**
 * Ventures → Activity log: who did what in the registry's shared workflows, and when.
 * Registrations (received, accepted, declined, form opened or closed) and update rounds (links
 * created, sent and reminded, founder answers, updates accepted, schedule changes).
 * Edits to a single venture stay on that venture's History tab.
 */
import React, { useState } from 'react'
import { PageHeader, Panel } from '../shared/components/ui'
import type { RegistryData } from '../shared/ventures/types'
import { ActivityLog, type LogFilter } from './ActivityLog'

type Area = 'all' | 'registrations' | 'updates'

const FILTERS: Record<Area, LogFilter[]> = {
  // The tabs already split registrations from update rounds, so Everything needs no chips.
  all: [],
  registrations: [
    { key: 'received', label: 'Received', actions: ['registration_received'] },
    { key: 'accepted', label: 'Accepted', actions: ['registration_accepted'] },
    { key: 'declined', label: 'Declined', actions: ['registration_declined'] },
    { key: 'form', label: 'Form opened / closed', actions: ['form_opened', 'form_closed'] },
  ],
  updates: [
    { key: 'links', label: 'Links created / sent', actions: ['links_created', 'links_sent'] },
    { key: 'reminders', label: 'Reminders', actions: ['links_reminded'] },
    { key: 'answers', label: 'Founder answers', actions: ['founder_update_received'] },
    { key: 'accepted', label: 'Accepted', actions: ['update_accepted'] },
    { key: 'schedule', label: 'Schedule', actions: ['schedule_changed'] },
  ],
}

export function VentureActivity({ data, onOpen }: { data: RegistryData; onOpen: (id: string) => void }) {
  const [area, setArea] = useState<Area>('all')
  const n = (a: Area) => (data.activity ?? []).filter((e) => a === 'all' || e.area === a).length
  return (
    <>
      <PageHeader
        crumbs={['HENT', 'Ventures', 'Activity log']}
        title="Venture Activity Log"
        description="Who did what in the registry, and when: registrations from the public form and the founder update rounds. Founders are never named; ventures appear by ID. Changes to one venture are on its History tab."
      />
      <Panel>
        <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3">
          {(
            [
              ['all', 'Everything'],
              ['registrations', 'Registrations'],
              ['updates', 'Update rounds'],
            ] as [Area, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={area === k}
              onClick={() => setArea(k)}
              className={`relative flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] font-medium ${area === k ? 'text-ink' : 'text-muted hover:text-ink'}`}
            >
              {label}
              <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${area === k ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-muted'}`}>{n(k)}</span>
              {area === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </button>
          ))}
        </div>
        {/* key: switching area starts the filters and paging afresh */}
        <ActivityLog key={area} data={data} area={area} onOpen={onOpen} filters={FILTERS[area]} pageSize={20} />
      </Panel>
    </>
  )
}
