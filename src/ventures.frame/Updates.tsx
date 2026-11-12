/**
 * Venture updates (VENTURE-REGISTRY-SPEC §3 Updates, build step 6):
 * the current round's personal update links (send, remind, copy, QR), the response rate,
 * the schedule, the founder updates waiting for staff review, and the activity log (who did what).
 */
import React, { useMemo, useState } from 'react'
import { BellRing, CalendarClock, Check, Clock, Copy, ExternalLink, Eye, Link2, QrCode, RefreshCw, Send } from 'lucide-react'
import { Column, DataTable } from '../shared/components/DataTable'
import { EmptyState } from '../shared/components/EmptyState'
import { StatCards } from '../shared/components/StatStrip'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { toast } from '../shared/lib/notify'
import { personById } from '../shared/ventures/people'
import { acceptUpdate, createRoundLinks, currentRound, markLinks, setUpdateSchedule, settingsOf } from '../shared/ventures/store'
import type { RegistryData, UpdateLink } from '../shared/ventures/types'
import { Chip, fmtDate } from './parts'
import { ShareLink, formUrl } from './ShareLink'
import { ActivityLog } from './ActivityLog'

type Row = UpdateLink & { venture: string; code: string; founder: string; state: 'Not sent' | 'Sent' | 'Reminded' | 'Responded' | 'Accepted' }

