import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Database, RefreshCw, UserRound } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { AdminOnly, Button, PageHeader, PillarTag } from '../shared/components/ui'
import { Column, DataTable } from '../shared/components/DataTable'
import { CountUp } from '../shared/components/StatStrip'
import { FeedbackRow, Participant, Pillar, Portal, Role, feedbackRows, participants, portalMeta } from '../shared/data/mela'
import { inRange, parseDay, useTimeRange } from '../shared/lib/time'
import { toast } from '../shared/lib/notify'

export const args = {
  role: 'admin',
  portal: 'admin',
  registry: 'participants',
}

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  onOpenPerson?: (id: string) => void
}

type Attendance = { id: string; chiiId: string; session: string; pillar: Pillar; date: string; time: string; method: 'QR check-in' | 'Walk-in' | 'Imported' }

export default function ChiiDatabase(props: Props) {
  const { role: r, portal: p, registry: initial, onNavigate, onPortalChange, onSignOut, onOpenPerson } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const [reg, setReg] = useState(initial)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState('4 min ago')
  const { range, label } = useTimeRange()

  const people = useMemo(() => participants.filter((x) => inRange(range, x.lastActive)), [range])
  const attendance = useMemo(() => attendanceRows.filter((a) => inRange(range, a.date)), [range])
  const feedback = useMemo(() => feedbackRows.filter((f) => inRange(range, f.date)), [range])
  const registries = [
    { id: 'participants', label: 'Participants', rows: people.length, table: 'beneficiary + participation' },
    { id: 'attendance', label: 'Attendance', rows: attendance.length, table: 'session_attendance' },
    { id: 'feedback', label: 'Feedback', rows: feedback.length, table: 'cohort_feedback' },
  ]
  const actions = [{ label: 'Open person', icon: UserRound, onClick: (id: string) => onOpenPerson?.(id) }]
  const copy = (id: string) => (navigator.clipboard?.writeText(id), toast({ title: `Copied ${id}`, tone: 'info' }))

  return (
    <AppShell role={role} portal={portal} active="chii-db" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      {role !== 'admin' ? (
        <AdminOnly />
      ) : (
        <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
          <PageHeader
            crumbs={[portalMeta[portal].label, 'CHII database']}
            title="CHII database"
            description={<>The consolidated, cross-pillar registries that feed MELA reporting · <span className="font-medium text-ink">{label.toLowerCase()}</span>.</>}
            actions={
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  setRefreshing(true)
                  setTimeout(() => {
                    setRefreshing(false)
                    setRefreshedAt('just now')
                    toast({ title: 'Registries refreshed', body: 'Materialised views rebuilt from the latest entries.', tone: 'good' })
                  }, 900)
                }}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing…' : `Refreshed ${refreshedAt}`}
              </Button>
            }
          />

          <div role="tablist" className="grid grid-cols-3 gap-2">
            {registries.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                onClick={() => setReg(x.id)}
                aria-selected={reg === x.id}
                className={`relative min-w-0 rounded-xl border px-3 py-3 text-left transition-colors duration-150 ease-out sm:px-4 ${
                  reg === x.id ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                <div className={`truncate text-sm font-semibold ${reg === x.id ? 'text-brand-600' : ''}`}>{x.label}</div>
                <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-lg font-semibold tabular-nums sm:text-xl">
                    <CountUp value={x.rows} />
                  </span>
                  <span className="hidden truncate font-mono text-[11px] text-muted sm:block">{x.table}</span>
                </div>
              </button>
            ))}
          </div>

          <motion.div key={reg} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>
            {reg === 'participants' && (
              <DataTable<Participant>
                title="CHII Participants registry"
                rows={people}
                columns={peopleCols}
                rowKey={(x) => x.id}
                stickyFirst
                onRowClick={(x) => onOpenPerson?.(x.id)}
                searchPlaceholder="Search name, email, CHII ID"
                emptyIcon={Database}
                empty={{ title: 'No participants in this period' }}
                rowActions={[{ ...actions[0], onClick: (x) => onOpenPerson?.(x.id) }, { label: 'Copy CHII ID', icon: Copy, onClick: (x) => copy(x.id) }]}
                mobileRow={(x) => <MobileLine id={x.id} title={x.name} meta={`${x.country} · ${x.pillars.join(' + ')}`} />}
              />
            )}
            {reg === 'attendance' && (
              <DataTable<Attendance>
                title="CHII Attendance registry"
                rows={attendance}
                columns={attCols}
                rowKey={(x) => x.id}
                stickyFirst
                searchPlaceholder="Search CHII ID or session"
                emptyIcon={Database}
                empty={{ title: 'No check-ins in this period' }}
                rowActions={[{ ...actions[0], onClick: (x) => onOpenPerson?.(x.chiiId) }, { label: 'Copy CHII ID', icon: Copy, onClick: (x) => copy(x.chiiId) }]}
                mobileRow={(x) => <MobileLine id={x.chiiId} title={x.session} meta={`${x.date} · ${x.time} · ${x.method}`} />}
                initialSort={{ key: 'date', dir: -1 }}
              />
            )}
            {reg === 'feedback' && (
              <DataTable<FeedbackRow>
                title="CHII Feedback registry"
                rows={feedback}
                columns={fbCols}
                rowKey={(x) => x.id}
                stickyFirst
                searchPlaceholder="Search CHII ID, session or comment"
                emptyIcon={Database}
                empty={{ title: 'No feedback in this period' }}
                rowActions={[{ ...actions[0], onClick: (x) => onOpenPerson?.(x.chiiId) }]}
                mobileRow={(x) => <MobileLine id={x.chiiId} title={x.session} meta={`${x.date} · NPS ${x.nps}`} />}
              />
            )}
          </motion.div>
        </div>
      )}
    </AppShell>
  )
}

function MobileLine({ id, title, meta }: { id: string; title: string; meta: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">{title}</div>
      <div className="mt-0.5 truncate text-xs text-muted">
        <span className="font-mono text-brand-600">{id}</span> · {meta}
      </div>
    </div>
  )
}

const idCell = (id: string) => <span className="whitespace-nowrap font-mono text-[13px] font-medium text-brand-600">{id}</span>

const peopleCols: Column<Participant>[] = [
  { key: 'id', label: 'CHII ID', render: (x) => idCell(x.id) },
  { key: 'name', label: 'Name', restricted: true, filterable: false },
  { key: 'email', label: 'Email', restricted: true, filterable: false, hideBelow: 'lg', render: (x) => <span className="text-muted">{x.email}</span> },
  { key: 'gender', label: 'Gender' },
  { key: 'age', label: 'Age', numeric: true, hideBelow: 'xl' },
  { key: 'country', label: 'Country' },
  { key: 'pillars', label: 'Pillars', value: (x) => x.pillars.join(' + '), render: (x) => <span className="flex gap-1">{x.pillars.map((pl) => <PillarTag key={pl} pillar={pl} />)}</span> },
  { key: 'sessions', label: 'Sessions', numeric: true },
  { key: 'attendance', label: 'Attendance %', numeric: true },
  { key: 'joined', label: 'First seen', filterable: false, hideBelow: 'lg' },
]

const attCols: Column<Attendance>[] = [
  { key: 'chiiId', label: 'CHII ID', render: (x) => idCell(x.chiiId) },
  { key: 'session', label: 'Session' },
  { key: 'pillar', label: 'Pillar', render: (x) => <PillarTag pillar={x.pillar} /> },
  { key: 'date', className: 'whitespace-nowrap', label: 'Date', filterable: false },
  { key: 'time', label: 'Checked in', filterable: false },
  { key: 'method', label: 'Method' },
]

const fbCols: Column<FeedbackRow>[] = [
  { key: 'chiiId', label: 'CHII ID', render: (x) => idCell(x.chiiId) },
  { key: 'date', className: 'whitespace-nowrap', label: 'Date', filterable: false },
  { key: 'pillar', label: 'Pillar', render: (x) => <PillarTag pillar={x.pillar} /> },
  { key: 'session', label: 'Session' },
  { key: 'satisfaction', label: 'Satisfaction', numeric: true },
  { key: 'relevance', label: 'Relevance', numeric: true },
  { key: 'nps', label: 'NPS', numeric: true },
]

/* Attendance rows derived from each participant's activity. */
const attendanceRows: Attendance[] = participants.flatMap((x, i) =>
  Array.from({ length: Math.min(4, x.sessions) }, (_, k) => {
    const n = (i * 31 + k * 17) % 97
    return {
      id: `${x.id}-${k}`,
      chiiId: x.id,
      session: `${x.interventions[k % x.interventions.length]} · ${['Day 1', 'Day 2', 'Week 3', 'Closing'][k]}`,
      pillar: x.pillars[k % x.pillars.length],
      date: shift(x.lastActive, k * 9 + (n % 5)),
      time: `${String(8 + (n % 10)).padStart(2, '0')}:${String((n * 7) % 60).padStart(2, '0')}`,
      method: n % 5 === 0 ? 'Walk-in' : n % 7 === 0 ? 'Imported' : 'QR check-in',
    }
  }),
)

function shift(day: string, back: number) {
  const d = parseDay(day) ?? new Date(2025, 10, 10)
  d.setDate(d.getDate() - back)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
