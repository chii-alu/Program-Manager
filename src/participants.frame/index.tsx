import React, { useMemo } from 'react'
import { ExternalLink, Mail, UserRound, Users } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { PageHeader, PillarTag } from '../shared/components/ui'
import { Column, DataTable } from '../shared/components/DataTable'
import { StatStrip } from '../shared/components/StatStrip'
import { Participant, Portal, Role, canSeeIdentity, participants, pillarsFor, portalMeta } from '../shared/data/mela'
import { inRange, previous, useTimeRange } from '../shared/lib/time'
import { toast } from '../shared/lib/notify'

export const args = {
  role: 'admin',
  portal: 'admin',
}

export const argTypes = {
  role: { control: 'select', options: ['admin', 'pillar_lead', 'pillar_staff', 'reviewer', 'none'] },
  portal: { control: 'radio', options: ['admin', 'hent', 'hemp', 'heco'] },
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onOpenPerson?: (id: string) => void
}

export default function Participants(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut, onOpenPerson } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const showId = canSeeIdentity(role)
  const scope = pillarsFor(portal)
  const { range, label } = useTimeRange()

  const inScope = useMemo(() => participants.filter((x) => x.pillars.some((pl) => scope.includes(pl))), [portal])
  const rows = useMemo(() => inScope.filter((x) => inRange(range, x.lastActive)), [inScope, range])
  const prevRows = useMemo(() => inScope.filter((x) => inRange(previous(range), x.lastActive)), [inScope, range])
  const fresh = rows.filter((x) => inRange(range, x.joined)).length
  const cross = rows.filter((x) => x.pillars.length > 1).length
  const avgAtt = rows.length ? Math.round(rows.reduce((n, x) => n + x.attendance, 0) / rows.length) : 0

  const columns: Column<Participant>[] = [
    { key: 'id', label: 'CHII ID', render: (x) => <span className="font-mono text-[13px] font-medium text-brand-600">{x.id}</span> },
    {
      key: 'name',
      label: 'Name',
      restricted: true,
      filterable: false,
      render: (x) => (
        <div className="max-w-[220px]">
          <div className="truncate font-medium">{x.name}</div>
          <div className="truncate text-xs text-muted">{x.email}</div>
        </div>
      ),
    },
    { key: 'email', label: 'Email', restricted: true, exportOnly: true },
    { key: 'gender', label: 'Gender', value: (x) => (x.gender === 'F' ? 'Female' : 'Male') },
    { key: 'age', label: 'Age', numeric: true, hideBelow: 'lg' },
    { key: 'country', label: 'Country' },
    {
      key: 'pillars',
      label: 'Pillars',
      value: (x) => x.pillars.join(' + '),
      render: (x) => (
        <div className="flex gap-1">
          {x.pillars.map((pl) => (
            <PillarTag key={pl} pillar={pl} />
          ))}
        </div>
      ),
    },
    { key: 'interventions', label: 'Interventions', value: (x) => x.interventions.join(', '), hideBelow: 'xl', render: (x) => <span className="block max-w-[200px] truncate text-body">{x.interventions.join(', ')}</span> },
    { key: 'status', label: 'Status', render: (x) => <StatusPill s={x.status} /> },
    { key: 'sessions', label: 'Sessions', numeric: true },
    { key: 'attendance', label: 'Attendance', numeric: true, value: (x) => x.attendance, render: (x) => <Attendance pct={x.attendance} /> },
    { key: 'lastActive', label: 'Last active', hideBelow: 'lg', filterable: false },
  ]

  return (
    <AppShell role={role} portal={portal} active="participants" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1240px] space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <PageHeader
          crumbs={[portalMeta[portal].label, 'CHII Participants']}
          title="CHII Participants"
          description={
            <>
              People active in <span className="font-medium text-ink">{label.toLowerCase()}</span>
              {portal === 'admin' ? ' across all pillars' : ` linked to ${portalMeta[portal].label}`}. One row per person.
              {!showId && ' Names are hidden for your role.'}
            </>
          }
        />

        <StatStrip
          items={[
            { label: 'Active people', value: rows.length, prev: prevRows.length, primary: true },
            { label: 'New this period', value: fresh, hint: 'first registration in range' },
            { label: 'Cross-pillar', value: cross, hint: `${rows.length ? Math.round((cross / rows.length) * 100) : 0}% of active` },
            { label: 'Avg. attendance', value: avgAtt, suffix: '%' },
          ]}
        />

        <DataTable
          title={`CHII Participants · ${portalMeta[portal].label}`}
          rows={rows}
          columns={columns}
          rowKey={(x) => x.id}
          canSeeRestricted={showId}
          onRowClick={(x) => onOpenPerson?.(x.id)}
          searchPlaceholder={showId ? 'Search name, email, CHII ID or country' : 'Search CHII ID or country'}
          initialSort={{ key: 'lastActive', dir: -1 }}
          empty={{ title: 'No one was active in this period', body: 'Widen the time filter in the top bar to see more people.' }}
          rowActions={[
            { label: 'Open profile', icon: UserRound, onClick: (x) => onOpenPerson?.(x.id) },
            { label: 'Copy CHII ID', icon: ExternalLink, onClick: (x) => (navigator.clipboard?.writeText(x.id), toast({ title: `Copied ${x.id}`, tone: 'info' })) },
            ...(showId ? [{ label: 'Email person', icon: Mail, onClick: (x: Participant) => window.open(`mailto:${x.email}`) }] : []),
          ]}
          mobileRow={(x) => (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{showId ? x.name : x.id}</span>
                  <span className="flex shrink-0 gap-1">
                    {x.pillars.map((pl) => (
                      <PillarTag key={pl} pillar={pl} />
                    ))}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted">
                  {showId && <span className="font-mono text-brand-600">{x.id} · </span>}
                  {x.country} · {x.sessions} session{x.sessions === 1 ? '' : 's'}
                </div>
              </div>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${tone(x.attendance)}`}>{x.attendance}%</span>
            </div>
          )}
          emptyIcon={Users}
        />
      </div>
    </AppShell>
  )
}

const tone = (pct: number) => (pct >= 75 ? 'text-good' : pct >= 50 ? 'text-warn' : 'text-bad')

function StatusPill({ s }: { s: Participant['status'] }) {
  const c = s === 'Active' ? 'bg-good-bg text-good' : s === 'Alumni' ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-muted'
  return <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${c}`}>{s}</span>
}

function Attendance({ pct }: { pct: number }) {
  return (
    <div className="ml-auto flex w-28 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
        <div className={`h-full rounded-full ${pct >= 75 ? 'bg-good' : pct >= 50 ? 'bg-warn' : 'bg-bad'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-body">{pct}%</span>
    </div>
  )
}
