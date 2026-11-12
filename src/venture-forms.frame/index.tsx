/**
 * Public venture forms (no login):
 *   ?start=venture-register              → founders register their venture; staff review it before it enters the registry
 *   ?start=venture-update&token=<token>  → a founder's personal update link; no CHII ID is shown
 *
 * Prototype note: answers are kept in this browser's storage, so they reach the registry only when
 * the form is opened in the same browser as the staff pages. A server version stores them centrally.
 */
import React, { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Eye, Lock, Plus, Trash2 } from 'lucide-react'
import { PortalMark } from '../shared/components/Brand'
import { acceptedUpdates } from '../shared/ventures/derive'
import { COUNTRIES, CURRENCIES, HEALTH_SECTORS, INSTITUTIONS, LEGAL_STATUSES, SOURCES, STATUSES, countryName } from '../shared/ventures/lists'
import { personById } from '../shared/ventures/people'
import { validateUpdate } from '../shared/ventures/quality'
import { FormClosedError, VentureValidationError, checkRegistration, currentRound, getRegistry, linkByToken, settingsOf, submitFounderUpdate, submitRegistration, type RegistrationInput, type UpdateInput } from '../shared/ventures/store'
import type { LegalStatus, Stage, VentureStatus } from '../shared/ventures/types'

export const args = { kind: 'register' as 'register' | 'update', preview: false }

type Props = Partial<typeof args> & { token?: string; onExitPreview?: () => void }

const STAGE_HELP: Record<Stage, string> = {
  Expose: 'Idea or early testing: you’re shaping the problem and the solution.',
  Build: 'You have a product or service and your first users or customers.',
  Scale: 'Growing: more customers, places or revenue, and a steady team.',
}