export function UpdatesPage({ data, me, showIdentity, onOpen }: { data: RegistryData; me: string; showIdentity: boolean; onOpen: (id: string) => void }) {
  const round = currentRound(data)
  const settings = settingsOf(data)
  const [share, setShare] = useState<Row | null>(null)
  const rows: Row[] = useMemo(
    () =>
      (data.links ?? [])
        .filter((l) => l.roundId === round.id)
        .map((l) => {
          const v = data.ventures.find((x) => x.id === l.ventureId)!
          const u = l.updateId ? data.updates.find((x) => x.id === l.updateId) : null
          const state: Row['state'] = u?.acceptedAt ? 'Accepted' : l.respondedAt ? 'Responded' : l.remindedAt ? 'Reminded' : l.sentAt ? 'Sent' : 'Not sent'
          return { ...l, venture: v.name, code: v.code, founder: personById(l.chiiId)?.name ?? l.chiiId, state }
        }),
    [data, round.id],
  )
  const answered = rows.filter((r) => r.respondedAt).length
  const notSent = rows.filter((r) => !r.sentAt)
  const waiting = rows.filter((r) => r.sentAt && !r.respondedAt)
  const pending = data.updates.filter((u) => !u.acceptedAt).sort((a, b) => b.asOf.localeCompare(a.asOf))
  const nextRound = addMonths(round.opensOn, settings.updateEveryMonths)

  const columns: Column<Row>[] = [
    { key: 'code', label: 'Venture ID', render: (r) => <span className="font-mono text-[13px] font-medium text-brand-600">{r.code}</span> },
    { key: 'venture', label: 'Venture', render: (r) => <span className="font-semibold text-ink">{r.venture}</span> },
    { key: 'founder', label: 'Sent to', restricted: true },
    {
      key: 'state',
      label: 'Status',
      render: (r) => <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${STATE[r.state]}`}>{r.state}</span>,
    },
    { key: 'sentAt', label: 'Sent', value: (r) => (r.sentAt ? r.sentAt.slice(0, 10) : ''), render: (r) => (r.sentAt ? fmtDate(r.sentAt) : '—'), filterable: false },
    { key: 'respondedAt', label: 'Answered', value: (r) => (r.respondedAt ? r.respondedAt.slice(0, 10) : ''), render: (r) => (r.respondedAt ? fmtDate(r.respondedAt) : '—'), filterable: false },
    {
      key: 'link',
      label: 'Personal link',
      filterable: false,
      value: (r) => formUrl('venture-update', r.token),
      render: (r) => (
        <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <IconBtn label="Copy link" onClick={() => (navigator.clipboard?.writeText(formUrl('venture-update', r.token)).catch(() => undefined), toast({ title: 'Link copied', body: `Personal update link for ${r.venture}`, tone: 'info' }))}>
            <Copy className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="QR code" onClick={() => setShare(r)}>
            <QrCode className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Open the form" onClick={() => window.open(formUrl('venture-update', r.token), '_blank', 'noopener')}>
            <ExternalLink className="h-3.5 w-3.5" />
          </IconBtn>
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        crumbs={['HENT', 'Ventures', 'Updates']}
        title="Venture updates"
        description="Founders update their venture’s stage, status, jobs and funding through a personal link. Nothing counts until staff accept it, and earlier numbers are never overwritten."
        actions={
          <Button onClick={() => window.open(formUrl('venture-update', rows[0]?.token), '_blank', 'noopener')}>
            <Eye className="h-4 w-4" /> Preview the form
          </Button>
        }
      />

      <StatCards
        items={[
          { label: 'Response rate', value: rows.length ? Math.round((answered / rows.length) * 100) : 0, suffix: '%', icon: RefreshCw, hint: `${answered} of ${rows.length} ventures`, tip: 'Ventures that answered this round ÷ ventures sent a link.' },
          { label: 'To review', value: pending.length, icon: Clock, hint: 'founder updates', tip: 'Updates founders sent that staff haven’t accepted yet.' },
          { label: 'Waiting for an answer', value: waiting.length, icon: BellRing, hint: 'sent, no reply yet', tip: 'Links sent this round with no reply yet.' },
          { label: 'Round due', value: 0, display: fmtDate(round.dueOn), icon: CalendarClock, hint: round.label, tip: 'The date founders are asked to reply by.' },
        ]}
      />

      {pending.length > 0 && (
        <Panel title="Waiting for review" sub="Accept an update to make it the venture’s latest values. The baseline and earlier updates stay as they are." accentBorder>
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
                      {u.notes && ` · “${u.notes}”`}
                    </span>
                  </span>
                  <Button onClick={() => onOpen(v.id)}>Compare</Button>
                  <Button variant="primary" onClick={() => (acceptUpdate(u.id, me), toast({ title: 'Update accepted', body: v.name, tone: 'good' }))}>
                    <Check className="h-4 w-4" /> Accept
                  </Button>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      <DataTable
        heading={`${round.label} · personal links`}
        description={`One link per active venture, sent to its lead founder. Due ${fmtDate(round.dueOn)}.`}
        title={`Venture update links · ${round.label}`}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.token}
        canSeeRestricted={showIdentity}
        onRowClick={(r) => onOpen(r.ventureId)}
        searchPlaceholder="Search venture or ID"
        initialSort={{ key: 'code', dir: 1 }}
        emptyIcon={Link2}
        empty={{ title: 'No links for this round yet', body: 'Create them with “Create links” above the table.' }}
        above={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                const n = createRoundLinks(me)
                toast({ title: n ? `${n} new link${n === 1 ? '' : 's'} created` : 'Every active venture already has a link', tone: n ? 'good' : 'info' })
              }}
            >
              <Link2 className="h-4 w-4" /> Create links
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!notSent.length) return toast({ title: 'All links have been sent', tone: 'info' })
                markLinks(notSent.map((r) => r.token), 'sent', me)
                toast({ title: `Sent to ${notSent.length} founder${notSent.length === 1 ? '' : 's'}`, body: 'In the live system each lead founder gets an email with their link.', tone: 'good' })
              }}
            >
              <Send className="h-4 w-4" /> Send {notSent.length ? `${notSent.length} ` : ''}links
            </Button>
            <Button
              onClick={() => {
                if (!waiting.length) return toast({ title: 'No one to remind', tone: 'info' })
                markLinks(waiting.map((r) => r.token), 'reminded', me)
                toast({ title: `Reminded ${waiting.length} founder${waiting.length === 1 ? '' : 's'}`, tone: 'good' })
              }}
            >
              <BellRing className="h-4 w-4" /> Remind {waiting.length}
            </Button>
            <span className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-muted">
              Ask every
              {([3, 6, 12] as const).map((m) => (
                <Chip key={m} on={settings.updateEveryMonths === m} onClick={() => setUpdateSchedule(m, me)}>
                  {m} months
                </Chip>
              ))}
              <span>· next round {fmtDate(nextRound)}</span>
            </span>
          </div>
        }
      />

      <Panel title="Activity log" sub="Who created, sent and reminded links, which founders answered, who accepted their updates, and schedule changes.">
        <ActivityLog
          data={data}
          area="updates"
          onOpen={onOpen}
          filters={[
            { key: 'links', label: 'Links created / sent', actions: ['links_created', 'links_sent'] },
            { key: 'reminders', label: 'Reminders', actions: ['links_reminded'] },
            { key: 'answers', label: 'Founder answers', actions: ['founder_update_received'] },
            { key: 'accepted', label: 'Accepted', actions: ['update_accepted'] },
            { key: 'schedule', label: 'Schedule', actions: ['schedule_changed'] },
          ]}
        />
      </Panel>

      {share && (
        <ShareLink
          open
          onClose={() => setShare(null)}
          title={`Update link · ${share.venture}`}
          description={`Personal to ${showIdentity ? share.founder : 'the lead founder'}. No login, and no CHII ID is shown on the form.`}
          url={formUrl('venture-update', share.token)}
          fileName={`${share.code}-update`}
        />
      )}
      {!rows.length && <EmptyState compact icon={RefreshCw} title="No update round yet" />}
    </>
  )
}

const STATE: Record<Row['state'], string> = {
  'Not sent': 'bg-canvas text-muted',
  Sent: 'bg-brand-50 text-brand-600',
  Reminded: 'bg-warn-bg text-warn',
  Responded: 'bg-[#e6f0fb] text-[#1f5fa8] dark:bg-brand-50 dark:text-brand-600',
  Accepted: 'bg-good-bg text-good',
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted hover:bg-canvas hover:text-ink">
      {children}
    </button>
  )
}

function addMonths(iso: string, m: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setMonth(d.getMonth() + m)
  return d.toISOString().slice(0, 10)
}
