import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronDown, HelpCircle, Mail, Search, X } from 'lucide-react'
import { faqs, searchFaqs } from '../data/faq'
import { EmptyState } from './EmptyState'

const suggested = ['export', 'de-identified', 'import consent', 'CHII ID', 'completion']

/** Floating help: keyword-matched answers from the platform guide. */
export function HelpWidget({ onGo }: { onGo?: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const reduce = useReducedMotion()
  const results = useMemo(() => (q.trim() ? searchFaqs(q) : faqs.slice(0, 6)), [q])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close help' : 'Help'}
        className="fixed bottom-20 right-4 z-40 grid h-11 w-11 place-items-center rounded-full bg-brand text-white shadow-[0_8px_24px_-6px_rgba(19,48,107,0.5)] transition-transform duration-150 ease-out active:scale-95 md:bottom-6 md:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Help"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-3 bottom-36 z-40 flex max-h-[62dvh] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-16px_rgba(0,0,0,0.35)] md:inset-x-auto md:bottom-20 md:right-6 md:w-[380px] md:max-h-[560px]"
          >
            <div className="bg-brand px-4 pb-4 pt-4 text-white">
              <div className="text-sm font-semibold">How can we help?</div>
              <div className="text-xs text-white/70">Answers from the MELA platform guide</div>
              <label className="relative mt-3 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setExpanded(null)
                  }}
                  placeholder="Ask about exports, consent, CHII IDs…"
                  className="h-10 w-full rounded-lg bg-surface pl-9 pr-3 text-sm text-ink outline-none placeholder:text-faint"
                />
              </label>
            </div>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
              {!q && (
                <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                  {suggested.map((s) => (
                    <button key={s} type="button" onClick={() => setQ(s)} className="rounded-full border border-line px-2.5 py-1 text-xs text-body hover:border-line-strong">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-2 py-2">
                <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-faint">{q ? `${results.length} answer${results.length === 1 ? '' : 's'}` : 'Popular'}</div>
                {results.length === 0 ? (
                  <EmptyState compact icon={Search} title="No answer for that yet" body="Try other words, like “export” or “consent”, or email the MELA team." />
                ) : (
                  <ul>
                    {results.map((f) => {
                      const on = expanded === f.id
                      return (
                        <li key={f.id} className="border-b border-line last:border-0">
                          <button type="button" onClick={() => setExpanded(on ? null : f.id)} aria-expanded={on} className="flex w-full items-start gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-canvas">
                            <span className="min-w-0 flex-1 text-sm font-medium text-ink">{f.q}</span>
                            <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform duration-200 ease-out ${on ? 'rotate-180' : ''}`} />
                          </button>
                          <AnimatePresence initial={false}>
                            {on && (
                              <motion.div
                                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                                className="overflow-hidden"
                              >
                                <p className="px-2 pb-2 text-sm leading-6 text-body">{f.a}</p>
                                {f.to && onGo && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onGo(f.to!.key)
                                      setOpen(false)
                                    }}
                                    className="mb-3 ml-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600"
                                  >
                                    {f.to.label} <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
            <a href="mailto:mela@chii.alu.edu" className="flex items-center gap-2 border-t border-line px-4 py-3 text-sm font-medium text-body hover:bg-canvas">
              <Mail className="h-4 w-4 text-muted" /> Still stuck? Email the MELA team
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
