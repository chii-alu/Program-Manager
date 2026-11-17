/**
 * Tools → SOPs: standard operating procedures. Each pillar sees only its own; MELA sees every
 * pillar's and its own. Staff upload SOP documents or write SOPs step by step, and edit them;
 * the pillar lead (or MELA) approves, and an edited approved SOP needs approving again.
 */
import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, BadgeCheck, CheckCircle2, ClipboardList, Download, FileText, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel } from '../shared/components/ui'
import { EmptyState } from '../shared/components/EmptyState'
import { Portal, Role, pillarsFor, type Pillar } from '../shared/data/mela'
import { userFor } from '../shared/lib/auth'
import { toast } from '../shared/lib/notify'
import { Modal } from '../shared/components/Modal'
import { MAX_KEEP_MB, SOP_FILE_TYPES, SOP_PAGES, SopError, approveSop, createSop, deleteSop, sopRef, sopsFor, updateSop, useSops, type Sop, type SopDocument, type SopInput, type SopStep } from '../shared/data/sops'

export const args = { role: 'pillar_lead', portal: 'hemp' }

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

const GROUP_ORDER: (Pillar | 'MELA')[] = ['HENT', 'HEMP', 'HECO', 'MELA']
const groupLabel = (g: Pillar | 'MELA') => (g === 'MELA' ? 'MELA: data, consent and reporting' : `${g} SOPs`)

