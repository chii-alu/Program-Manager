import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { Toast, onToast } from '../lib/notify'

const icons = { good: CheckCircle2, warn: AlertTriangle, bad: XCircle, info: Info }
const tones = { good: 'text-good', warn: 'text-warn', bad: 'text-bad', info: 'text-brand-600' }

/** Stacks toasts top-centre on phones and bottom-right on desktop. */
export function Toaster({ onAction }: { onAction?: (to: string) => void }) {
  const [items, setItems] = useState<Toast[]>([])
  const reduce = useReducedMotion()
  useEffect(
    () =>
      onToast((t) => {
        setItems((xs) => [...xs.slice(-2), t])
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 4500)
      }),
    [],
  )
  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[80] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:top-auto md:items-end">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = icons[t.tone ?? 'info']
          return (
            <motion.div
              key={t.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tones[t.tone ?? 'info']}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{t.title}</div>
                {t.body && <div className="mt-0.5 truncate text-xs text-muted">{t.body}</div>}
              </div>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    onAction?.(t.action!.to)
                    setItems((xs) => xs.filter((x) => x.id !== t.id))
                  }}
                  className="shrink-0 text-xs font-semibold text-brand-600 hover:underline"
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} className="-mr-1 shrink-0 text-faint hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
