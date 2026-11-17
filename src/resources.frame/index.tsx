/**
 * Tools → Resources: the resource bank. Articles, papers, studies, guides, templates and videos
 * staff have found useful, with who added each one and how it helped. Search, filter by type,
 * topic and pillar, save to your own list, and add new ones.
 */
import React, { useMemo, useState } from 'react'
import { Bookmark, BookmarkCheck, ExternalLink, FileText, Library, Lightbulb, Plus, Search, Trash2 } from 'lucide-react'
import { AppShell } from '../shared/components/AppShell'
import { Button, PageHeader, Panel, PillarTag } from '../shared/components/ui'
import { Modal } from '../shared/components/Modal'
import { EmptyState } from '../shared/components/EmptyState'
import { Portal, Role, type Pillar } from '../shared/data/mela'
import { userFor } from '../shared/lib/auth'
import { toast } from '../shared/lib/notify'
import { RESOURCE_TYPES, ResourceError, TOPICS, addResource, removeResource, resourceRef, toggleSaved, useResources, type Resource, type ResourceType } from '../shared/data/resources'

export const args = { role: 'pillar_lead', portal: 'hemp' }

type Props = Partial<typeof args> & {
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}

type View = 'all' | 'saved' | 'mine'

export default function Resources(props: Props) {
  const { role: r, portal: p, onNavigate, onPortalChange, onSignOut } = { ...args, ...props }
  const role = r as Role
  const portal = (role !== 'admin' && p === 'admin' ? 'hent' : p) as Portal
  const me = userFor(role, portal).user
  const { items, saved } = useResources()
  const mySaved = saved[me] ?? []
  const [view, setView] = useState<View>('all')
  const [q, setQ] = useState('')
  const [type, setType] = useState<ResourceType | 'all'>('all')
  const [topic, setTopic] = useState<string>('all')
  const [pillarOnly, setPillarOnly] = useState(portal !== 'admin')
  const [adding, setAdding] = useState(false)
  const myPillar = portal === 'admin' ? null : (portal.toUpperCase() as Pillar)

  const list = useMemo(
    () =>
      items.filter(
        (x) =>
          (view === 'all' || (view === 'saved' ? mySaved.includes(x.id) : x.addedBy === me)) &&
          (type === 'all' || x.type === type) &&
          (topic === 'all' || x.topics.includes(topic)) &&
          (!pillarOnly || !myPillar || x.pillars.length === 0 || x.pillars.includes(myPillar)) &&
          (!q.trim() || `${resourceRef(x)} ${x.title} ${x.source} ${x.summary} ${x.why ?? ''} ${x.topics.join(' ')} ${x.addedBy}`.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [items, view, mySaved, me, type, topic, pillarOnly, myPillar, q],
  ).sort((a, b) => (a.no ?? 0) - (b.no ?? 0))

  return (
    <AppShell role={role} portal={portal} active="resources" onNavigate={onNavigate} onPortalChange={onPortalChange} onSignOut={onSignOut}>
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5">
        <PageHeader
          crumbs={[portal === 'admin' ? 'MELA' : portal.toUpperCase(), 'Tools', 'Resources']}
          title="Resource Bank"
          description="Articles, papers, studies, guides and templates that have helped our work, shared by the team. Add what’s helped you, and say how."
          actions={
            <Button variant="primary" className="w-full sm:w-auto" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add a resource
            </Button>
          }
        />

        <Panel>
          <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3">
            {(
              [
                ['all', 'All resources', items.length],
                ['saved', 'Saved by me', mySaved.length],
                ['mine', 'Added by me', items.filter((x) => x.addedBy === me).length],
              ] as [View, string, number][]
            ).map(([k, l, n]) => (
              <button key={k} role="tab" type="button" aria-selected={view === k} onClick={() => setView(k)} className={`relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium ${view === k ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                {l}
                <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${view === k ? 'bg-brand-50 text-brand-600' : 'bg-canvas text-muted'}`}>{n}</span>
                {view === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1 lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, title, source, topic or who added it" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
            </label>
            <select value={type} onChange={(e) => setType(e.target.value as ResourceType | 'all')} aria-label="Type" className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-brand-600">
              <option value="all">All types</option>
              {RESOURCE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic" className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] outline-none focus:border-brand-600">
              <option value="all">All topics</option>
              {TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {myPillar && (
              <label className="flex items-center gap-2 text-[13px] text-body lg:ml-auto">
                <input type="checkbox" checked={pillarOnly} onChange={(e) => setPillarOnly(e.target.checked)} className="h-4 w-4 accent-brand" />
                Useful for {myPillar} only
              </label>
            )}
          </div>
          {list.length === 0 ? (
            <EmptyState
              icon={Library}
              title={view === 'saved' ? 'Nothing saved yet' : view === 'mine' ? 'You haven’t added anything yet' : 'No resources match'}
              body={view === 'saved' ? 'Use the bookmark on a resource to keep it here.' : view === 'mine' ? 'Share something that helped your work.' : 'Try another search, type or topic.'}
              action={view === 'mine' ? { label: 'Add a resource', onClick: () => setAdding(true) } : undefined}
            />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((x) => (
                <ResourceRow key={x.id} x={x} saved={mySaved.includes(x.id)} mine={x.addedBy === me} onSave={() => toggleSaved(me, x.id)} onRemove={() => (removeResource(x.id, me), toast({ title: 'Resource removed', body: x.title, tone: 'info' }))} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {adding && <AddResource me={me} myPillar={myPillar} onClose={() => setAdding(false)} />}
    </AppShell>
  )
}

const TYPE_TONE: Record<ResourceType, string> = {
  Article: 'bg-brand-50 text-brand-600',
  'Paper / study': 'bg-[#efe8fb] text-[#5b3aa8] dark:bg-brand-50 dark:text-brand-600',
  Guide: 'bg-good-bg text-good',
  Template: 'bg-warn-bg text-warn',
  Video: 'bg-bad-bg text-bad',
  Dataset: 'bg-canvas text-body',
  Course: 'bg-canvas text-body',
}

/** One resource as a row: type, title and source, why it helped, pillars, who added it, actions. */
function ResourceRow({ x, saved, mine, onSave, onRemove }: { x: Resource; saved: boolean; mine: boolean; onSave: () => void; onRemove: () => void }) {
  const note = x.why ?? (x.summary || '')
  return (
    <li className="group flex flex-col gap-2 px-4 py-3 hover:bg-canvas/60 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-[52px] shrink-0 font-mono text-[12px] font-semibold text-brand-600">{resourceRef(x)}</span>
      <span className={`w-[92px] shrink-0 self-start rounded px-1.5 py-0.5 text-center text-[10.5px] font-bold sm:self-center ${TYPE_TONE[x.type]}`}>{x.type}</span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          {x.url ? (
            <a href={x.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold text-ink hover:text-brand-600 hover:underline">
              {x.title}
            </a>
          ) : (
            <span className="truncate text-sm font-semibold text-ink">{x.title}</span>
          )}
          <span className="hidden shrink-0 truncate text-xs text-muted md:inline">
            {x.source}
            {x.year ? ` · ${x.year}` : ''}
          </span>
        </div>
        {note && (
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-body" title={note}>
            {x.why && <Lightbulb className="h-3.5 w-3.5 shrink-0 text-warn" />}
            <span className="truncate">{note}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:w-[120px] sm:justify-end">
        {x.pillars.length ? x.pillars.map((pl) => <PillarTag key={pl} pillar={pl} />) : <span className="text-[11px] text-faint">Everyone</span>}
      </div>
      <span className="hidden w-[150px] shrink-0 truncate text-xs text-muted lg:block">
        <b className="font-semibold text-body">{x.addedBy}</b>
        <span className="block">{new Date(`${x.addedAt}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onSave} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save'} title={saved ? 'Saved' : 'Save'} className={`grid h-8 w-8 place-items-center rounded-md ${saved ? 'text-brand-600' : 'text-muted hover:bg-surface hover:text-ink'}`}>
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
        {/* Only your own resources can be removed; the space is kept so the columns line up. */}
        {mine ? (
          <button type="button" onClick={onRemove} aria-label="Remove" title="Remove" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bad-bg hover:text-bad">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="h-8 w-8" aria-hidden />
        )}
        {x.url ? (
          <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-[92px] items-center justify-center gap-1 rounded-md border border-line-strong text-xs font-semibold text-brand-600 hover:bg-brand-50">
            Open <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="inline-flex h-8 w-[92px] items-center justify-center gap-1 rounded-md bg-canvas text-[11px] font-medium text-muted" title="A CHII document kept in the team drive">
            <FileText className="h-3 w-3" /> CHII doc
          </span>
        )}
      </div>
    </li>
  )
}

/**
 * Adding a resource, kept short: paste a link (or give a title), pick the type, and optionally
 * say why it's useful. Source, year, topics and pillars are under "More details".
 */
function AddResource({ me, myPillar, onClose }: { me: string; myPillar: Pillar | null; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ResourceType>('Article')
  const [why, setWhy] = useState('')
  const [more, setMore] = useState(false)
  const [source, setSource] = useState('')
  const [year, setYear] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [pillars, setPillars] = useState<Pillar[]>(myPillar ? [myPillar] : [])
  const [error, setError] = useState('')
  const field = 'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-brand-600 focus:ring-3 focus:ring-brand-100'
  // With only a link, the website's name stands in for the title and source.
  const host = (() => {
    try {
      return url.trim() ? new URL(url.trim()).hostname.replace(/^www\./, '') : ''
    } catch {
      return ''
    }
  })()
  const save = () => {
    try {
      const t = title.trim() || host
      if (!t) throw new ResourceError('Paste a link or give it a title.')
      addResource({ title: t, url, type, source: source.trim() || host || 'CHII', year: year ? Number(year) : undefined, summary: why.trim(), why: why.trim() || undefined, topics, pillars, addedBy: me })
      toast({ title: 'Resource added', body: t, tone: 'good' })
      onClose()
    } catch (e) {
      if (e instanceof ResourceError) setError(e.message)
      else throw e
    }
  }
  const flip = <T,>(xs: T[], v: T) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v])
  return (
    <Modal
      open
      onClose={onClose}
      title="Add a resource"
      description="Paste a link, give it a title, and say why it’s useful. That’s it."
      icon={<Library className="h-4 w-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-lg border border-bad/30 bg-bad-bg px-3 py-2 text-sm text-bad">{error}</p>}
        <L label="Link">
          <input autoFocus value={url} onChange={(e) => (setUrl(e.target.value), setError(''))} className={field} placeholder="https://… (leave empty for a CHII document)" />
        </L>
        <L label="Title">
          <input value={title} onChange={(e) => (setTitle(e.target.value), setError(''))} className={field} placeholder={host || 'e.g. Strengthening community health worker programmes'} />
        </L>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-body">Type</span>
          <div className="flex flex-wrap gap-1.5">
            {RESOURCE_TYPES.map((t) => (
              <Toggle key={t} on={type === t} onClick={() => setType(t)}>
                {t}
              </Toggle>
            ))}
          </div>
        </div>
        <L label="Why is it useful? (optional)">
          <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} className={`${field} h-auto py-2`} placeholder="e.g. Helped us redesign our selection criteria" />
        </L>
        <div className="border-t border-line pt-3">
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="text-xs font-semibold text-brand-600 hover:underline">
            {more ? 'Fewer details' : 'More details (source, year, topics, pillars)'}
          </button>
          {more && (
            <div className="mt-3 space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
                <L label="Author, organisation or journal">
                  <input value={source} onChange={(e) => setSource(e.target.value)} className={field} placeholder={host} />
                </L>
                <L label="Year">
                  <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} className={field} inputMode="numeric" />
                </L>
              </div>
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-body">Topics</span>
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.map((t) => (
                    <Toggle key={t} on={topics.includes(t)} onClick={() => setTopics(flip(topics, t))}>
                      {t}
                    </Toggle>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-body">Most useful for</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['HENT', 'HEMP', 'HECO'] as Pillar[]).map((pl) => (
                    <Toggle key={pl} on={pillars.includes(pl)} onClick={() => setPillars(flip(pillars, pl))}>
                      {pl}
                    </Toggle>
                  ))}
                  <span className="self-center text-xs text-muted">None ticked = everyone</span>
                </div>
              </div>
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

const Toggle = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`h-8 rounded-full border px-3 text-xs font-semibold ${on ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-body hover:bg-canvas'}`}>
    {children}
  </button>
)
