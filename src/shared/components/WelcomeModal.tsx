import React, { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, BarChart3, ClipboardCheck, Command, EyeOff, Fingerprint, LayoutGrid, Lock, ShieldCheck, Upload } from 'lucide-react'
import { Portal, Role, portalMeta, roleMeta } from '../data/mela'

type Slide = { icon: React.ComponentType<{ className?: string }>; title: string; body: string; points: { icon: React.ComponentType<{ className?: string }>; text: string }[] }

function slidesFor(role: Role, portal: Portal): Slide[] {
  const pillar = portalMeta[portal].label
  const tour: Slide = {
    icon: Command,
    title: 'Find anything in a keystroke',
    body: 'Press ⌘K to jump to a page, a person or a CHII ID. Switch dark mode and sign out from your profile menu.',
    points: [
      { icon: LayoutGrid, text: 'Sidebar on desktop, bottom bar on your phone' },
      { icon: BarChart3, text: 'Analytics updates as forms come in' },
    ],
  }
  if (role === 'admin')
    return [
      {
        icon: ShieldCheck,
        title: 'You have the MELA view',
        body: 'As a MELA admin you see every pillar, every person and every export. Switch portals from the sidebar to see what each pillar sees.',
        points: [
          { icon: Fingerprint, text: 'Names, contacts and standing are visible to you' },
          { icon: Lock, text: 'Every export is written to the export log' },
        ],
      },
      {
        icon: ShieldCheck,
        title: 'Give your team access',
        body: 'New colleagues sign in once, then you assign their role and pillar on Staff access. Without a role they see nothing.',
        points: [
          { icon: Upload, text: 'Import past spreadsheets with a dry run first' },
          { icon: BarChart3, text: 'Consolidated sheets feed the dashboard' },
        ],
      },
      tour,
    ]
  if (role === 'reviewer')
    return [
      {
        icon: ClipboardCheck,
        title: 'Your review queue is ready',
        body: 'You’ll see applications for the sessions assigned to you. Score each one against the rubric; selection happens when every score is in.',
        points: [
          { icon: EyeOff, text: 'Applicants appear by CHII ID only, to keep scoring fair' },
          { icon: Lock, text: 'You can only see and change your own scores' },
        ],
      },
      tour,
    ]
  return [
    {
      icon: LayoutGrid,
      title: `Welcome to the ${pillar} portal`,
      body: `You can run sessions, forms, attendance and feedback for ${pillar}. Other pillars’ records are not visible to you.`,
      points: [
        { icon: Fingerprint, text: `Names show only for people linked to ${pillar}` },
        { icon: Upload, text: 'Bring in past sheets with Import a sheet' },
      ],
    },
    tour,
  ]
}

export function WelcomeModal({ open, role, portal, onClose }: { open: boolean; role: Role; portal: Portal; onClose: () => void }) {
  const [i, setI] = useState(0)
  const reduce = useReducedMotion()
  const slides = slidesFor(role, portal)
  const s = slides[Math.min(i, slides.length - 1)]
  const last = i >= slides.length - 1
  const Icon = s.icon
  const first = roleMeta[role].user.split(' ')[0]

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Welcome"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full overflow-hidden rounded-t-2xl border border-line bg-surface sm:max-w-md sm:rounded-2xl"
          >
            <div className="bg-brand px-6 pb-6 pt-6 text-white">
              <div className="text-xs font-medium text-white/70">Hi {first} · {roleMeta[role].label}</div>
              <span className="mt-4 grid h-11 w-11 place-items-center rounded-xl bg-white/10">
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={i}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className="px-6 pt-5"
              >
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">{s.body}</p>
                <ul className="mt-4 space-y-2.5">
                  {s.points.map((p) => (
                    <li key={p.text} className="flex items-start gap-2.5 text-sm text-body">
                      <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      {p.text}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
            <div className="mt-6 flex items-center gap-3 border-t border-line px-6 py-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4">
              <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${slides.length}`}>
                {slides.map((_, k) => (
                  <span key={k} className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out ${k === i ? 'w-5 bg-brand-600' : 'w-1.5 bg-line-strong'}`} />
                ))}
              </div>
              <button type="button" onClick={onClose} className="ml-auto h-9 rounded-lg px-3 text-sm font-medium text-muted hover:text-ink">
                Skip
              </button>
              <button
                type="button"
                onClick={() => (last ? onClose() : setI(i + 1))}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-brand-hover"
              >
                {last ? 'Get started' : 'Next'} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
