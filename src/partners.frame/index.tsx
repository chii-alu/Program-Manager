/**
 * Tools → Partners: the partnership bank. Like Resources, but for the organisations a pillar
 * works with: which interventions each supports, what they offer, the agreement, the contact and
 * when we last spoke. Each pillar sees only its own partners; MELA sees every pillar's.
 */
import React, { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ArrowRight, Download, ExternalLink, FileText, Handshake, Mail, Pencil, Phone, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel, PillarTag } from '../shared/components/ui'
import { Modal } from '../shared/components/Modal'
import { EmptyState } from '../shared/components/EmptyState'
import { Portal, Role, pillarsFor, type Pillar } from '../shared/data/mela'
import { userFor } from '../shared/lib/auth'
import { toast } from '../shared/lib/notify'
import { TODAY } from '../shared/lib/time'
import {
  OFFERS,
  PARTNER_STATUSES,
  PARTNER_TYPES,
  PartnerError,
  addPartner,
  daysToEnd,
  interventionsOf,
  partnerRef,
  partnersFor,
  removePartner,
  updatePartner,
  usePartners,
  type Partner,
  type PartnerDoc,
  type PartnerInput,
  type PartnerStatus,
  type PartnerType,
} from '../shared/data/partners'

export const args = { role: 'pillar_lead', portal: 'hemp' }

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

type View = 'all' | 'active' | 'pipeline' | 'renewal'
const today = format(TODAY, 'yyyy-MM-dd')
const day = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
/** Agreements ending within this many days are flagged for renewal. */
const RENEW_DAYS = 90

