/**
 * Metric definitions, searchable. Used by every analytics page (Platform Analytics for each
 * pillar and MELA, and Venture Analytics), so readers can look up how any number is counted.
 */
import React, { useMemo, useState } from 'react'
import { BookOpen, Search, X } from 'lucide-react'
import { Modal } from './Modal'

export type Definition = {
  name: string
  definition: string
  /** Dictionary code, when the metric has one (shown small, and searchable). */
  code?: string
  /** Where it appears: a chart or card on this page, or the CHII dashboard. */
  where?: string
  /** Its current value, when the page has one to show. */
  value?: string
  /** Section heading, e.g. "On this page" or "Feedback". */
  group: string
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Wraps the parts of `text` that match the search in <mark>. */
function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const i = norm(text).indexOf(norm(q))
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-warn-bg px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>
      <Hl text={text.slice(i + q.length)} q={q} />
    </>
  )
}

export function DefinitionsModal({ open, onClose, title = 'Metric definitions', description, items }: { open: boolean; onClose: () => void; title?: string; description: string; items: Definition[] }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const groups = useMemo(() => [...new Set(items.map((i) => i.group))], [items])
  const query = q.trim()
  const shown = items.filter(
    (i) => (!group || i.group === group) && (!query || [i.name, i.definition, i.code ?? '', i.where ?? '', i.group].some((f) => norm(f).includes(norm(query)))),
  )
  const hasValues = items.some((i) => i.value != null)

  return (
    <Modal open={open} onClose={onClose} size="lg" title={title} description={description} icon={<BookOpen className="h-4 w-4" />}>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a metric, e.g. attendance, NPS, women-led"
              aria-label="Search metric definitions"
              className="h-9 w-full rounded-md border border-line-strong bg-surface pl-9 pr-8 text-[13px] outline-none placeholder:text-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-faint hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {shown.length} of {items.length} metrics
          </span>
        </div>
        {groups.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {[null, ...groups].map((g) => (
              <button
                key={g ?? 'all'}
                type="button"
                aria-pressed={group === g}
                onClick={() => setGroup(g)}
                className={`h-7 rounded-full border px-2.5 text-xs font-semibold transition-colors ${group === g ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-body hover:bg-canvas'}`}
              >
                {g ?? 'All'}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[56vh] overflow-y-auto rounded-lg border border-line">
          {shown.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No metric matches “{query}”. Try another word, or clear the search.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10 bg-surface shadow-[0_1px_0_var(--color-line)]">
                <tr className="text-left text-[11px] font-bold uppercase tracking-[0.06em] text-brand-600">
                  <th className="px-3 py-2">Metric</th>
                  <th className="px-3 py-2">Definition</th>
                  {hasValues && <th className="px-3 py-2 text-right">Now</th>}
                </tr>
              </thead>
              {groups
                .filter((g) => shown.some((i) => i.group === g))
                .map((g) => (
                  <tbody key={g} className="divide-y divide-line">
                    {groups.length > 1 && (
                      <tr>
                        <th colSpan={hasValues ? 3 : 2} className="bg-canvas px-3 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
                          {g}
                        </th>
                      </tr>
                    )}
                    {shown
                      .filter((i) => i.group === g)
                      .map((i) => (
                        <tr key={`${g}-${i.code ?? i.name}`} className="align-top">
                          <td className="w-[38%] px-3 py-2">
                            <span className="block font-semibold text-ink">
                              <Hl text={i.name} q={query} />
                            </span>
                            {i.code && (
                              <span className="block font-mono text-[10.5px] text-faint">
                                <Hl text={i.code} q={query} />
                              </span>
                            )}
                            {i.where && (
                              <span className="mt-0.5 block text-[11px] text-brand-600">
                                <Hl text={i.where} q={query} />
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-body">
                            <Hl text={i.definition} q={query} />
                          </td>
                          {hasValues && <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-ink">{i.value ?? '—'}</td>}
                        </tr>
                      ))}
                  </tbody>
                ))}
            </table>
          )}
        </div>
      </div>
    </Modal>
  )
}
