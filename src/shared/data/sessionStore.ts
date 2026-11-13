/**
 * Sessions and where each one is in its process:
 *   forms ready → registration/applications open → (review and select) → registration closed
 *   → attendance taken → feedback open → feedback closed (wrapped up).
 *
 * The sample sessions come from mela.ts; sessions staff create are added here. Each session's
 * form statuses, selections and attendance are kept, so the process carries on where it was left.
 * Browser-only (localStorage) like the rest of the prototype.
 */
import { useSyncExternalStore } from 'react'
import { interventions, sessions as seedSessions, type Session } from './mela'

export type FormStatus = 'draft' | 'open' | 'closed'
export type FormKey = 'reg' | 'att' | 'fbk'

export type Lifecycle = {
  forms: Record<FormKey, FormStatus>
  /** Applicants selected (selective interventions). */
  selected: number
  /** Dates with attendance taken. */
  attendanceDays: number
}

export type SessionRun = Session & { created?: boolean; startDate?: string; endDate?: string; venue?: string; /** Every session date (ISO), for attendance. */ dateList?: string[] }

type State = { created: SessionRun[]; life: Record<string, Lifecycle>; counts: Record<string, Partial<Pick<Session, 'registered' | 'attended' | 'feedback' | 'status'>>> }

const KEY = 'mela-sessions-v1'
let cache: State | null = null
const listeners = new Set<() => void>()

function load(): State {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as State) : { created: [], life: {}, counts: {} }
  } catch {
    cache = { created: [], life: {}, counts: {} }
  }
  return cache
}

function persist(next: State) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* keep the in-memory copy */
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))

let listCache: { state: State | null; list: SessionRun[] } = { state: null, list: [] }

/** Every session: the sample ones (with any progress made) and the ones staff created. */
export function getSessions(): SessionRun[] {
  const s = load()
  if (listCache.state === s) return listCache.list
  const list = [...seedSessions.map((x) => ({ ...x, ...s.counts[x.id] })), ...s.created.map((x) => ({ ...x, ...s.counts[x.id] }))]
  listCache = { state: s, list }
  return list
}

export const useSessions = () => useSyncExternalStore(subscribe, getSessions, getSessions)
export const sessionById = (id: string) => getSessions().find((x) => x.id === id)

/** Where a sample session starts, from its status, so existing sessions read sensibly. */
function defaultLife(s: Session): Lifecycle {
  const forms: Record<FormKey, FormStatus> =
    s.status === 'draft'
      ? { reg: 'draft', att: 'draft', fbk: 'draft' }
      : s.status === 'upcoming'
        ? { reg: 'open', att: 'draft', fbk: 'draft' }
        : s.status === 'completed'
          ? { reg: 'closed', att: 'closed', fbk: 'open' }
          : { reg: 'open', att: 'open', fbk: 'draft' }
  return { forms, selected: s.kind === 'selective' && s.attended > 0 ? Math.max(1, Math.round(s.attended * 0.9)) : 0, attendanceDays: s.attended > 0 ? 1 : 0 }
}

export function lifecycleOf(id: string): Lifecycle {
  const s = load()
  const run = getSessions().find((x) => x.id === id)
  return s.life[id] ?? (run ? defaultLife(run) : { forms: { reg: 'draft', att: 'draft', fbk: 'draft' }, selected: 0, attendanceDays: 0 })
}

export const useLifecycle = (id: string) => {
  useSyncExternalStore(subscribe, load, load)
  return lifecycleOf(id)
}

function setLife(id: string, patch: (l: Lifecycle) => Lifecycle, counts?: State['counts'][string]) {
  const s = load()
  const next = patch(lifecycleOf(id))
  // The session's status follows its process: draft → open → completed.
  const status: Session['status'] = next.forms.fbk === 'closed' ? 'completed' : next.forms.reg !== 'draft' ? 'open' : 'draft'
  const run = getSessions().find((x) => x.id === id)
  const keepStatus = run && !run.created && status === 'open' && run.status === 'upcoming'
  persist({ ...s, life: { ...s.life, [id]: next }, counts: { ...s.counts, [id]: { ...s.counts[id], ...counts, ...(keepStatus ? {} : { status }) } } })
}

export const setFormStatus = (id: string, form: FormKey, status: FormStatus) => setLife(id, (l) => ({ ...l, forms: { ...l.forms, [form]: status } }))
export const recordSelected = (id: string, n: number) => setLife(id, (l) => ({ ...l, selected: Math.max(0, l.selected + n) }))
export const recordAttendance = (id: string, attended?: number) => setLife(id, (l) => ({ ...l, attendanceDays: l.attendanceDays + 1 }), attended != null ? { attended } : undefined)

/** Prototype only: responses can't arrive from real people, so a new session can be filled with sample ones. */
export const addSampleResponses = (id: string, field: 'registered' | 'feedback', n: number) => {
  const s = load()
  persist({ ...s, counts: { ...s.counts, [id]: { ...s.counts[id], [field]: n } } })
}

export type NewSession = { interventionId: string; name: string; dates: string[]; venue: string }

const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** Create a session. Its forms start as drafts, from the intervention's templates. */
export function createSession(input: NewSession): SessionRun {
  const iv = interventions.find((i) => i.id === input.interventionId)
  if (!iv) throw new Error('Choose an intervention.')
  const sorted = [...input.dates].filter(Boolean).sort()
  const s = load()
  const run: SessionRun = {
    id: `s-${Date.now().toString(36)}`,
    name: input.name.trim() || `${iv.name} · Cohort ${iv.sessions + 1}`,
    intervention: iv.name,
    pillar: iv.pillar,
    kind: iv.kind,
    dates: sorted.length > 1 ? `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}` : sorted[0] ? fmt(sorted[0]) : 'Dates to be set',
    status: 'draft',
    registered: 0,
    attended: 0,
    feedback: 0,
    created: true,
    startDate: sorted[0],
    endDate: sorted[sorted.length - 1],
    venue: input.venue,
    dateList: sorted,
  }
  persist({ ...s, created: [...s.created, run], life: { ...s.life, [run.id]: { forms: { reg: 'draft', att: 'draft', fbk: 'draft' }, selected: 0, attendanceDays: 0 } } })
  return run
}

export function resetSessions() {
  persist({ created: [], life: {}, counts: {} })
}