export default function Sops(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const me = userFor(role, portal).user
  const all = useSops()
  // A pillar sees only its own SOPs; the MELA view sees every pillar's and MELA's own.
  const mine = useMemo(() => sopsFor(all, pillarsFor(portal), portal === 'admin'), [all, portal])
  const [q, setQ] = useState('')
  const [view, setView] = useState<'all' | 'Draft' | 'Approved'>('all')
  const [pillarF, setPillarF] = useState('all')
  const rows = mine
    .filter(
      (x) =>
        (view === 'all' || x.status === view) &&
        (pillarF === 'all' || x.pillar === pillarF) &&
        (!q.trim() || `${sopRef(x)} ${x.title} ${x.purpose} ${x.owner} ${x.appliesTo.join(' ')} ${x.steps.map((s) => s.title).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())),
    )
    .sort((a, b) => GROUP_ORDER.indexOf(a.pillar) - GROUP_ORDER.indexOf(b.pillar) || (a.no ?? 0) - (b.no ?? 0))
  const [openId, setOpenId] = useState<string | null>(null)
  const open = mine.find((x) => x.id === openId)
  // Pillar leads approve their own pillar's SOPs; MELA approves any (including its own).
  const canApprove = (x: Sop) => role === 'admin' || (role === 'pillar_lead' && x.pillar !== 'MELA' && pillarsFor(portal).includes(x.pillar))
  // Staff and leads write and edit their own pillar's SOPs; MELA any. Leads and MELA delete.
  const writer = role === 'admin' || role === 'pillar_lead' || role === 'pillar_staff'
  const canEdit = (x: Sop) => role === 'admin' || (writer && x.pillar !== 'MELA' && pillarsFor(portal).includes(x.pillar))
  const canDelete = (x: Sop) => role === 'admin' || (role === 'pillar_lead' && canEdit(x))
  const pillarChoices: Sop['pillar'][] = portal === 'admin' ? ['HENT', 'HEMP', 'HECO', 'MELA'] : (pillarsFor(portal) as Sop['pillar'][])
  const [mode, setMode] = useState<null | { kind: 'new' } | { kind: 'edit'; sop: Sop } | { kind: 'upload' }>(null)
  const [confirmDelete, setConfirmDelete] = useState<Sop | null>(null)

  return (
    <AppShell role={role} portal={portal} active="sops" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
        <PageHeader
          crumbs={[portal === 'admin' ? 'MELA' : portal.toUpperCase(), 'Tools', 'SOPs']}
          title="Standard Operating Procedures"
          description={`How ${portal === 'admin' ? 'each pillar and MELA run their' : `${portal.toUpperCase()} runs its`} work, step by step. Each step opens the page where it’s done.`}
          actions={
            writer ? (
              <>
                <Button className="flex-1 sm:flex-none" onClick={() => setMode({ kind: 'upload' })}>
                  <Upload className="h-4 w-4" /> Upload SOP
                </Button>
                <Button variant="primary" className="flex-1 sm:flex-none" onClick={() => setMode({ kind: 'new' })}>
                  <Plus className="h-4 w-4" /> New SOP
                </Button>
              </>
            ) : undefined
          }
        />
        <Panel>
          <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3">
            {(
              [
                ['all', 'All SOPs', mine.length],
                ['Draft', 'Drafts', mine.filter((x) => x.status === 'Draft').length],
                ['Approved', 'Approved', mine.filter((x) => x.status === 'Approved').length],
              ] as [typeof view, string, number][]
            ).map(([k, l, n]) => (
              <button key={k} role="tab" type="button" aria-selected={view === k} onClick={() => setView(k)} className={`relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium ${view === k ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                {l}
                <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${view === k ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-muted'}`}>{n}</span>
                {view === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, title, purpose, steps or owner" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
            </label>
            {portal === 'admin' && (
              <select value={pillarF} onChange={(e) => setPillarF(e.target.value)} aria-label="Pillar" className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-brand-600">
                <option value="all">All pillars</option>
                {GROUP_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {g === 'MELA' ? 'MELA (data, consent, reporting)' : g}
                  </option>
                ))}
              </select>
            )}
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={mine.length ? 'No SOPs match' : 'No SOPs here yet'}
              body={mine.length ? 'Try another search or tab.' : 'Upload your SOP document, or write one step by step.'}
              action={!mine.length && writer ? { label: 'Upload SOP', onClick: () => setMode({ kind: 'upload' }) } : undefined}
            />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((x) => (
                <SopRow
                  key={x.id}
                  x={x}
                  showPillar={portal === 'admin'}
                  canEdit={canEdit(x)}
                  canDelete={canDelete(x)}
                  onOpen={() => setOpenId(x.id)}
                  onEdit={() => setMode({ kind: 'edit', sop: x })}
                  onDelete={() => setConfirmDelete(x)}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Reading an SOP: its steps and document, with Edit and Approve. */}
      <Modal open={!!open && !mode} onClose={() => setOpenId(null)} size="lg" title={open ? `${sopRef(open)} · ${open.title}` : ''} icon={<ClipboardList className="h-4 w-4" />}>
        {open && (
          <SopView
            key={open.id}
            x={open}
            canApprove={canApprove(open)}
            canEdit={canEdit(open)}
            canDelete={canDelete(open)}
            onEdit={() => setMode({ kind: 'edit', sop: open })}
            onDelete={() => setConfirmDelete(open)}
            onApprove={() => (approveSop(open.id, me), toast({ title: 'SOP approved', body: open.title, tone: 'good' }))}
            onNavigate={onNavigate}
          />
        )}
      </Modal>

      {/* Writing or editing an SOP. */}
      <Modal open={!!mode && mode.kind !== 'upload'} onClose={() => setMode(null)} size="lg" title={mode?.kind === 'edit' ? `Edit: ${mode.sop.title}` : 'New SOP'} icon={<Pencil className="h-4 w-4" />}>
        {mode && mode.kind !== 'upload' && (
          <SopEditor
            key={mode.kind === 'edit' ? mode.sop.id : 'new'}
            initial={mode.kind === 'edit' ? mode.sop : undefined}
            pillarChoices={pillarChoices}
            onCancel={() => setMode(null)}
            onSave={(input) => {
              const saved = mode.kind === 'edit' ? updateSop(mode.sop.id, input, me) : createSop(input, me)
              toast({ title: mode.kind === 'edit' ? (mode.sop.status === 'Approved' ? `Saved as a draft of v${saved.version}` : 'SOP saved') : 'SOP added', body: saved.title, tone: 'good' })
              setMode(null)
              setOpenId(saved.id)
            }}
          />
        )}
      </Modal>

      {mode?.kind === 'upload' && (
        <UploadSop
          pillarChoices={pillarChoices}
          onClose={() => setMode(null)}
          onUploaded={(input) => {
            const saved = createSop(input, me)
            toast({ title: 'SOP uploaded', body: saved.title, tone: 'good' })
            setOpenId(saved.id)
            setMode(null)
          }}
        />
      )}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete “${confirmDelete?.title ?? ''}”?`}
        description="The SOP and any uploaded document are removed. This can’t be undone."
        size="sm"
        icon={<Trash2 className="h-4 w-4" />}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <button
              type="button"
              onClick={() => {
                if (!confirmDelete) return
                deleteSop(confirmDelete.id)
                toast({ title: 'SOP deleted', body: confirmDelete.title, tone: 'info' })
                setConfirmDelete(null)
                setOpenId(null)
              }}
              className="h-9 rounded-lg bg-bad px-4 text-sm font-semibold text-white"
            >
              Delete SOP
            </button>
          </>
        }
      >
        <p className="text-sm text-body">Anyone following it will no longer see it in SOPs.</p>
      </Modal>
    </AppShell>
  )
}

/** One SOP as a row, like the Resource Bank: status, title and purpose, pillar, owner, actions. */
function SopRow({ x, showPillar, canEdit, canDelete, onOpen, onEdit, onDelete }: { x: Sop; showPillar: boolean; canEdit: boolean; canDelete: boolean; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const what = x.steps.length ? `${x.steps.length} step${x.steps.length === 1 ? '' : 's'}${x.document ? ' + document' : ''}` : x.document ? 'Document' : 'No steps yet'
  return (
    <li className="flex flex-col gap-2 px-4 py-3 hover:bg-canvas/60 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-[104px] shrink-0 font-mono text-[12px] font-semibold text-brand-600">{sopRef(x)}</span>
      <span className="w-[76px] shrink-0">
        <StatusTag x={x} />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink hover:text-brand-600 hover:underline">{x.title}</span>
          <span className="hidden shrink-0 text-xs text-muted md:inline">
            v{x.version} · {what}
          </span>
        </span>
        {(x.purpose || x.appliesTo.length > 0) && <span className="mt-0.5 block truncate text-[12.5px] text-body">{x.purpose || `Applies to ${x.appliesTo.join(', ')}`}</span>}
      </button>
      {showPillar && <span className="w-[56px] shrink-0 text-xs font-bold text-brand-600">{x.pillar}</span>}
      <span className="hidden w-[160px] shrink-0 truncate text-xs text-muted lg:block">
        <b className="font-semibold text-body">{x.owner}</b>
        <span className="block">
          {x.updatedBy ? `Updated by ${x.updatedBy}` : x.reviewedBy ? `Approved by ${x.reviewedBy}` : 'Draft from the platform'}
        </span>
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {x.document?.dataUrl ? (
          <a href={x.document.dataUrl} download={x.document.name} aria-label="Download document" title={`Download ${x.document.name}`} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
            <Download className="h-4 w-4" />
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
          <button type="button" onClick={onDelete} aria-label="Delete" title="Delete" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bad-bg hover:text-bad">
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

function StatusTag({ x }: { x: Sop }) {
  return x.status === 'Approved' ? (
    <span className="shrink-0 rounded-full bg-good-bg px-2 py-0.5 text-[10.5px] font-semibold text-good">Approved</span>
  ) : (
    <span className="shrink-0 rounded-full bg-warn-bg px-2 py-0.5 text-[10.5px] font-semibold text-warn">Draft</span>
  )
}

function SopView({
  x,
  canApprove,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onApprove,
  onNavigate,
}: {
  x: Sop
  canApprove: boolean
  canEdit: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
  onApprove: () => void
  onNavigate?: (to: string) => void
}) {
  const [done, setDone] = useState<number[]>([])
  return (
    <div className="-mx-5 -my-4">
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-600">{x.pillar}</span>
          <StatusTag x={x} />
          <span className="text-xs text-muted">
            v{x.version} · owner: {x.owner}
            {x.reviewedBy && ` · approved by ${x.reviewedBy} on ${new Date(`${x.reviewedAt}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-6 text-body">
          <b className="font-semibold text-ink">Purpose:</b> {x.purpose}
        </p>
        <p className="mt-1 text-xs text-muted">Applies to: {x.appliesTo.join(' · ')}</p>
        {x.document && <DocumentCard doc={x.document} />}
        {x.status === 'Draft' && (
          <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">
            Draft written from how the platform works. {x.pillar === 'MELA' ? 'MELA' : `The ${x.pillar} lead`} should check each step against how the team actually works, then approve it.
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
        <span className="ml-auto" />
        {canDelete && (
          <Button className="h-9 text-xs text-bad" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
        {canEdit && (
          <Button className="h-9 text-xs" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
        {canApprove && (
          <Button variant="primary" className="h-9 text-xs" onClick={onApprove}>
            <BadgeCheck className="h-4 w-4" /> {x.status === 'Approved' ? `Re-approve as v${x.version + 1}` : 'Approve this SOP'}
          </Button>
        )}
      </div>
    </div>
  )
}

/* ---------- Documents ---------- */

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1)} MB`

function DocumentCard({ doc }: { doc: SopDocument }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
      <FileText className="h-5 w-5 shrink-0 text-brand-600" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{doc.name}</span>
        <span className="block text-xs text-muted">
          {mb(doc.size)}
          {!doc.dataUrl && ' · too large to keep in the prototype; shared files live on the server once it’s set up'}
        </span>
      </span>
      {doc.dataUrl && (
        <a href={doc.dataUrl} download={doc.name} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line-strong px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50">
          <Download className="h-3.5 w-3.5" /> Download
        </a>
      )}
    </div>
  )
}

/** Read a chosen file: keep its contents (for download) only when it's small enough. */
function readFile(f: File): Promise<SopDocument> {
  const base = { name: f.name, size: f.size, type: f.type }
  if (f.size > MAX_KEEP_MB * 1024 * 1024) return Promise.resolve(base)
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve({ ...base, dataUrl: String(r.result) })
    r.onerror = () => resolve(base)
    r.readAsDataURL(f)
  })
}

function FilePicker({ doc, onPick, onClear }: { doc?: SopDocument; onPick: (d: SopDocument) => void; onClear?: () => void }) {
  const [err, setErr] = useState('')
  return doc ? (
    <div className="flex items-center gap-3 rounded-lg border border-line-strong px-3 py-2.5">
      <FileText className="h-5 w-5 shrink-0 text-brand-600" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{doc.name}</span>
        <span className="block text-xs text-muted">{mb(doc.size)}</span>
      </span>
      {onClear && (
        <button type="button" onClick={onClear} aria-label="Remove document" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  ) : (
    <>
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-4 text-center text-sm hover:bg-canvas">
        <Upload className="h-5 w-5 text-brand-600" />
        <span className="font-medium text-ink">Choose the SOP document</span>
        <span className="text-xs text-muted">PDF or Word</span>
        <input
          type="file"
          accept={SOP_FILE_TYPES}
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            if (!/\.(pdf|docx?)$/i.test(f.name)) return setErr('Upload a PDF or Word document.')
            setErr('')
            onPick(await readFile(f))
          }}
        />
      </label>
      {err && <p className="mt-1.5 text-xs font-medium text-bad">{err}</p>}
    </>
  )
}

const field = 'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100'

const F = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-[13px] font-medium text-body">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
  </label>
)

function PillarPick({ value, choices, onChange }: { value: Sop['pillar']; choices: Sop['pillar'][]; onChange: (p: Sop['pillar']) => void }) {
  if (choices.length < 2) return null
  return (
    <F label="Pillar">
      <select value={value} onChange={(e) => onChange(e.target.value as Sop['pillar'])} className={field}>
        {choices.map((c) => (
          <option key={c} value={c}>
            {c === 'MELA' ? 'MELA (data, consent and reporting)' : c}
          </option>
        ))}
      </select>
    </F>
  )
}

/** Upload an existing SOP document: the file, a title and who owns it. Steps can be added later. */
function UploadSop({ pillarChoices, onClose, onUploaded }: { pillarChoices: Sop['pillar'][]; onClose: () => void; onUploaded: (x: SopInput) => void }) {
  const [doc, setDoc] = useState<SopDocument | undefined>()
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [pillar, setPillar] = useState<Sop['pillar']>(pillarChoices[0])
  const [error, setError] = useState('')
  const save = () => {
    try {
      if (!doc) throw new SopError('Choose the SOP document to upload.')
      onUploaded({ title: title || doc.name.replace(/\.[^.]+$/, ''), pillar, owner, purpose: '', appliesTo: [], steps: [], document: doc })
    } catch (e) {
      if (e instanceof SopError) setError(e.message)
      else throw e
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Upload an SOP"
      description="Add an SOP your team already has. It starts as a draft for the pillar lead to approve; you can add steps later with Edit."
      icon={<Upload className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg border border-bad/30 bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
        <FilePicker doc={doc} onPick={(d) => (setDoc(d), setError(''), !title && setTitle(d.name.replace(/\.[^.]+$/, '')))} onClear={() => setDoc(undefined)} />
        <F label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="From the file name" />
        </F>
        <F label="Owner (optional)">
          <input value={owner} onChange={(e) => setOwner(e.target.value)} className={field} placeholder="e.g. HEMP lead" />
        </F>
        <PillarPick value={pillar} choices={pillarChoices} onChange={setPillar} />
      </div>
    </Modal>
  )
}

/** Write or edit an SOP: details, the document, and the steps (each can link to a page). */
function SopEditor({ initial, pillarChoices, onCancel, onSave }: { initial?: Sop; pillarChoices: Sop['pillar'][]; onCancel: () => void; onSave: (x: SopInput) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [pillar, setPillar] = useState<Sop['pillar']>(initial?.pillar ?? pillarChoices[0])
  const [owner, setOwner] = useState(initial?.owner ?? '')
  const [purpose, setPurpose] = useState(initial?.purpose ?? '')
  const [appliesTo, setAppliesTo] = useState((initial?.appliesTo ?? []).join(', '))
  const [doc, setDoc] = useState<SopDocument | undefined>(initial?.document)
  const [steps, setSteps] = useState<SopStep[]>(initial?.steps.length ? initial.steps : [{ title: '', detail: '' }])
  const [error, setError] = useState('')
  const setStep = (i: number, patch: Partial<SopStep>) => setSteps((xs) => xs.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const move = (i: number, d: -1 | 1) => setSteps((xs) => {
    const j = i + d
    if (j < 0 || j >= xs.length) return xs
    const next = [...xs]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const save = () => {
    try {
      onSave({ title, pillar, owner, purpose, appliesTo: appliesTo.split(','), steps, document: doc })
    } catch (e) {
      if (e instanceof SopError) setError(e.message)
      else throw e
    }
  }
  return (
    <div className="-mx-5 -my-4">
      {initial?.status === 'Approved' && <p className="border-b border-line bg-warn-bg px-5 py-2 text-xs font-semibold text-warn">Saving makes v{initial.version + 1}, which needs approving again.</p>}
      <div className="space-y-4 p-5">
        {error && <p className="rounded-lg border border-bad/30 bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <F label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="e.g. Placing interns with host organisations" />
            </F>
          </div>
          <F label="Owner">
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className={field} placeholder="e.g. HEMP lead" />
          </F>
          <PillarPick value={pillar} choices={pillarChoices} onChange={setPillar} />
          <div className="sm:col-span-2">
            <F label="Purpose">
              <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} className={`${field} h-auto py-2`} placeholder="What this SOP makes sure of" />
            </F>
          </div>
          <div className="sm:col-span-2">
            <F label="Applies to" hint="Interventions or activities, separated by commas.">
              <input value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className={field} placeholder="e.g. Internships, Career Exposure" />
            </F>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-body">Document (optional)</span>
          <FilePicker doc={doc} onPick={setDoc} onClear={() => setDoc(undefined)} />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-body">Steps</span>
          <ol className="space-y-2">
            {steps.map((st, i) => (
              <li key={i} className="rounded-lg border border-line p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input value={st.title} onChange={(e) => setStep(i, { title: e.target.value })} className={field} placeholder="Step, e.g. Confirm placements with host organisations" aria-label={`Step ${i + 1} title`} />
                    <textarea value={st.detail} onChange={(e) => setStep(i, { detail: e.target.value })} rows={2} className={`${field} h-auto py-2`} placeholder="How to do it (optional)" aria-label={`Step ${i + 1} detail`} />
                    <select value={st.to ?? ''} onChange={(e) => setStep(i, { to: e.target.value || undefined })} className={`${field} h-9 text-[13px]`} aria-label={`Step ${i + 1} page`}>
                      <option value="">No page link</option>
                      {SOP_PAGES.map((p) => (
                        <option key={p.to} value={p.to}>
                          Opens: {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-canvas disabled:opacity-30">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-canvas disabled:opacity-30">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setSteps((xs) => xs.filter((_, k) => k !== i))} aria-label="Remove step" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bad-bg hover:text-bad">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setSteps((xs) => [...xs, { title: '', detail: '' }])} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
            <Plus className="h-4 w-4" /> Add a step
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          {initial ? 'Save changes' : 'Add SOP'}
        </Button>
      </div>
    </div>
  )
}
