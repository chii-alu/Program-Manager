/**
 * Add / edit venture (VENTURE-REGISTRY-SPEC §3): the field groups from §2, inline validation
 * (VEN-01 to VEN-05), and founders matched to CHII IDs through resolveBeneficiary.
 */
import React, { useMemo, useState } from 'react'
import { Check, Link2, Search, Sparkles, Trash2, UserPlus, X } from 'lucide-react'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { toast } from '../shared/lib/notify'
import { REPORTING_DATE, foundersOf } from '../shared/ventures/derive'
import { COUNTRIES, CURRENCIES, HEALTH_SECTORS, INSTITUTIONS, LEGAL_STATUSES, SOURCES, STAGES, STATUSES, TRACKS, countryName, regionOf } from '../shared/ventures/lists'
import { allPeople, personById, resolveBeneficiary, type ResolveInput } from '../shared/ventures/people'
import { validateUpdate, validateVenture } from '../shared/ventures/quality'
import { VentureValidationError, addFounder, createVenture, editVenture, endFounder, type UpdateInput, type VentureInput } from '../shared/ventures/store'
import type { LegalStatus, MemberRole, RegistryData, Stage, VentureStatus } from '../shared/ventures/types'
import { Chip, ErrorBox, Field, inputCls } from './parts'

const SMALL_SELECT = 'h-8 rounded-md border border-line bg-surface px-2 text-xs font-medium text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100'

type FounderDraft = { key: string; role: MemberRole; memberId?: string; chiiId?: string; person: ResolveInput }

const blankVenture = (): VentureInput => ({
  name: '',
  description: '',
  healthSector: '',
  source: 'Open call',
  yearFounded: 2024,
  intakeYear: Number(REPORTING_DATE.slice(0, 4)),
  institution: 'ALU',
  track: TRACKS[0],
  legalStatus: 'Informal',
  inAccelerator: false,
  youthLedOverride: null,
  womenLedOverride: null,
  pwdLedOverride: null,
  countries: [],
})
const blankBaseline = (): UpdateInput => ({
  asOf: REPORTING_DATE,
  stage: 'Expose',
  status: 'Active',
  cofoundersCount: null,
  cofoundersFemaleCount: null,
  jobsTotal: 0,
  jobsWomen: 0,
  jobsPwd: 0,
  jobsDisplaced: 0,
  fundingAmount: 0,
  fundingCurrency: 'USD',
  revenueAmount: null,
  revenueCurrency: 'USD',
  notes: '',
})

