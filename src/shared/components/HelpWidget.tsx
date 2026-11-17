import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUp, Mail, RotateCcw, X } from 'lucide-react'
import { addMessage, askLaura, clearChat, startChat, useLauraChat, type LauraContext } from '../lib/laura'

/**
 * Laura: a friendly female robot. Round white head with a navy face screen, cyan eyes with lashes,
 * a smile and blush, pink ear pods and a bow, on a navy-to-blue disc in the theme colours. `live` (the launcher) adds a
 * gentle glow, a slow bob and an occasional blink; motion is skipped for people who prefer reduced motion.
 */
function LauraBot({ size = 28, live = false }: { size?: number; live?: boolean }) {
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }} aria-hidden>
      {live && <span className="absolute -inset-1 rounded-full bg-[#479bd6] opacity-40 blur-md motion-safe:animate-[pulse_2.8s_ease-in-out_infinite]" />}
      <svg viewBox="0 0 64 64" width={size} height={size} className={`relative ${live ? 'motion-safe:animate-[laura-bob_3.2s_ease-in-out_infinite]' : ''}`}>
        <defs>
          <linearGradient id="laura-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#102c5e" />
            <stop offset="1" stopColor="#185fa5" />
          </linearGradient>
          <linearGradient id="laura-head" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e0e7ff" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#laura-bg)" />
        {/* antenna */}
        <line x1="32" y1="17" x2="32" y2="11" stroke="#e0e7ff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="9.5" r="2.8" fill="#f472b6" />
        {/* ear pods */}
        <rect x="10" y="28" width="6" height="11" rx="3" fill="#f472b6" />
        <rect x="48" y="28" width="6" height="11" rx="3" fill="#f472b6" />
        {/* head */}
        <rect x="14" y="17" width="36" height="32" rx="14" fill="url(#laura-head)" />
        {/* bow */}
        <path d="M41 17.5 L47 14 L47 21 Z M41 17.5 L35.5 14.5 L36 20.5 Z" fill="#ec4899" />
        <circle cx="41" cy="17.5" r="1.8" fill="#be185d" />
        {/* face screen */}
        <rect x="19" y="24" width="26" height="19" rx="9" fill="#1e1b4b" />
        {/* eyes (blink) with lashes */}
        <g className={live ? 'motion-safe:animate-[laura-blink_5s_ease-in-out_infinite]' : ''} style={{ transformOrigin: '32px 31px', transformBox: 'view-box' }}>
          <ellipse cx="26.5" cy="31" rx="2.6" ry="3.2" fill="#7dd3fc" />
          <ellipse cx="37.5" cy="31" rx="2.6" ry="3.2" fill="#7dd3fc" />
          <circle cx="27.3" cy="30" r="0.9" fill="#ffffff" />
          <circle cx="38.3" cy="30" r="0.9" fill="#ffffff" />
        </g>
        <path d="M23.4 27.6 l-1.6 -1.4 M24.6 26.9 l-0.9 -1.8 M40.6 27.6 l1.6 -1.4 M39.4 26.9 l0.9 -1.8" stroke="#bfdbfe" strokeWidth="1.1" strokeLinecap="round" />
        {/* blush and smile */}
        <circle cx="22.8" cy="37" r="1.7" fill="#f472b6" opacity="0.75" />
        <circle cx="41.2" cy="37" r="1.7" fill="#f472b6" opacity="0.75" />
        <path d="M28.5 37 Q32 40.2 35.5 37" stroke="#f9a8d4" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* neck */}
        <rect x="27" y="49" width="10" height="4" rx="2" fill="#c7d2fe" />
      </svg>
      <style>{`@keyframes laura-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}@keyframes laura-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}`}</style>
    </span>
  )
}
const Avatar = ({ size = 28 }: { size?: number }) => <LauraBot size={size} />

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
      addMessage({ from: 'laura', text: 'Oh no, something went wrong on my side. Sorry about that! Could you try again?' })
    } finally {
      setThinking(false)
    }
  }
  const last = messages[messages.length - 1]

  return (
    <>
      {/* Launcher: Laura the robot. On hover (or keyboard focus) the button itself grows into a pill
          reading "Ask Laura"; while the chat is open it's a round close button. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat with Laura' : 'Ask Laura'}
        className={`group fixed bottom-20 right-4 z-40 flex h-14 items-center rounded-full transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-95 md:bottom-6 md:right-6 ${
          open
            ? 'w-14 justify-center bg-brand text-white shadow-[0_8px_24px_-6px_rgba(19,48,107,0.5)]'
            : 'p-px hover:bg-brand hover:shadow-[0_10px_28px_-8px_rgba(24,95,165,0.6)] focus-visible:bg-brand'
        }`}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <span className="grid max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold text-white opacity-0 transition-[max-width,opacity,padding] duration-200 ease-out group-hover:max-w-[110px] group-hover:pl-4 group-hover:pr-2 group-hover:opacity-100 group-focus-visible:max-w-[110px] group-focus-visible:pl-4 group-focus-visible:pr-2 group-focus-visible:opacity-100">
              Ask Laura
            </span>
            <LauraBot size={54} live />
          </>
        )}
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
              <span className="shrink-0 rounded-full bg-white/15 p-0.5">
                <LauraBot size={34} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <span>Laura</span>
                  <span title="For now Laura answers from the platform guide; the full AI comes later." className="rounded-full bg-white/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">
                    Preview
                  </span>
                </div>
                <div className="truncate text-xs text-white/70">Your friendly MELA assistant</div>
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
                  placeholder="Ask Laura anything…"
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