export default function VentureForms(props: Props) {
  const { kind, preview, onExitPreview } = { ...args, ...props }
  const token = props.token ?? (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') ?? '' : '')
  return (
    <div className="min-h-full overflow-y-auto bg-canvas">
      {preview && (
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-brand px-4 py-2.5 text-sm text-white">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Preview · this is what founders see</span>
          {onExitPreview && (
            <button type="button" onClick={onExitPreview} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold hover:bg-white/25">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
        </div>
      )}
      <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
        <PortalMark portal="hent" />
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">{kind === 'update' ? <UpdateForm token={token} /> : <RegisterForm />}</div>
        <p className="mt-6 text-center text-xs text-faint">© 2026 CHII · African Leadership University</p>
      </div>
    </div>
  )
}

/* ---------- Registration ---------- */

type FounderRow = RegistrationInput['founders'][number]
const blankFounder = (): FounderRow => ({ name: '', email: '', phone: '', gender: 'F' })

function RegisterForm() {
  const open = settingsOf(getRegistry()).registrationOpen
  const [r, setR] = useState<RegistrationInput>({
    name: '',
    description: '',
    countries: [],
    healthSector: '',
    source: '',
    yearFounded: 2025,
    institution: '',
    legalStatus: 'Informal',
    stage: 'Expose',
    founders: [blankFounder()],
    jobsTotal: 0,
    jobsWomen: 0,
    jobsPwd: 0,
    jobsDisplaced: 0,
    fundingAmount: 0,
    fundingCurrency: 'USD',
    revenueAmount: null,
    revenueCurrency: 'USD',
  })
  const [consent, setConsent] = useState(false)
  const [tried, setTried] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const set = (p: Partial<RegistrationInput>) => setR((x) => ({ ...x, ...p }))
  const setF = (i: number, p: Partial<FounderRow>) => set({ founders: r.founders.map((f, j) => (j === i ? { ...f, ...p } : f)) })
  const live = useMemo(() => (tried ? checkRegistration({ ...r, source: r.source || 'Other', institution: r.institution || 'Other' }) : []), [r, tried])

  if (!open) return <Closed title="Registration is closed" body="The HENT team isn’t taking new venture registrations right now. Contact them if you think this is a mistake." />
  if (done)
    return (
      <Thanks
        title="Thank you! We’ve received your registration"
        body="The HENT team will review it and add it to the CHII venture registry. They may contact the lead founder by email. Twice a year you’ll get a short form to update your numbers."
      />
    )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    const input = { ...r, source: r.source || 'Other', institution: r.institution || 'Other' }
    const problems = checkRegistration(input)
    if (problems.length || !consent) return setErrors([...problems, ...(consent ? [] : ['Tick the box to agree to how CHII uses your answers.'])])
    try {
      submitRegistration(input)
      setDone(true)
      window.scrollTo({ top: 0 })
    } catch (err) {
      if (err instanceof VentureValidationError) setErrors(err.messages)
      else if (err instanceof FormClosedError) setErrors([err.message])
      else throw err
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Header title="Register your health venture" sub="For ventures supported by CHII’s Health Entrepreneurship (HENT) programmes. Takes about 5 minutes." />
      <div className="space-y-6 px-5 py-5 sm:px-6">
        <Errors list={errors.length ? errors : live} />

        <Section title="About your venture">
          <Q label="Venture name" required>
            <input className={input} value={r.name} onChange={(e) => set({ name: e.target.value })} />
          </Q>
          <Q label="What does it do, in one line?" required hint={`${r.description.length} / 200`}>
            <input className={input} maxLength={200} value={r.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Rapid malaria tests for rural pharmacies" />
          </Q>
          <Q label="Where do you operate?" required hint="Your main country first. Add more if you work in several.">
            <div className="flex flex-wrap gap-1.5">
              {r.countries.map((c, i) => (
                <button key={c} type="button" onClick={() => set({ countries: r.countries.filter((x) => x !== c) })} className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm ${i === 0 ? 'border-brand bg-brand text-white' : 'border-line-strong text-body'}`}>
                  {countryName(c)} <span aria-hidden>×</span>
                </button>
              ))}
              <select className={`${input} h-9 w-auto text-sm`} value="" onChange={(e) => e.target.value && set({ countries: [...r.countries, e.target.value] })}>
                <option value="">{r.countries.length ? '+ Add a country' : 'Choose a country'}</option>
                {COUNTRIES.filter((c) => !r.countries.includes(c.code)).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </Q>
          <div className="grid gap-4 sm:grid-cols-2">
            <Q label="Health sector" required>
              <select className={input} value={r.healthSector} onChange={(e) => set({ healthSector: e.target.value })}>
                <option value="">Choose…</option>
                {HEALTH_SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Q>
            <Q label="Year founded" required>
              <input type="number" min={1990} max={2025} className={input} value={r.yearFounded} onChange={(e) => set({ yearFounded: Number(e.target.value) })} />
            </Q>
            <Q label="How did you come to CHII?">
              <select className={input} value={r.source} onChange={(e) => set({ source: e.target.value })}>
                <option value="">Choose…</option>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
                <option>Other</option>
              </select>
            </Q>
            <Q label="Institution">
              <select className={input} value={r.institution} onChange={(e) => set({ institution: e.target.value })}>
                <option value="">Choose…</option>
                {INSTITUTIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Q>
            <Q label="Is the venture registered?">
              <select className={input} value={r.legalStatus} onChange={(e) => set({ legalStatus: e.target.value as LegalStatus })}>
                {LEGAL_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Q>
          </div>
          <Q label="Which stage are you at?" required>
            <StageChoice value={r.stage} onChange={(stage) => set({ stage })} />
          </Q>
        </Section>

        <Section title="Founders" hint="We use emails to link founders to their CHII records, so each person is counted once. They aren’t shared outside CHII.">
          {r.founders.map((f, i) => (
            <div key={i} className="rounded-xl border border-line p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted">{i === 0 ? 'Lead founder' : `Co-founder ${i}`}</span>
                {i > 0 && (
                  <button type="button" onClick={() => set({ founders: r.founders.filter((_, j) => j !== i) })} className="inline-flex items-center gap-1 text-xs font-semibold text-bad">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Q label="Full name" required>
                  <input className={input} value={f.name} onChange={(e) => setF(i, { name: e.target.value })} />
                </Q>
                <Q label="Email" required>
                  <input type="email" className={input} value={f.email} onChange={(e) => setF(i, { email: e.target.value })} />
                </Q>
                <Q label="Gender">
                  <select className={input} value={f.gender} onChange={(e) => setF(i, { gender: e.target.value as FounderRow['gender'] })}>
                    <option value="F">Female</option>
                    <option value="M">Male</option>
                    <option value="X">Prefer not to say</option>
                  </select>
                </Q>
                <Q label="Date of birth" hint="Optional">
                  <input type="date" className={input} value={f.dob ?? ''} onChange={(e) => setF(i, { dob: e.target.value || undefined })} />
                </Q>
                {i === 0 && (
                  <Q label="Phone" hint="Optional">
                    <input className={input} value={f.phone ?? ''} onChange={(e) => setF(i, { phone: e.target.value })} placeholder="+250…" />
                  </Q>
                )}
                <Q label="Do you live with a disability?" hint="Optional">
                  <select className={input} value={f.disability == null ? '' : f.disability ? 'yes' : 'no'} onChange={(e) => setF(i, { disability: e.target.value === '' ? undefined : e.target.value === 'yes' })}>
                    <option value="">Prefer not to say</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </Q>
              </div>
            </div>
          ))}
          {r.founders.length < 5 && (
            <button type="button" onClick={() => set({ founders: [...r.founders, blankFounder()] })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
              <Plus className="h-4 w-4" /> Add a co-founder
            </button>
          )}
        </Section>

        <Section title="Your numbers today" hint="Your best estimate is fine. These become your starting point.">
          <NumbersFields value={r} onChange={(p) => set(p)} />
        </Section>

        <Consent checked={consent} onChange={setConsent} />
      </div>
      <Submit label="Register my venture" />
    </form>
  )
}

/* ---------- Founder update ---------- */

function UpdateForm({ token }: { token: string }) {
  const d = getRegistry()
  const link = token ? linkByToken(token) : null
  const v = link ? d.ventures.find((x) => x.id === link.ventureId) : null
  const round = currentRound(d)
  const last = v ? acceptedUpdates(d, v.id, '9999-12-31').slice(-1)[0] : undefined
  const [u, setU] = useState<UpdateInput>(() => ({
    asOf: new Date().toISOString().slice(0, 10) > '2025-11-10' ? '2025-11-10' : new Date().toISOString().slice(0, 10),
    stage: last?.stage ?? 'Expose',
    status: last?.status ?? 'Active',
    cofoundersCount: last?.cofoundersCount ?? null,
    cofoundersFemaleCount: last?.cofoundersFemaleCount ?? null,
    jobsTotal: last?.jobsTotal ?? 0,
    jobsWomen: last?.jobsWomen ?? 0,
    jobsPwd: last?.jobsPwd ?? 0,
    jobsDisplaced: last?.jobsDisplaced ?? 0,
    fundingAmount: last?.fundingAmount ?? 0,
    fundingCurrency: last?.fundingCurrency ?? 'USD',
    revenueAmount: last?.revenueAmount ?? null,
    revenueCurrency: last?.revenueCurrency ?? 'USD',
    notes: '',
  }))
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)

  if (!link || !v) return <Closed title="This link isn’t valid" body="It may be from an earlier round, or mistyped. Ask the HENT team for your current update link." />
  if (done) return <Thanks title="Thank you for the update" body={`The HENT team will check it and add it to ${v.name}’s record. Nothing you sent before is changed.`} />

  const first = personById(link.chiiId)?.name.split(' ')[0]
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const problems = validateUpdate(u)
    if (problems.length || !consent) return setErrors([...problems, ...(consent ? [] : ['Tick the box to agree to how CHII uses your answers.'])])
    try {
      submitFounderUpdate(token, u)
      setDone(true)
      window.scrollTo({ top: 0 })
    } catch (err) {
      if (err instanceof VentureValidationError) setErrors(err.messages)
      else if (err instanceof FormClosedError) setErrors([err.message])
      else throw err
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <Header title={`Update for ${v.name}`} sub={`${round.label} · please reply by ${new Date(round.dueOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}. Takes about 2 minutes.`} />
      <div className="space-y-6 px-5 py-5 sm:px-6">
        {first && <p className="text-[15px] text-body">Hi {first}, we’ve filled in what you told us last time. Change anything that’s different now.</p>}
        {link.respondedAt && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-600">You already sent an update this round. Sending another replaces it for our review.</p>}
        <Errors list={errors} />
        <Section title="Where the venture is now">
          <Q label="Stage" required>
            <StageChoice value={u.stage} onChange={(stage) => setU({ ...u, stage })} />
          </Q>
          <Q label="Status" required>
            <select className={input} value={u.status} onChange={(e) => setU({ ...u, status: e.target.value as VentureStatus })}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Q>
        </Section>
        <Section title="Your numbers now" hint={last ? `Last time (${new Date(last.asOf).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}): ${last.jobsTotal} jobs, funding raised ${last.fundingCurrency} ${last.fundingAmount.toLocaleString()}.` : undefined}>
          <NumbersFields value={u} onChange={(p) => setU({ ...u, ...p })} />
        </Section>
        <Q label="What changed since last time?" hint="Optional: a new contract, a funding round, a new team member…">
          <textarea rows={3} className={`${input} h-auto py-2.5`} value={u.notes} onChange={(e) => setU({ ...u, notes: e.target.value })} />
        </Q>
        <Consent checked={consent} onChange={setConsent} />
      </div>
      <Submit label="Send update" />
    </form>
  )
}

/* ---------- Shared pieces ---------- */

type Numbers = Pick<UpdateInput, 'jobsTotal' | 'jobsWomen' | 'jobsPwd' | 'jobsDisplaced' | 'fundingAmount' | 'fundingCurrency' | 'revenueAmount' | 'revenueCurrency'>

function NumbersFields({ value, onChange }: { value: Numbers; onChange: (p: Partial<Numbers>) => void }) {
  const n = (k: 'jobsTotal' | 'jobsWomen' | 'jobsPwd' | 'jobsDisplaced') => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [k]: e.target.value === '' ? 0 : Math.max(0, Math.floor(Number(e.target.value))) })
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Q label="People employed" required hint="Including founders">
          <input type="number" inputMode="numeric" min={0} className={input} value={value.jobsTotal} onChange={n('jobsTotal')} />
        </Q>
        <Q label="…of whom women">
          <input type="number" inputMode="numeric" min={0} className={input} value={value.jobsWomen} onChange={n('jobsWomen')} />
        </Q>
        <Q label="…people with a disability">
          <input type="number" inputMode="numeric" min={0} className={input} value={value.jobsPwd} onChange={n('jobsPwd')} />
        </Q>
        <Q label="…refugees or displaced people">
          <input type="number" inputMode="numeric" min={0} className={input} value={value.jobsDisplaced} onChange={n('jobsDisplaced')} />
        </Q>
      </div>
      <Q label="Funding raised so far" hint="All grants, investment, loans and prizes to date, not counting CHII awards.">
        <div className="flex gap-2">
          <select className={`${input} w-28`} value={value.fundingCurrency} onChange={(e) => onChange({ fundingCurrency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input type="number" inputMode="numeric" min={0} className={input} value={value.fundingAmount} onChange={(e) => onChange({ fundingAmount: Math.max(0, Number(e.target.value || 0)) })} />
        </div>
      </Q>
      <Q label="Revenue in the last 12 months" hint="Optional. Leave empty if you’d rather not say.">
        <div className="flex gap-2">
          <select className={`${input} w-28`} value={value.revenueCurrency ?? 'USD'} onChange={(e) => onChange({ revenueCurrency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input type="number" inputMode="numeric" min={0} className={input} value={value.revenueAmount ?? ''} onChange={(e) => onChange({ revenueAmount: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />
        </div>
      </Q>
    </>
  )
}

function StageChoice({ value, onChange }: { value: Stage; onChange: (s: Stage) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(STAGE_HELP) as Stage[]).map((s) => (
        <button key={s} type="button" aria-pressed={value === s} onClick={() => onChange(s)} className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${value === s ? 'border-brand bg-brand-50 ring-2 ring-brand/20' : 'border-line-strong hover:bg-canvas'}`}>
          <span className="block text-sm font-semibold text-ink">{s}</span>
          <span className="mt-0.5 block text-xs leading-4 text-muted">{STAGE_HELP[s]}</span>
        </button>
      ))}
    </div>
  )
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="border-b border-line px-5 py-5 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{sub}</p>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-600">{title}</legend>
      {hint && <p className="-mt-2 text-xs text-muted">{hint}</p>}
      {children}
    </fieldset>
  )
}

function Q({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-bad"> *</span>}
      </span>
      {hint && <span className="-mt-1 mb-1.5 block text-xs text-muted">{hint}</span>}
      {children}
    </label>
  )
}

function Errors({ list }: { list: string[] }) {
  if (!list.length) return null
  return (
    <div role="alert" className="rounded-lg border border-bad/30 bg-bad-bg px-4 py-3 text-sm text-bad">
      <p className="font-semibold">Please check:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {list.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  )
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-lg bg-canvas px-3 py-3 text-sm leading-6 text-body">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-brand" />
      I agree that CHII at African Leadership University may store and use these answers to support my venture and to report on its programmes. Reports only show totals, never names.
    </label>
  )
}

function Submit({ label }: { label: string }) {
  return (
    <div className="border-t border-line px-5 py-4 sm:px-6">
      <button type="submit" className="h-12 w-full rounded-lg bg-brand text-[15px] font-semibold text-white transition-colors duration-150 ease-out hover:bg-brand-hover">
        {label}
      </button>
    </div>
  )
}

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <Lock className="mx-auto h-8 w-8 text-faint" />
      <h1 className="mt-4 text-lg font-semibold">{title}</h1>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
    </div>
  )
}

function Thanks({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-good" />
      <h1 className="mt-4 text-lg font-semibold">{title}</h1>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{body}</p>
    </div>
  )
}

const input = 'h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100'