export function VentureForm({ data, ventureId, me, onDone }: { data: RegistryData; ventureId?: string; me: string; onDone: (id?: string) => void }) {
  const existing = ventureId ? data.ventures.find((v) => v.id === ventureId) : undefined
  const [v, setV] = useState<VentureInput>(() =>
    existing
      ? (() => {
          const { id: _id, code: _c, createdAt: _a, updatedAt: _u, stage: _s, currentStatus: _st, ...rest } = existing
          const countries = data.countries.filter((c) => c.ventureId === existing.id).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((c) => c.countryCode)
          return { ...rest, countries }
        })()
      : blankVenture(),
  )
  const [base, setBase] = useState<UpdateInput>(blankBaseline)
  const [founders, setFounders] = useState<FounderDraft[]>(() =>
    existing
      ? foundersOf(data, existing.id).map((m) => {
          const p = personById(m.chiiId)
          return { key: m.id, role: m.role, memberId: m.id, chiiId: m.chiiId, person: { name: p?.name ?? m.chiiId, email: p?.email } }
        })
      : [],
  )
  const [tried, setTried] = useState(false)
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const set = (p: Partial<VentureInput>) => setV((x) => ({ ...x, ...p }))
  const setB = (p: Partial<UpdateInput>) => setBase((x) => ({ ...x, ...p }))

  const errors = useMemo(() => {
    const out = validateVenture({ ...v, stage: base.stage, currentStatus: base.status }, v.countries)
    if (!existing) out.push(...validateUpdate(base))
    founders.forEach((f, i) => {
      if (!f.chiiId && !f.person.name.trim()) out.push(`Founder ${i + 1}: add a name.`)
      if (!f.chiiId && !f.person.email?.trim() && !f.person.phone?.trim()) out.push(`Founder ${i + 1}: add an email or phone number so they can be matched to a CHII ID.`)
    })
    if (founders.filter((f) => f.role === 'lead_founder').length > 1) out.push('Only one founder can be the lead founder.')
    return out
  }, [v, base, founders, existing])

  // Live preview of the women/youth/PWD-led values the founders give.
  const preview = useMemo(() => previewFlags(founders), [founders])

  const save = () => {
    setTried(true)
    setServerErrors([])
    if (errors.length) return window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      if (!existing) {
        const { venture, founders: res } = createVenture(v, founders.map(toInput), base, me)
        const created = res.filter((r) => r.created).length
        toast({ title: `${venture.code} added`, body: `${venture.name}${res.length ? ` · ${res.length - created} founder${res.length - created === 1 ? '' : 's'} matched to existing CHII IDs, ${created} new` : ''}`, tone: 'good' })
        onDone(venture.id)
      } else {
        editVenture(existing.id, v, me)
        const kept = new Set(founders.map((f) => f.memberId).filter(Boolean))
        for (const m of foundersOf(data, existing.id)) if (!kept.has(m.id)) endFounder(m.id, REPORTING_DATE, me)
        for (const f of founders.filter((x) => !x.memberId)) addFounder(existing.id, toInput(f).person, f.role, me)
        toast({ title: 'Venture saved', body: existing.name, tone: 'good' })
        onDone(existing.id)
      }
    } catch (e) {
      if (e instanceof VentureValidationError) {
        setServerErrors(e.messages)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else throw e
    }
  }

  const shownErrors = [...serverErrors, ...(tried ? errors : [])]

  return (
    <>
      <PageHeader
        crumbs={['HENT', 'Ventures', 'Registry', existing ? existing.code : 'New']}
        title={existing ? `Edit ${existing.name}` : 'Add a venture'}
        description={existing ? 'Stage and status change through updates, so their history is kept.' : 'The details, the founders (each matched to a CHII ID) and the baseline numbers.'}
      />
      <ErrorBox errors={shownErrors} />

      <Panel title="Venture details">
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
          <Field label="Venture name" required hint="Must be unique.">
            <input className={inputCls} value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. AfyaLink" />
          </Field>
          <Field label="Health sector" required>
            <select className={inputCls} value={v.healthSector} onChange={(e) => set({ healthSector: e.target.value })}>
              <option value="">Choose…</option>
              {HEALTH_SECTORS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Description" hint={`${v.description.length} / 200 characters`}>
              <input className={inputCls} maxLength={220} value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="One line: what it does and for whom" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <CountryPicker value={v.countries} onChange={(countries) => set({ countries })} />
          </div>
          <Field label="Source" hint="How the venture came to CHII.">
            <select className={inputCls} value={v.source} onChange={(e) => set({ source: e.target.value })}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Track">
            <select className={inputCls} value={v.track} onChange={(e) => set({ track: e.target.value })}>
              {TRACKS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Year founded">
            <input type="number" className={inputCls} value={v.yearFounded} min={1990} max={2025} onChange={(e) => set({ yearFounded: Number(e.target.value) })} />
          </Field>
          <Field label="Intake year" required hint="The year it joined the CHII portfolio.">
            <input type="number" className={inputCls} value={v.intakeYear} min={2015} max={2025} onChange={(e) => set({ intakeYear: Number(e.target.value) })} />
          </Field>
          <Field label="Institution">
            <select className={inputCls} value={v.institution} onChange={(e) => set({ institution: e.target.value })}>
              {INSTITUTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title="Founders" sub="Each founder is matched to a CHII ID by email, phone or student ID, or given a new one. Names stay in restricted records.">
        <FounderEditor founders={founders} setFounders={setFounders} />
      </Panel>

      <Panel title="Stage and status">
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-3">
          {existing ? (
            <p className="md:col-span-3 rounded-lg bg-canvas px-3 py-2.5 text-sm text-body">
              Stage <b className="text-ink">{existing.stage}</b> and status <b className="text-ink">{existing.currentStatus}</b> come from the latest update. Use <b>Record update</b> on the venture page to change them.
            </p>
          ) : (
            <>
              <Field label="Stage" required>
                <select className={inputCls} value={base.stage} onChange={(e) => setB({ stage: e.target.value as Stage })}>
                  {STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Current status" required>
                <select className={inputCls} value={base.status} onChange={(e) => setB({ status: e.target.value as VentureStatus })}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Legal status">
            <select className={inputCls} value={v.legalStatus} onChange={(e) => set({ legalStatus: e.target.value as LegalStatus })}>
              {LEGAL_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="In an accelerator?">
            <div className="flex gap-1.5">
              <Chip on={v.inAccelerator} onClick={() => set({ inAccelerator: true })}>
                Yes
              </Chip>
              <Chip on={!v.inAccelerator} onClick={() => set({ inAccelerator: false })}>
                No
              </Chip>
            </div>
          </Field>
          <FlagField label="Women-led?" rule="At least one female founder" derived={preview.womenLed} value={v.womenLedOverride} onChange={(x) => set({ womenLedOverride: x })} />
          <FlagField label="Youth-led?" rule="Lead founder aged 35 or under" derived={preview.youthLed} value={v.youthLedOverride} onChange={(x) => set({ youthLedOverride: x })} />
          <FlagField label="PWD-led?" rule="At least one founder with a disability" derived={preview.pwdLed} value={v.pwdLedOverride} onChange={(x) => set({ pwdLedOverride: x })} />
        </div>
      </Panel>

      {!existing && (
        <Panel title="Baseline" sub="The venture’s numbers when it joins the registry. Stored as the first update; later updates never change it.">
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-4">
            <Field label="As of" required>
              <input type="date" className={inputCls} value={base.asOf} max={REPORTING_DATE} onChange={(e) => setB({ asOf: e.target.value })} />
            </Field>
            {(['jobsTotal', 'jobsWomen', 'jobsPwd', 'jobsDisplaced'] as const).map((k) => (
              <Field key={k} label={{ jobsTotal: 'Total jobs', jobsWomen: 'Women jobs', jobsPwd: 'PWD jobs', jobsDisplaced: 'Displaced persons jobs' }[k]}>
                <input type="number" min={0} className={inputCls} value={base[k]} onChange={(e) => setB({ [k]: Number(e.target.value || 0) })} />
              </Field>
            ))}
            <div className="md:col-span-2">
              <Field label="Funding raised to date" hint="External funding only.">
                <div className="flex gap-2">
                  <select className={`${inputCls} w-24`} value={base.fundingCurrency} onChange={(e) => setB({ fundingCurrency: e.target.value })}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <input type="number" min={0} className={inputCls} value={base.fundingAmount} onChange={(e) => setB({ fundingAmount: Number(e.target.value || 0) })} />
                </div>
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Revenue, last 12 months">
                <div className="flex gap-2">
                  <select className={`${inputCls} w-24`} value={base.revenueCurrency ?? 'USD'} onChange={(e) => setB({ revenueCurrency: e.target.value })}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <input type="number" min={0} className={inputCls} value={base.revenueAmount ?? ''} placeholder="Not reported" onChange={(e) => setB({ revenueAmount: e.target.value === '' ? null : Number(e.target.value) })} />
                </div>
              </Field>
            </div>
            {founders.length === 0 && (
              <>
                <Field label="Co-founders (#)" hint="Only when founders aren’t recorded.">
                  <input type="number" min={0} className={inputCls} value={base.cofoundersCount ?? ''} onChange={(e) => setB({ cofoundersCount: e.target.value === '' ? null : Number(e.target.value) })} />
                </Field>
                <Field label="Co-founders female (#)">
                  <input type="number" min={0} className={inputCls} value={base.cofoundersFemaleCount ?? ''} onChange={(e) => setB({ cofoundersFemaleCount: e.target.value === '' ? null : Number(e.target.value) })} />
                </Field>
              </>
            )}
          </div>
        </Panel>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:pl-5 sm:pr-24">
        <Button onClick={() => onDone(existing?.id)}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          <Check className="h-4 w-4" /> {existing ? 'Save changes' : 'Add venture'}
        </Button>
      </div>
    </>
  )
}

const toInput = (f: FounderDraft) => ({ person: f.chiiId ? { name: f.person.name, email: personById(f.chiiId)?.email || undefined, phone: personById(f.chiiId)?.phone, studentId: personById(f.chiiId)?.studentId } : f.person, role: f.role })

/** What women/youth/PWD-led would be for these founders (the same rules as the registry views). */
function previewFlags(founders: FounderDraft[]) {
  // A new person whose email/phone matches an existing CHII ID will be linked to that person, so use their details.
  const people = founders.map((f) => {
    const id = f.chiiId ?? matchOf(f.person)
    return id ? personById(id) : { chiiId: '', name: f.person.name, email: f.person.email ?? '', gender: f.person.gender ?? 'X', dob: f.person.dob, disability: f.person.disability }
  })
  const genders = people.map((p) => (p && p.gender !== 'X' ? p.gender === 'F' : undefined))
  const lead = founders.findIndex((f) => f.role === 'lead_founder')
  const leadP = lead >= 0 ? people[lead] : null
  const age = leadP?.dob ? Number(REPORTING_DATE.slice(0, 4)) - Number(leadP.dob.slice(0, 4)) - (REPORTING_DATE.slice(5) < leadP.dob.slice(5) ? 1 : 0) : null
  const any = (xs: (boolean | undefined)[]) => (xs.some((x) => x === true) ? true : xs.length && xs.every((x) => x === false) ? false : null)
  return { womenLed: any(genders), youthLed: age == null ? null : age <= 35, pwdLed: any(people.map((p) => p?.disability)) }
}

function matchOf(p: ResolveInput): string | null {
  if (!p.email?.trim() && !p.phone?.trim() && !p.studentId?.trim()) return null
  try {
    return resolveBeneficiary(p, { create: false }).chiiId || null
  } catch {
    return null
  }
}

function FlagField({ label, rule, derived, value, onChange }: { label: string; rule: string; derived: boolean | null; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const auto = derived == null ? 'Unknown' : derived ? 'Yes' : 'No'
  const mismatch = value != null && derived != null && value !== derived
  return (
    <Field label={label} hint={mismatch ? <span className="text-warn">Differs from the founders’ data ({auto}). It will be flagged for checking.</span> : `${rule}. From the founders: ${auto}.`}>
      <div className="flex flex-wrap gap-1.5">
        <Chip on={value == null} onClick={() => onChange(null)}>
          <Sparkles className="h-3 w-3" /> Auto ({auto})
        </Chip>
        <Chip on={value === true} onClick={() => onChange(true)}>
          Yes
        </Chip>
        <Chip on={value === false} onClick={() => onChange(false)}>
          No
        </Chip>
      </div>
    </Field>
  )
}

/* ---------- Countries: first one is the primary country ---------- */

function CountryPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Field label="Country of operation" required hint={value.length ? `Region: ${regionOf(value[0])} (from the primary country)` : 'The first country is the primary one; the region comes from it.'}>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((c, i) => (
          <span key={c} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${i === 0 ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-body'}`}>
            {countryName(c)}
            {i === 0 && value.length > 1 && <span className="text-[10px] uppercase opacity-75">primary</span>}
            <button type="button" aria-label={`Remove ${countryName(c)}`} onClick={() => onChange(value.filter((x) => x !== c))} className="opacity-70 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <select className={SMALL_SELECT} value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">{value.length ? '+ Add another country' : 'Choose a country…'}</option>
          {COUNTRIES.filter((c) => !value.includes(c.code)).map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </Field>
  )
}

/* ---------- Founders: find an existing person, or add a new one ---------- */

function FounderEditor({ founders, setFounders }: { founders: FounderDraft[]; setFounders: React.Dispatch<React.SetStateAction<FounderDraft[]>> }) {
  const [q, setQ] = useState('')
  const people = useMemo(() => allPeople(), [])
  const hits = q.trim().length >= 2 ? people.filter((p) => `${p.name} ${p.email} ${p.chiiId}`.toLowerCase().includes(q.trim().toLowerCase()) && !founders.some((f) => f.chiiId === p.chiiId)).slice(0, 6) : []
  const nextRole = (): MemberRole => (founders.some((f) => f.role === 'lead_founder') ? 'co_founder' : 'lead_founder')
  const update = (key: string, p: Partial<FounderDraft>) => setFounders((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f)))

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {founders.map((f, i) => (
        <div key={f.key} className="rounded-lg border border-line p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">Founder {i + 1}</span>
            <select className={SMALL_SELECT} value={f.role} onChange={(e) => update(f.key, { role: e.target.value as MemberRole })}>
              <option value="lead_founder">Lead founder</option>
              <option value="co_founder">Co-founder</option>
            </select>
            <button type="button" onClick={() => setFounders((fs) => fs.filter((x) => x.key !== f.key))} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-bad hover:underline">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
          {f.chiiId ? (
            <p className="flex items-center gap-2 text-sm">
              <Link2 className="h-4 w-4 text-good" />
              <b className="text-ink">{f.person.name}</b>
              <span className="font-mono text-xs text-brand-600">{f.chiiId}</span>
              <span className="text-xs text-muted">· existing CHII ID</span>
            </p>
          ) : (
            <NewPerson draft={f} onChange={(person) => update(f.key, { person })} onUse={(id) => update(f.key, { chiiId: id, person: { name: personById(id)?.name ?? id, email: personById(id)?.email } })} />
          )}
        </div>
      ))}

      <div className="rounded-lg border border-dashed border-line-strong p-3">
        <p className="mb-2 text-[13px] font-semibold text-ink">Add a founder</p>
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an existing person by name, email or CHII ID" />
          </label>
          <Button onClick={() => setFounders((fs) => [...fs, { key: `new-${Date.now()}`, role: nextRole(), person: { name: '', email: '', gender: 'F' } }])}>
            <UserPlus className="h-4 w-4" /> New person
          </Button>
        </div>
        {hits.length > 0 && (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
            {hits.map((p) => (
              <li key={p.chiiId}>
                <button
                  type="button"
                  onClick={() => {
                    setFounders((fs) => [...fs, { key: `p-${p.chiiId}`, role: nextRole(), chiiId: p.chiiId, person: { name: p.name, email: p.email } }])
                    setQ('')
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-canvas"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <b className="text-ink">{p.name}</b> <span className="text-muted">· {p.email}</span>
                  </span>
                  <span className="font-mono text-xs text-brand-600">{p.chiiId}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function NewPerson({ draft, onChange, onUse }: { draft: FounderDraft; onChange: (p: ResolveInput) => void; onUse: (chiiId: string) => void }) {
  const p = draft.person
  const set = (x: Partial<ResolveInput>) => onChange({ ...p, ...x })
  // Would these details match someone who already has a CHII ID? (No record is created here.)
  const match = useMemo(() => {
    if (!p.email?.trim() && !p.phone?.trim() && !p.studentId?.trim()) return null
    try {
      const r = resolveBeneficiary(p, { create: false })
      return r.chiiId ? { ...r, person: personById(r.chiiId) } : null
    } catch {
      return null
    }
  }, [p.email, p.phone, p.studentId])
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Name" required>
          <input className={inputCls} value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input type="email" className={inputCls} value={p.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={p.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} placeholder="+250…" />
        </Field>
        <Field label="Gender">
          <select className={inputCls} value={p.gender ?? 'X'} onChange={(e) => set({ gender: e.target.value as ResolveInput['gender'] })}>
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="X">Not given</option>
          </select>
        </Field>
        <Field label="Date of birth" hint="Used for youth-led.">
          <input type="date" className={inputCls} value={p.dob ?? ''} onChange={(e) => set({ dob: e.target.value || undefined })} />
        </Field>
        <Field label="Person with a disability?">
          <select className={inputCls} value={p.disability == null ? '' : p.disability ? 'yes' : 'no'} onChange={(e) => set({ disability: e.target.value === '' ? undefined : e.target.value === 'yes' })}>
            <option value="">Not known</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>
      {match ? (
        <p className="flex items-center gap-2 rounded-md bg-good-bg px-3 py-2 text-[13px] text-good">
          <Link2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            Matches <b>{match.person?.name}</b> (<span className="font-mono">{match.chiiId}</span>) by {match.matchedOn?.replace('_', ' ')}. They’ll be linked to that CHII ID, not created again, and their
            recorded details are used.
          </span>
          <button type="button" onClick={() => onUse(match.chiiId)} className="shrink-0 rounded-md bg-good px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90">
            Use this person
          </button>
        </p>
      ) : p.email?.trim() || p.phone?.trim() ? (
        <p className="rounded-md bg-canvas px-3 py-2 text-[13px] text-muted">No existing match: a new CHII ID will be created when you save.</p>
      ) : null}
    </div>
  )
}
