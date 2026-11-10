import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/** A trigger plus a floating panel that closes on outside click or Escape. */
export function Popover({
  trigger,
  children,
  align = 'right',
  width = 'w-64',
  side = 'bottom',
}: {
  side?: 'top' | 'bottom'
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode
  children: (close: () => void) => React.ReactNode
  align?: 'left' | 'right' | 'stretch'
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', click)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', click)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: side === 'top' ? 4 : -4 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            className={`absolute z-50 max-w-[calc(100vw-24px)] rounded-xl border border-line bg-surface shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)] ${width} ${
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            } ${align === 'right' ? 'right-0 origin-top-right' : align === 'left' ? 'left-0 origin-top-left' : 'inset-x-0 origin-bottom'}`}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const MenuItem: React.FC<{
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  onClick?: () => void
  tone?: 'bad'
  hint?: React.ReactNode
}> = ({ icon: Icon, children, onClick, tone, hint }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors duration-150 ease-out hover:bg-canvas ${
        tone === 'bad' ? 'text-bad' : 'text-body hover:text-ink'
      }`}
    >
      {Icon && <Icon className={`h-4 w-4 shrink-0 ${tone === 'bad' ? '' : 'text-muted'}`} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-xs text-faint">{hint}</span>}
    </button>
  )
}
