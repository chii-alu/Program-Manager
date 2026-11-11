import React, { useMemo, useState } from 'react'
import { Copy, MessageSquareText, Star, Target, TrendingUp, UserRound } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AppShell } from '../shared/components/AppShell'
import { PageHeader, Panel, PillarTag } from '../shared/components/ui'
import { Column, DataTable } from '../shared/components/DataTable'
import { StatCards } from '../shared/components/StatStrip'
import { ChartTooltip, axisProps, gridProps, valueAxisProps, categoryAxisProps, valueLabelProps } from '../shared/components/charts'
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
  const [score, setScore] = useState<number | null>(null)

  const inScope = useMemo(() => feedbackRows.filter((f) => scope.includes(f.pillar)), [portal])
  const inPeriod = useMemo(() => inScope.filter((f) => inRange(range, f.date)), [inScope, range])
  const prev = useMemo(() => inScope.filter((f) => inRange(previous(range), f.date)), [inScope, range])
  const rows = score == null ? inPeriod : inPeriod.filter((f) => f.nps === score)

  const nps = (list: FeedbackRow[]) => (list.length ? Math.round(((list.filter((f) => f.nps >= 9).length - list.filter((f) => f.nps <= 6).length) / list.length) * 100) : 0)
  const avg = (k: 'satisfaction' | 'relevance') => (inPeriod.reduce((n, f) => n + f[k], 0) / (inPeriod.length || 1)).toFixed(1)
  const dist = Array.from({ length: 11 }, (_, i) => ({ score: String(i), count: inPeriod.filter((f) => f.nps === i).length }))

  const columns: Column<FeedbackRow>[] = [
    { key: 'chiiId', label: 'CHII ID', render: (f) => <span className="font-mono text-[13px] font-medium text-brand-600">{f.chiiId}</span> },
    { key: 'date', label: 'Date', filterable: false, value: (f) => f.date },
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

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <StatCards
            items={[
              { label: 'Responses', value: inPeriod.length, prev: prev.length, icon: MessageSquareText, hint: 'vs previous period' },
              { label: 'NPS', value: nps(inPeriod), display: `${nps(inPeriod) > 0 ? '+' : ''}${nps(inPeriod)}`, icon: TrendingUp, hint: `previous period ${nps(prev) > 0 ? '+' : ''}${nps(prev)}` },
              { label: 'Satisfaction', value: 0, display: `${avg('satisfaction')}/5`, icon: Star, hint: 'average score' },
              { label: 'Relevance', value: 0, display: `${avg('relevance')}/5`, icon: Target, hint: 'average score' },
            ]}
          />
          <Panel
            title="Score distribution"
            headerRight={
              score != null ? (
                <button type="button" onClick={() => setScore(null)} className="text-[10px] font-bold uppercase tracking-wide text-white/90 hover:underline">
                  Showing score {score} · clear
                </button>
              ) : (
                <span className="text-[10px] text-white/70">Click a bar to filter</span>
              )
            }
            className="pb-2"
          >
            <div className="mt-3 h-[92px] px-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dist} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                  <CartesianGrid vertical={false} {...gridProps} />
                  <XAxis dataKey="score" {...categoryAxisProps} interval={0} />
                  <YAxis {...valueAxisProps} width={36} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--chart-cursor)' }} content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Responses" radius={[4, 4, 0, 0]} onClick={(d: { score?: string }) => setScore((s) => (s === Number(d.score) ? null : Number(d.score)))} className="cursor-pointer">
                    {dist.map((d) => {
                      const n = Number(d.score)
                      const base = n >= 9 ? 'var(--color-good)' : n >= 7 ? 'var(--color-line-strong)' : 'var(--color-bad)'
                      return <Cell key={d.score} fill={base} fillOpacity={score == null || score === n ? 1 : 0.25} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <DataTable
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