export default function Partners(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const me = userFor(role, portal).user
  const pillars = pillarsFor(portal)
  const { items } = usePartners()
  const mine = useMemo(() => partnersFor(items, pillars), [items, portal])
  const [view, setView] = useState<View>('all')
  const [q, setQ] = useState('')
  const [iv, setIv] = useState('all')
  const [type, setType] = useState<PartnerType | 'all'>('all')
  const [pillarF, setPillarF] = useState<Pillar | 'all'>('all')
  const [form, setForm] = useState<null | { partner?: Partner }>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Partner | null>(null)
  const writer = role === 'admin' || role === 'pillar_lead' || role === 'pillar_staff'
  const canDelete = (x: Partner) => role === 'admin' || role === 'pillar_lead' || x.addedBy === me
  const renewal = (x: Partner) => {
    const d = daysToEnd(x, today)
    return d != null && d <= RENEW_DAYS && x.status !== 'Ended'
  }
  const ivChoices = [...new Set(pillars.flatMap(interventionsOf))]

  const inView = (x: Partner) => (view === 'all' ? true : view === 'active' ? x.status === 'Active' : view === 'pipeline' ? x.status === 'Prospect' || x.status === 'In talks' : renewal(x))
  const rows = mine.filter(
    (x) =>
      inView(x) &&
      (iv === 'all' || x.interventions.includes(iv)) &&
      (type === 'all' || x.type === type) &&
      (pillarF === 'all' || x.pillar === pillarF) &&
      (!q.trim() || `${partnerRef(x)} ${x.name} ${x.type} ${x.notes ?? ''} ${x.contactName ?? ''} ${x.country ?? ''} ${x.interventions.join(' ')} ${x.offers.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())),
  )
  rows.sort((a, b) => a.pillar.localeCompare(b.pillar) || (a.no ?? 0) - (b.no ?? 0))
  const open = mine.find((x) => x.id === openId)

  return (
    <AppShell role={role} portal={portal} active="partners" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
        <PageHeader
          crumbs={[portal === 'admin' ? 'MELA' : portal.toUpperCase(), 'Tools', 'Partners']}
          title="Partnership Bank"
          description={`The organisations ${portal === 'admin' ? 'each pillar works' : `${portal.toUpperCase()} works`} with: which interventions they support, what they offer, the agreement and who to talk to.`}
          actions={
            writer ? (
              <Button variant="primary" className="w-full sm:w-auto" onClick={() => setForm({})}>
                <Plus className="h-4 w-4" /> Add a partner
              </Button>
            ) : undefined
          }
        />

        <Panel>
          <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3">
            {(
              [
                ['all', 'All partners', mine.length],
                ['active', 'Active', mine.filter((x) => x.status === 'Active').length],
                ['pipeline', 'Prospects and talks', mine.filter((x) => x.status === 'Prospect' || x.status === 'In talks').length],
                ['renewal', 'Agreements to renew', mine.filter(renewal).length],
              ] as [View, string, number][]
            ).map(([k, l, n]) => (
              <button key={k} role="tab" type="button" aria-selected={view === k} onClick={() => setView(k)} className={`relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium ${view === k ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                {l}
                <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${view === k ? 'bg-brand-50 text-brand-600' : k === 'renewal' && n ? 'bg-warn-bg text-warn' : 'bg-canvas text-muted'}`}>{n}</span>
                {view === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1 lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, name, contact, country or offer" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
            </label>
            <select value={iv} onChange={(e) => setIv(e.target.value)} aria-label="Intervention" className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-brand-600">
              <option value="all">All interventions</option>
              {ivChoices.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value as PartnerType | 'all')} aria-label="Type" className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-brand-600">
              <option value="all">All types</option>
              {PARTNER_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {portal === 'admin' && (
              <select value={pillarF} onChange={(e) => setPillarF(e.target.value as Pillar | 'all')} aria-label="Pillar" className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-brand-600">
                <option value="all">All pillars</option>
                {(['HENT', 'HEMP', 'HECO'] as Pillar[]).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            )}
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title={mine.length ? 'No partners match' : 'No partners yet'}
              body={mine.length ? 'Try another tab, intervention or search.' : 'Add the organisations you work with, and which interventions they support.'}
              action={!mine.length && writer ? { label: 'Add a partner', onClick: () => setForm({}) } : undefined}
            />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((x) => (
                <PartnerRow key={x.id} x={x} showPillar={portal === 'admin'} renew={renewal(x)} canEdit={writer} canDelete={canDelete(x)} onOpen={() => setOpenId(x.id)} onEdit={() => setForm({ partner: x })} onDelete={() => setDeleting(x)} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Modal open={!!open && !form} onClose={() => setOpenId(null)} size="lg" title={open ? `${partnerRef(open)} · ${open.name}` : ''} icon={<Handshake className="h-4 w-4" />} footer={open && writer ? <Button onClick={() => setForm({ partner: open })}><Pencil className="h-4 w-4" /> Edit</Button> : undefined}>
        {open && <PartnerView x={open} renew={renewal(open)} />}
      </Modal>

      {form && (
        <PartnerForm
          initial={form.partner}
          pillarChoices={pillars}
          onClose={() => setForm(null)}
          onSave={(input) => {
            const saved = form.partner ? updatePartner(form.partner.id, input, me) : addPartner(input, me)
            toast({ title: form.partner ? 'Partner saved' : 'Partner added', body: saved.name, tone: 'good' })
            setForm(null)
            setOpenId(saved.id)
          }}
        />
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Remove ${deleting?.name ?? ''}?`}
        description="It’s removed from the partnership bank, with its agreement and notes."
        size="sm"
        icon={<Trash2 className="h-4 w-4" />}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <button
              type="button"
              onClick={() => {
                if (!deleting) return
                removePartner(deleting.id)
                toast({ title: 'Partner removed', body: deleting.name, tone: 'info' })
                setDeleting(null)
                setOpenId(null)
              }}
              className="h-9 rounded-lg bg-bad px-4 text-sm font-semibold text-white"
            >
              Remove partner
            </button>
          </>
        }
      >
        <p className="text-sm text-body">If the partnership has only paused or ended, set its status instead, so its history is kept.</p>
      </Modal>
    </AppShell>
  )
}

