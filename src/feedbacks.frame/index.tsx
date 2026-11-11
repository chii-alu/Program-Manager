import React, { useMemo } from 'react'
import { Copy, MessageSquareText, Star, Target, TrendingUp, UserRound } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { PageHeader, PillarTag } from '../shared/components/ui'
import { Column, DataTable } from '../shared/components/DataTable'
import { StatCards } from '../shared/components/StatStrip'
import { FeedbackRow, Portal, Role, feedbackRows, pillarsFor, portalMeta } from '../shared/data/mela'
import { inRange, previous, useTimeRange } from '../shared/lib/time'
import { toast } from '../shared/lib/notify'

export const args = {
  role: 'admin',
  portal: 'admin',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onOpenPerson?: (id: string) => void
}

export default function Feedbacks(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut, onOpenPerson } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const scope = pillarsFor(portal)
  const { range, label } = useTimeRange()
  const inScope = useMemo(() => feedbackRows.filter((f) => scope.includes(f.pillar)), [portal])
  const inPeriod = useMemo(() => inScope.filter((f) => inRange(range, f.date)), [inScope, range])
  const prev = useMemo(() => inScope.filter((f) => inRange(previous(range), f.date)), [inScope, range])
  const rows = inPeriod

  const nps = (list: FeedbackRow[]) => (list.length ? Math.round(((list.filter((f) => f.nps >= 9).length - list.filter((f) => f.nps <= 6).length) / list.length) * 100) : 0)
  const avg = (k: 'satisfaction' | 'relevance') => (inPeriod.reduce((n, f) => n + f[k], 0) / (inPeriod.length || 1)).toFixed(1)

  const columns: Column<FeedbackRow>[] = [
    { key: 'chiiId', label: 'CHII ID', render: (f) => <span className="whitespace-nowrap font-mono text-[13px] font-medium text-brand-600">{f.chiiId}</span> },
    { key: 'date', className: 'whitespace-nowrap', label: 'Date', filterable: false, value: (f) => f.date },
    { key: 'pillar', label: 'Pillar', render: (f) => <PillarTag pillar={f.pillar} /> },
    { key: 'intervention', label: 'Intervention' },
    { key: 'session', label: 'Session', hideBelow: 'xl', render: (f) => <span className="block max-w-[200px] truncate">{f.session}</span> },
    { key: 'comment', label: 'Comment', filterable: false, render: (f) => <span className="line-clamp-2 max-w-[300px] text-body">{f.comment}</span> },
    { key: 'satisfaction', label: 'Sat.', numeric: true },
    { key: 'relevance', label: 'Rel.', numeric: true, hideBelow: 'lg' },
    { key: 'nps', label: 'NPS', numeric: true, render: (f) => <NpsChip v={f.nps} /> },
  ]

  return (
    <AppShell role={role} portal={portal} active="feedback" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
        <PageHeader
          crumbs={[portalMeta[portal].label, 'CHII Feedbacks']}
          title="CHII Feedbacks"
          description={<>Every feedback response in <span className="font-medium text-ink">{label.toLowerCase()}</span>. One response per person per session.</>}
        />

        <StatCards
            items={[
              { label: 'Responses', value: inPeriod.length, prev: prev.length, icon: MessageSquareText, hint: 'vs previous period', tip: 'Feedback forms submitted in the selected period, one per person per session' },
              { label: 'NPS', value: nps(inPeriod), display: `${nps(inPeriod) > 0 ? '+' : ''}${nps(inPeriod)}`, icon: TrendingUp, hint: `previous period ${nps(prev) > 0 ? '+' : ''}${nps(prev)}`, tip: 'Net Promoter Score: % who scored 9–10 minus % who scored 0–6. Ranges from −100 to +100' },
              { label: 'Satisfaction', value: 0, display: `${avg('satisfaction')}/5`, icon: Star, hint: 'average score', tip: 'Average answer to “How satisfied were you with this session?” on a 1–5 scale' },
              { label: 'Relevance', value: 0, display: `${avg('relevance')}/5`, icon: Target, hint: 'average score', tip: 'Average answer to “How relevant was this to your goals?” on a 1–5 scale' },
            ]}
          />

        <DataTable
          heading="All feedback"
          description={`${rows.length.toLocaleString()} responses · one per person per session`}
          title={`CHII Feedbacks · ${portalMeta[portal].label}`}
          rows={rows}
          columns={columns}
          rowKey={(f) => f.id}
          searchPlaceholder="Search CHII ID, session or comment"
          emptyIcon={MessageSquareText}
          empty={{ title: 'No feedback in this period', body: 'Feedback arrives when attendees submit the session form. Try a wider time range.' }}
          rowActions={[
            { label: 'Open person', icon: UserRound, onClick: (f) => onOpenPerson?.(f.chiiId) },
            { label: 'Copy comment', icon: Copy, onClick: (f) => (navigator.clipboard?.writeText(f.comment), toast({ title: 'Comment copied', tone: 'info' })) },
          ]}
          onRowClick={(f) => onOpenPerson?.(f.chiiId)}
          mobileRow={(f) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{f.session}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <PillarTag pillar={f.pillar} /> {f.date}
                  </div>
                </div>
                <NpsChip v={f.nps} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-body">“{f.comment}”</p>
            </div>
          )}
        />
      </div>
    </AppShell>
  )
}

function NpsChip({ v }: { v: number }) {
  const c = v >= 9 ? 'bg-good-bg text-good' : v >= 7 ? 'bg-canvas text-body' : 'bg-bad-bg text-bad'
  return <span className={`inline-flex h-6 min-w-8 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums ${c}`}>{v}</span>
}
