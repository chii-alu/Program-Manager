/**
 * Tools → SOPs: standard operating procedures. Each pillar portal sees its own SOPs and the
 * CHII-wide ones; MELA sees every pillar's. Each step links to where it's done in the app, and a
 * pillar lead (or MELA) approves their SOPs after review.
 */
import React, { useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, CheckCircle2, ClipboardList, Search } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { EmptyState } from '../shared/components/EmptyState'
import { Portal, Role, pillarsFor, type Pillar } from '../shared/data/mela'
import { userFor } from '../shared/lib/auth'
import { toast } from '../shared/lib/notify'
import { approveSop, sopsFor, useSops, type Sop } from '../shared/data/sops'

export const args = { role: 'pillar_lead', portal: 'hemp' }

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

const GROUP_ORDER: (Pillar | 'CHII')[] = ['HENT', 'HEMP', 'HECO', 'CHII']
const groupLabel = (g: Pillar | 'CHII') => (g === 'CHII' ? 'CHII-wide (every pillar)' : `${g} SOPs`)

export default function Sops(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const me = userFor(role, portal).user
  const all = useSops()
  const mine = useMemo(() => sopsFor(all, pillarsFor(portal)), [all, portal])
  const [q, setQ] = useState('')
  const list = mine.filter((x) => !q.trim() || `${x.title} ${x.purpose} ${x.appliesTo.join(' ')} ${x.steps.map((s) => s.title).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))
  const [openId, setOpenId] = useState<string | null>(null)
  const open = list.find((x) => x.id === openId) ?? list.find((x) => x.pillar !== 'CHII') ?? list[0]
  const groups = GROUP_ORDER.filter((g) => list.some((x) => x.pillar === g))
  // Pillar leads approve their own pillar's SOPs; MELA approves any (including CHII-wide).
  const canApprove = (x: Sop) => role === 'admin' || (role === 'pillar_lead' && x.pillar !== 'CHII' && pillarsFor(portal).includes(x.pillar))

  return (
    <AppShell role={role} portal={portal} active="sops" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
        <PageHeader
          crumbs={[portal === 'admin' ? 'MELA' : portal.toUpperCase(), 'Tools', 'SOPs']}
          title="Standard Operating Procedures"
          description={`How we run our work, step by step: ${portal === 'admin' ? 'every pillar’s SOPs' : `${portal.toUpperCase()}’s SOPs`} and the CHII-wide ones. Each step opens the page where it’s done.`}
        />
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Panel className="self-start">
            <div className="border-b border-line p-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SOPs" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
              </label>
            </div>
            {list.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No SOP matches “{q}”.</p>
            ) : (
              groups.map((g) => (
                <div key={g}>
                  <p className="border-b border-line bg-canvas px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{groupLabel(g)}</p>
                  <ul className="divide-y divide-line">
                    {list
                      .filter((x) => x.pillar === g)
                      .map((x) => (
                        <li key={x.id}>
                          <button type="button" onClick={() => setOpenId(x.id)} aria-current={open?.id === x.id ? 'true' : undefined} className={`flex w-full items-start gap-2.5 px-4 py-3 text-left ${open?.id === x.id ? 'bg-brand-50' : 'hover:bg-canvas'}`}>
                            <ClipboardList className={`mt-0.5 h-4 w-4 shrink-0 ${open?.id === x.id ? 'text-brand-600' : 'text-muted'}`} />
                            <span className="min-w-0 flex-1">
                              <span className={`block text-sm font-semibold leading-snug ${open?.id === x.id ? 'text-brand-600' : 'text-ink'}`}>{x.title}</span>
                              <span className="block text-xs text-muted">
                                {x.steps.length} steps · {x.owner}
                              </span>
                            </span>
                            <StatusTag x={x} />
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </Panel>
          {open ? <SopView key={open.id} x={open} canApprove={canApprove(open)} onApprove={() => (approveSop(open.id, me), toast({ title: 'SOP approved', body: open.title, tone: 'good' }))} onNavigate={onNavigate} /> : <Panel><EmptyState icon={ClipboardList} title="No SOPs here" body="SOPs for this pillar will appear here." /></Panel>}
        </div>
      </div>
    </AppShell>
  )
}

function StatusTag({ x }: { x: Sop }) {
  return x.status === 'Approved' ? (
    <span className="shrink-0 rounded-full bg-good-bg px-2 py-0.5 text-[10.5px] font-semibold text-good">Approved</span>
  ) : (
    <span className="shrink-0 rounded-full bg-warn-bg px-2 py-0.5 text-[10.5px] font-semibold text-warn">Draft</span>
  )
}

function SopView({ x, canApprove, onApprove, onNavigate }: { x: Sop; canApprove: boolean; onApprove: () => void; onNavigate?: (to: string) => void }) {
  const [done, setDone] = useState<number[]>([])
  return (
    <Panel className="self-start overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-600">{x.pillar === 'CHII' ? 'CHII-wide' : x.pillar}</span>
          <StatusTag x={x} />
          <span className="text-xs text-muted">
            v{x.version} · owner: {x.owner}
            {x.reviewedBy && ` · approved by ${x.reviewedBy} on ${new Date(`${x.reviewedAt}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold text-ink">{x.title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-body">
          <b className="font-semibold text-ink">Purpose:</b> {x.purpose}
        </p>
        <p className="mt-1 text-xs text-muted">Applies to: {x.appliesTo.join(' · ')}</p>
        {x.status === 'Draft' && (
          <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">
            Draft written from how the platform works. {x.pillar === 'CHII' ? 'MELA' : `The ${x.pillar} lead`} should check each step against how the team actually works, then approve it.
          </p>
        )}
      </div>
      <ol className="divide-y divide-line">
        {x.steps.map((s, i) => {
          const ticked = done.includes(i)
          return (
            <li key={i} className="flex gap-3 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setDone(ticked ? done.filter((k) => k !== i) : [...done, i])}
                aria-pressed={ticked}
                aria-label={ticked ? `Step ${i + 1} done` : `Mark step ${i + 1} done`}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${ticked ? 'bg-good text-white' : 'bg-brand text-white'}`}
              >
                {ticked ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${ticked ? 'text-muted line-through' : 'text-ink'}`}>{s.title}</p>
                <p className="mt-0.5 text-[13px] leading-6 text-body">{s.detail}</p>
              </div>
              {s.to && (
                <button type="button" onClick={() => onNavigate?.(s.to!)} className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-line-strong px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                  {s.toLabel ?? 'Open'} <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/60 px-5 py-3">
        <span className="text-xs text-muted">
          {done.length} of {x.steps.length} steps ticked · ticks are just for you, to follow along
        </span>
        {canApprove && (
          <Button variant="primary" className="ml-auto h-9 text-xs" onClick={onApprove}>
            <BadgeCheck className="h-4 w-4" /> {x.status === 'Approved' ? `Re-approve as v${x.version + 1}` : 'Approve this SOP'}
          </Button>
        )}
      </div>
    </Panel>
  )
}
