/**
 * HENT → Incubation: Cohorts | Curriculum | Gate | Canvas sync | Analytics (build addendum §7).
 * HENT staff and the MELA admin only; HEMP and HECO get "no access", even with a direct link.
 */
import React, { useEffect, useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { EmptyState } from '../shared/components/EmptyState'
import { Portal, Role, pillarsFor } from '../shared/data/mela'
import { userFor } from '../shared/lib/auth'
import { canUseIncubation, useIncubation } from '../shared/incubation/store'
import { CohortsPage } from './Cohorts'
import { CohortPage, type CohortTab } from './CohortPage'
import { CurriculumPage } from './Curriculum'
import { GatePage } from './Gate'
import { CanvasPage } from './Canvas'
import { IncubationAnalytics } from './Analytics'

export const args = { role: 'admin', portal: 'hent', view: 'cohorts' }

export type IncubationView = 'cohorts' | 'curriculum' | 'gate' | 'canvas' | 'analytics'

type Props = Partial<typeof args> & {
  view?: IncubationView
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onOpenPerson?: (chiiId: string) => void
}

export default function Incubation(props: Props) {
  const { role: r, portal: p, view = 'cohorts', onNavigate, onPortalChange, onSignOut } = { ...args, ...props } as Props & typeof args
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const allowed = canUseIncubation({ role, pillars: pillarsFor(portal) })
  const me = userFor(role, portal).user
  const data = useIncubation()
  const [open, setOpen] = useState<{ id: string; tab: CohortTab } | null>(null)
  useEffect(() => setOpen((x) => (view === 'cohorts' ? x : null)), [view])

  const active = view === 'cohorts' ? 'incubation' : `incubation-${view}`
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
          title="You don’t have access to Incubation"
          body="Incubation is for the HENT team and the MELA team. Ask MELA if you need incubation numbers for a report."
          action={{ label: 'Go to the overview', onClick: () => onNavigate?.('overview') }}
        />
      </div>,
    )

  const openCohort = (id: string, tab: CohortTab = 'founders') => {
    if (view !== 'cohorts') onNavigate?.('incubation')
    setOpen({ id, tab })
  }

  if (view === 'curriculum') return shell(<CurriculumPage data={data} me={me} />)
  if (view === 'gate') return shell(<GatePage data={data} me={me} onOpenCohort={openCohort} />)
  if (view === 'canvas') return shell(<CanvasPage data={data} me={me} onOpenCohort={openCohort} />)
  if (view === 'analytics') return shell(<IncubationAnalytics data={data} onOpenCohort={openCohort} />)

  if (open && data.cohorts.some((c) => c.id === open.id))
    return shell(
      <CohortPage
        data={data}
        cohortId={open.id}
        tab={open.tab}
        onTab={(tab) => setOpen({ ...open, tab })}
        me={me}
        onBack={() => setOpen(null)}
        onNavigate={onNavigate}
        onOpenPerson={props.onOpenPerson}
      />,
    )

  return shell(<CohortsPage data={data} me={me} onOpen={openCohort} />)
}
