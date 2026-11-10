import React, { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}

const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

/** Bottom sheet on phones, centred dialog from sm up. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', icon }: Props) {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className={`relative flex max-h-[90%] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-[0_24px_64px_-16px_rgba(0,0,0,0.35)] sm:max-h-[85vh] sm:rounded-2xl ${widths[size]}`}
          >
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1.5 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children && <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
            {footer && (
              <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas/50 px-5 py-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:flex-row sm:justify-end sm:pb-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