const STATUS_TONE: Record<PartnerStatus, string> = {
  Prospect: 'bg-canvas text-muted',
  'In talks': 'bg-brand-50 text-brand-600',
  Active: 'bg-good-bg text-good',
  Paused: 'bg-warn-bg text-warn',
  Ended: 'bg-canvas text-faint',
}

const Status = ({ s }: { s: PartnerStatus }) => <span className={`inline-flex w-[76px] justify-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_TONE[s]}`}>{s}</span>

function PartnerRow({ x, showPillar, renew, canEdit, canDelete, onOpen, onEdit, onDelete }: { x: Partner; showPillar: boolean; renew: boolean; canEdit: boolean; canDelete: boolean; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 hover:bg-canvas/60 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-[86px] shrink-0 font-mono text-[12px] font-semibold text-brand-600">{partnerRef(x)}</span>
      <span className="shrink-0">
        <Status s={x.status} />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink hover:text-brand-600 hover:underline">{x.name}</span>
          <span className="hidden shrink-0 text-xs text-muted md:inline">
            {x.type}
            {x.country ? ` · ${x.country}` : ''}
          </span>
          {renew && <span className="shrink-0 rounded-full bg-warn-bg px-1.5 text-[10.5px] font-semibold text-warn">Agreement ends {day(x.agreement?.ends)}</span>}
        </span>
        {(x.offers.length > 0 || x.notes) && <span className="mt-0.5 block truncate text-[12.5px] text-body">{x.offers.length ? `Offers: ${x.offers.join(', ')}` : x.notes}</span>}
      </button>
      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:w-[230px]">
        {showPillar && <PillarTag pillar={x.pillar} />}
        {x.interventions.map((i) => (
          <span key={i} className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-body">
            {i}
          </span>
        ))}
      </div>
      <span className="hidden w-[150px] shrink-0 truncate text-xs text-muted lg:block">
        <b className="font-semibold text-body">{x.contactName || 'No contact yet'}</b>
        <span className="block">Last contact {day(x.lastContact)}</span>
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {x.url ? (
          <a href={x.url} target="_blank" rel="noopener noreferrer" aria-label="Website" title="Website" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : (
          <span className="h-8 w-8" aria-hidden />
        )}
        {canEdit ? (
          <button type="button" onClick={onEdit} aria-label="Edit" title="Edit" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="h-8 w-8" aria-hidden />
        )}
        {canDelete ? (
          <button type="button" onClick={onDelete} aria-label="Remove" title="Remove" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bad-bg hover:text-bad">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="h-8 w-8" aria-hidden />
        )}
        <button type="button" onClick={onOpen} className="inline-flex h-8 w-[76px] items-center justify-center gap-1 rounded-md border border-line-strong text-xs font-semibold text-brand-600 hover:bg-brand-50">
          Open <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </li>
  )
}

function PartnerView({ x, renew }: { x: Partner; renew: boolean }) {
  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)]">
      <dt className="text-xs font-medium text-muted">{k}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  )
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <PillarTag pillar={x.pillar} />
        <Status s={x.status} />
        <span className="text-xs text-muted">{x.type}</span>
      </div>
      {renew && <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-xs font-semibold text-warn">The agreement ends on {day(x.agreement?.ends)}. Start the renewal conversation.</p>}
      <dl className="mt-2 divide-y divide-line">
        <Row k="Interventions">{x.interventions.length ? x.interventions.join(', ') : 'Not linked yet'}</Row>
        <Row k="What they offer">{x.offers.length ? x.offers.join(', ') : '—'}</Row>
        <Row k="Contact">
          {x.contactName || x.contactEmail || x.contactPhone ? (
            <span className="space-y-0.5">
              {x.contactName && <span className="block font-medium">{x.contactName}</span>}
              {x.contactEmail && (
                <a href={`mailto:${x.contactEmail}`} className="flex items-center gap-1.5 text-brand-600 hover:underline">
                  <Mail className="h-3.5 w-3.5" /> {x.contactEmail}
                </a>
              )}
              {x.contactPhone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted" /> {x.contactPhone}
                </span>
              )}
            </span>
          ) : (
            'No contact yet'
          )}
        </Row>
        <Row k="Agreement">
          {x.agreement?.signed || x.agreement?.ends ? `Signed ${day(x.agreement?.signed)} · ends ${day(x.agreement?.ends)}` : 'None recorded'}
          {x.agreement?.doc && (
            <span className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs">
              <FileText className="h-4 w-4 text-brand-600" />
              <span className="min-w-0 flex-1 truncate">{x.agreement.doc.name}</span>
              {x.agreement.doc.dataUrl && (
                <a href={x.agreement.doc.dataUrl} download={x.agreement.doc.name} className="inline-flex items-center gap-1 font-semibold text-brand-600">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              )}
            </span>
          )}
        </Row>
        <Row k="Last contact">{day(x.lastContact)}</Row>
        <Row k="Country">{x.country || '—'}</Row>
        <Row k="Website">
          {x.url ? (
            <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              {x.url} <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            '—'
          )}
        </Row>
        <Row k="Notes">{x.notes || '—'}</Row>
        <Row k="Added">
          {x.addedBy} · {day(x.addedAt)}
          {x.updatedBy && <span className="text-muted"> · last edited by {x.updatedBy}</span>}
        </Row>
      </dl>
    </div>
  )
}

