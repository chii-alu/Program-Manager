/**
 * HENT Ventures: Registry | Analytics | Updates | Import (VENTURE-REGISTRY-SPEC).
 * HENT staff and the MELA admin only; everyone else gets "no access", even with a direct link.
 */
import React, { useEffect, useState } from 'react'
import { BarChart3, Clock, FileUp, Plus, RefreshCw, ShieldOff } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { EmptyState } from '../shared/components/EmptyState'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { Portal, Role, canSeeIdentity, pillarsFor, portalMeta, roleMeta } from '../shared/data/mela'
import { canUseVentures, useRegistry } from '../shared/ventures/store'
import { Registry } from './Registry'
import { VentureForm } from './VentureForm'
import { VenturePage } from './VenturePage'
import { ImportVentures } from './ImportVentures'
import { fmtDate } from './parts'

export const args = { role: 'admin', portal: 'hent', view: 'registry' }

export type VentureView = 'registry' | 'analytics' | 'updates' | 'import'

type Props = Partial<typeof args> & {
  view?: VentureView
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

type Page = { kind: 'list' } | { kind: 'venture'; id: string } | { kind: 'new' } | { kind: 'edit'; id: string }

const linked = () => {
  try {
    return new URL(window.location.href).searchParams.get('venture')
  } catch {
    return null
  }
}

export default function Ventures(props: Props) {
  const { role: r, portal: p, view = 'registry', onNavigate, onPortalChange, onSignOut } = { ...args, ...props } as Props & typeof args
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const allowed = canUseVentures({ role, pillars: pillarsFor(portal) })
  const showIdentity = canSeeIdentity(role)
  const me = roleMeta[role].user
  const data = useRegistry()

  const [page, setPage] = useState<Page>(() => {
    const id = linked()
    return id && data.ventures.some((v) => v.id === id || v.code === id) ? { kind: 'venture', id: data.ventures.find((v) => v.id === id || v.code === id)!.id } : { kind: 'list' }
  })
  useEffect(() => setPage((x) => (view === 'registry' ? x : { kind: 'list' })), [view])

  // Keep the address bar in step with the open venture, so it can be shared (same access rules apply).
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (page.kind === 'venture' && view === 'registry') url.searchParams.set('venture', data.ventures.find((v) => v.id === page.id)?.code ?? page.id)
      else url.searchParams.delete('venture')
      window.history.replaceState(null, '', url)
    } catch {
      /* no history API */
    }
  }, [page, view])

  const active = view === 'registry' ? 'ventures' : `ventures-${view}`
  const shell = (children: React.ReactNode) => (
    <AppShell role={role} portal={portal} active={active} onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">{children}</div>
    </AppShell>
  )

  if (!allowed)
    return shell(
      <div className="grid min-h-[50vh] place-items-center">
        <EmptyState
          icon={ShieldOff}
          title="You don’t have access to Ventures"
          body="The Venture Registry is for the HENT team and the MELA team. Ask MELA if you need venture numbers for a report."
          action={{ label: 'Go to the overview', onClick: () => onNavigate?.('overview') }}
        />
      </div>,
    )

  if (view === 'analytics') return shell(<Upcoming icon={BarChart3} title="Venture Analytics" step="build step 5" body="Every Ventures Portfolio metric from the CHII dashboard, computed live from the registry with the same definitions: portfolio size, stage and status, women-, youth- and PWD-led, founders, jobs, funding deployed and raised, revenue, survival and stage progression, by intake year and over time." />)
  if (view === 'import') return shell(<ImportVentures data={data} me={me} onOpen={(id) => (onNavigate?.('ventures'), setPage({ kind: 'venture', id }))} />)
  if (view === 'updates') return shell(<UpdatesPage data={data} onOpen={(id) => (onNavigate?.('ventures'), setPage({ kind: 'venture', id }))} />)

  if (page.kind === 'new' || page.kind === 'edit')
    return shell(<VentureForm data={data} ventureId={page.kind === 'edit' ? page.id : undefined} me={me} onDone={(id) => setPage(id ? { kind: 'venture', id } : { kind: 'list' })} />)

  if (page.kind === 'venture' && data.ventures.some((v) => v.id === page.id))
    return shell(
      <VenturePage
        data={data}
        ventureId={page.id}
        me={me}
        showIdentity={showIdentity}
        onBack={() => setPage({ kind: 'list' })}
        onEdit={() => setPage({ kind: 'edit', id: page.id })}
        onOpenPerson={(id) => onNavigate?.(`person:${id}`)}
      />,
    )

  return shell(
    <>
      <PageHeader
        crumbs={[portalMeta[portal].label, 'Ventures', 'Registry']}
        title="Venture Registry"
        description="Every health venture HENT supports, with its founders, stage, status and outcomes. One record per venture."
        actions={
          <>
            <Button onClick={() => onNavigate?.('ventures-import')}>
              <FileUp className="h-4 w-4" /> Import
            </Button>
            <Button variant="primary" onClick={() => setPage({ kind: 'new' })}>
              <Plus className="h-4 w-4" /> Add venture
            </Button>
          </>
        }
      />
      <Registry data={data} showIdentity={showIdentity} onOpen={(id) => setPage({ kind: 'venture', id })} onEdit={(id) => setPage({ kind: 'edit', id })} />
    </>,
  )
}

function Upcoming({ icon, title, step, body }: { icon: React.ComponentType<{ className?: string }>; title: string; step: string; body: string }) {
  return (
    <>
      <PageHeader crumbs={['HENT', 'Ventures', title]} title={title} />
      <Panel>
        <EmptyState icon={icon} title={`Coming in ${step}`} body={body} />
      </Panel>
    </>
  )
}

/** Founder updates waiting for staff. Sending the update form and reminders come in build step 6. */
function UpdatesPage({ data, onOpen }: { data: ReturnType<typeof useRegistry>; onOpen: (id: string) => void }) {
  const pending = data.updates.filter((u) => !u.acceptedAt).sort((a, b) => b.asOf.localeCompare(a.asOf))
  return (
    <>
      <PageHeader crumbs={['HENT', 'Ventures', 'Updates']} title="Venture updates" description="Updates founders send in. They count only after staff accept them." />
      <Panel title="Waiting for review" sub={`${pending.length} founder update${pending.length === 1 ? '' : 's'}`}>
        {pending.length ? (
          <ul className="divide-y divide-line">
            {pending.map((u) => {
              const v = data.ventures.find((x) => x.id === u.ventureId)!
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Clock className="h-4 w-4 text-warn" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{v.name}</span>
                    <span className="block text-xs text-muted">
                      <span className="font-mono text-brand-600">{v.code}</span> · as of {fmtDate(u.asOf)} · {u.jobsTotal} jobs · {u.stage} · {u.status}
                    </span>
                  </span>
                  <Button onClick={() => onOpen(v.id)}>Review</Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState compact icon={RefreshCw} title="Nothing to review" body="New founder updates will appear here." />
        )}
      </Panel>
      <Panel>
        <EmptyState icon={RefreshCw} title="Sending the update form comes in build step 6" body="A personal link for each founder (no login, no CHII ID shown), a schedule aligned with the bi-annual survey, response rates and reminders." />
      </Panel>
    </>
  )
}
