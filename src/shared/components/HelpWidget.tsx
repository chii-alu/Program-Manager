import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUp, Mail, RotateCcw, Sparkles, X } from 'lucide-react'
import { addMessage, askLaura, clearChat, startChat, useLauraChat, type LauraContext } from '../lib/laura'

/** Laura's avatar: a navy circle with her initial and a small spark. */
function Avatar({ size = 28 }: { size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full bg-brand font-display font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.46 }} aria-hidden>
      L
      <Sparkles className="absolute -right-0.5 -top-0.5 rounded-full bg-surface p-[1px] text-brand-600" style={{ width: size * 0.42, height: size * 0.42 }} />
    </span>
  )
}

/**
 * Floating chat with Laura, the platform assistant. For now she answers from the platform guide;
 * the AI plugs in behind `askLaura` (src/shared/lib/laura.ts) without changing this chat.
 */
export function HelpWidget({ onGo, context }: { onGo?: (key: string) => void; context: LauraContext }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const messages = useLauraChat()
  const reduce = useReducedMotion()
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      startChat(context.user)
      setTimeout(() => input.current?.focus(), 50)
    }
  }, [open])
  // Braces matter: newer browsers return a Promise from scrollIntoView, which an effect mustn't return.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' })
  }, [messages.length, thinking, open])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || thinking) return
    setDraft('')
    addMessage({ from: 'user', text: q })
    setThinking(true)
    try {
      addMessage(await askLaura(q, messages, context))
    } catch {
      addMessage({ from: 'laura', text: 'Sorry, something went wrong on my side. Please try again.' })
    } finally {
      setThinking(false)
    }
  }
  const last = messages[messages.length - 1]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat with Laura' : 'Chat with Laura'}
        title={open ? undefined : 'Ask Laura'}
        className="fixed bottom-20 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-brand text-white shadow-[0_8px_24px_-6px_rgba(19,48,107,0.5)] transition-transform duration-150 ease-out active:scale-95 md:bottom-6 md:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <span className="font-display text-lg font-semibold">L</span>}
        {!open && <Sparkles className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-surface p-[2px] text-brand-600" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Chat with Laura"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-x-3 bottom-36 z-40 flex h-[66dvh] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-16px_rgba(0,0,0,0.35)] md:inset-x-auto md:bottom-20 md:right-6 md:h-[600px] md:max-h-[calc(100dvh-120px)] md:w-[400px]"
          >
            <div className="flex items-center gap-3 bg-brand px-4 py-3 text-white">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white font-display text-base font-semibold text-brand">L</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  Laura
                  <span title="For now Laura answers from the platform guide; the full AI comes later." className="rounded-full bg-white/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">
                    Preview
                  </span>
                </div>
                <div className="truncate text-xs text-white/70">Your MELA assistant</div>
              </div>
              <button type="button" onClick={() => clearChat(context.user)} aria-label="New chat" title="New chat" className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto bg-canvas/50 px-3 py-4" aria-live="polite">
              {messages.map((m) =>
                m.from === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm leading-6 text-white">{m.text}</p>
                  </div>
                ) : (
                  <div key={m.id} className="flex items-start gap-2">
                    <Avatar />
                    <div className="min-w-0 max-w-[85%]">
                      <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2 text-sm leading-6 text-body">
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        {m.link && onGo && (
                          <button
                            type="button"
                            onClick={() => {
                              onGo(m.link!.key)
                              setOpen(false)
                            }}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                          >
                            {m.link.label} <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {m === last && !thinking && m.follow && m.follow.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.follow.map((f) => (
                            <button key={f} type="button" onClick={() => send(f)} className="rounded-full border border-line-strong bg-surface px-2.5 py-1 text-left text-xs text-body hover:border-brand-600 hover:text-brand-600">
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
              {thinking && (
                <div className="flex items-center gap-2">
                  <Avatar />
                  <span className="inline-flex gap-1 rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-3" aria-label="Laura is typing">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </span>
                </div>
              )}
              <div ref={end} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(draft)
              }}
              className="border-t border-line bg-surface p-3"
            >
              <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100">
                <textarea
                  ref={input}
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send(draft)
                    }
                  }}
                  placeholder="Ask Laura…"
                  aria-label="Message Laura"
                  className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-ink outline-none placeholder:text-faint"
                />
                <button type="submit" disabled={!draft.trim() || thinking} aria-label="Send" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-white disabled:opacity-40">
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-faint">
                <span>Don’t share names or contact details in the chat.</span>
                <a href="mailto:mela@chii.alu.edu" className="inline-flex shrink-0 items-center gap-1 font-medium text-muted hover:text-ink">
                  <Mail className="h-3 w-3" /> Email MELA
                </a>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