/* ---------- Add / edit ---------- */

const MAX_KEEP = 1.5 * 1024 * 1024
function readDoc(f: File): Promise<PartnerDoc> {
  const base = { name: f.name, size: f.size, type: f.type }
  if (f.size > MAX_KEEP) return Promise.resolve(base)
  return new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res({ ...base, dataUrl: String(r.result) })
    r.onerror = () => res(base)
    r.readAsDataURL(f)
  })
}

/**
 * Kept short like Add a resource: name, type, which interventions, status. Contact, agreement,
 * what they offer and notes are under "More details".
 */
function PartnerForm({ initial, pillarChoices, onClose, onSave }: { initial?: Partner; pillarChoices: Pillar[]; onClose: () => void; onSave: (x: PartnerInput) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [pillar, setPillar] = useState<Pillar>(initial?.pillar ?? pillarChoices[0])
  const [type, setType] = useState<PartnerType>(initial?.type ?? 'NGO')
  const [status, setStatus] = useState<PartnerStatus>(initial?.status ?? 'Active')
  const [ivs, setIvs] = useState<string[]>(initial?.interventions ?? [])
  const [more, setMore] = useState(!!initial)
  const [offers, setOffers] = useState<string[]>(initial?.offers ?? [])
  const [url, setUrl] = useState(initial?.url ?? '')
  const [country, setCountry] = useState(initial?.country ?? '')
  const [contactName, setContactName] = useState(initial?.contactName ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? '')
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? '')
  const [signed, setSigned] = useState(initial?.agreement?.signed ?? '')
  const [ends, setEnds] = useState(initial?.agreement?.ends ?? '')
  const [doc, setDoc] = useState<PartnerDoc | undefined>(initial?.agreement?.doc)
  const [lastContact, setLastContact] = useState(initial?.lastContact ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState('')
  const field = 'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100'
  const flip = (xs: string[], v: string) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v])
  const save = () => {
    try {
      onSave({
        name,
        pillar,
        type,
        status,
        interventions: ivs.filter((i) => interventionsOf(pillar).includes(i)),
        offers,
        url,
        country: country.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactEmail,
        contactPhone: contactPhone.trim() || undefined,
        agreement: signed || ends || doc ? { signed: signed || undefined, ends: ends || undefined, doc } : undefined,
        lastContact: lastContact || undefined,
        notes: notes.trim() || undefined,
      })
    } catch (e) {
      if (e instanceof PartnerError) setError(e.message)
      else throw e
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={initial ? `Edit: ${initial.name}` : 'Add a partner'}
      description={initial ? undefined : 'Who they are, which interventions they support, and where things stand. Add the rest when you have it.'}
      icon={<Handshake className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {initial ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg border border-bad/30 bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
        <div className={`grid gap-4 ${pillarChoices.length > 1 ? 'sm:grid-cols-[1fr_140px]' : ''}`}>
          <L label="Organisation">
            <input autoFocus value={name} onChange={(e) => (setName(e.target.value), setError(''))} className={field} placeholder="e.g. Kigali District Hospital" />
          </L>
          {pillarChoices.length > 1 && (
            <L label="Pillar">
              <select value={pillar} onChange={(e) => setPillar(e.target.value as Pillar)} className={field}>
                {pillarChoices.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </L>
          )}
        </div>
        <Chips label="Supports which interventions?" options={interventionsOf(pillar)} value={ivs} onToggle={(v) => setIvs(flip(ivs, v))} />
        <Chips label="Type" options={[...PARTNER_TYPES]} value={[type]} onToggle={(v) => setType(v as PartnerType)} />
        <Chips label="Status" options={[...PARTNER_STATUSES]} value={[status]} onToggle={(v) => setStatus(v as PartnerStatus)} />

        <div className="border-t border-line pt-3">
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="text-xs font-semibold text-brand-600 hover:underline">
            {more ? 'Fewer details' : 'More details (offers, contact, agreement, notes)'}
          </button>
          {more && (
            <div className="mt-3 space-y-4">
              <Chips label="What they offer" options={[...OFFERS]} value={offers} onToggle={(v) => setOffers(flip(offers, v))} />
              <div className="grid gap-4 sm:grid-cols-3">
                <L label="Contact person">
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={field} />
                </L>
                <L label="Email">
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={field} />
                </L>
                <L label="Phone">
                  <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={field} />
                </L>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <L label="Agreement signed">
                  <input type="date" value={signed} onChange={(e) => setSigned(e.target.value)} className={field} />
                </L>
                <L label="Agreement ends">
                  <input type="date" value={ends} min={signed || undefined} onChange={(e) => setEnds(e.target.value)} className={field} />
                </L>
                <L label="Last contact">
                  <input type="date" value={lastContact} max={today} onChange={(e) => setLastContact(e.target.value)} className={field} />
                </L>
              </div>
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-body">MOU or agreement document</span>
                {doc ? (
                  <div className="flex items-center gap-3 rounded-lg border border-line-strong px-3 py-2">
                    <FileText className="h-5 w-5 text-brand-600" />
                    <span className="min-w-0 flex-1 truncate text-sm">{doc.name}</span>
                    <button type="button" onClick={() => setDoc(undefined)} aria-label="Remove document" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-canvas">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm hover:bg-canvas">
                    <Upload className="h-4 w-4 text-brand-600" /> Upload the signed MOU (PDF or Word)
                    <input type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setDoc(await readDoc(f)) }} />
                  </label>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <L label="Website">
                  <input value={url} onChange={(e) => setUrl(e.target.value)} className={field} placeholder="https://…" />
                </L>
                <L label="Country">
                  <input value={country} onChange={(e) => setCountry(e.target.value)} className={field} />
                </L>
              </div>
              <L label="Notes">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${field} h-auto py-2`} placeholder="What’s agreed, what to watch, who else is involved" />
              </L>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

const L = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-[13px] font-medium text-body">{label}</span>
    {children}
  </label>
)

function Chips({ label, options, value, onToggle }: { label: string; options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-body">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value.includes(o)} onClick={() => onToggle(o)} className={`h-8 rounded-full border px-3 text-xs font-semibold ${value.includes(o) ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-body hover:bg-canvas'}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
