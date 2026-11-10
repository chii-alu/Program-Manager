import React from 'react'
import { FileText, ClipboardCheck, UserCheck, Fingerprint, Moon, Sun } from 'lucide-react'
import { ChiiMark } from './Brand'
import { useTheme } from '../hooks/useTheme'

/**
 * Two-panel auth card on desktop. Below lg it is one column that fits the screen:
 * no horizontal scroll and no vertical scroll, tightening its spacing on short phones.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme()
  return (
    <div className="relative h-full overflow-hidden bg-surface lg:overflow-y-auto lg:bg-canvas">
      <div className="flex h-full items-stretch justify-center lg:h-auto lg:min-h-full lg:items-center lg:p-8">
        <div className="grid h-full w-full max-w-5xl overflow-hidden bg-surface lg:h-auto lg:grid-cols-[1fr_1fr] lg:rounded-2xl lg:border lg:border-line lg:shadow-[0_1px_2px_rgba(14,26,51,0.04),0_12px_32px_-12px_rgba(14,26,51,0.12)]">
          <section className="flex h-full min-h-0 min-w-0 flex-col px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),16px)] sm:px-10 sm:pt-8 lg:h-auto lg:px-14 lg:py-12">
            <div className="flex shrink-0 items-center justify-between lg:justify-end">
              <span className="lg:hidden">
                <ChiiMark />
              </span>
              <button
                type="button"
                onClick={toggle}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors duration-150 ease-out hover:text-ink lg:-mr-6 lg:-mt-4"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
            <div className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col justify-center py-4 lg:py-0">{children}</div>
          </section>
          <BrandPanel />
        </div>
      </div>
    </div>
  )
}

const capabilities = [
  { icon: FileText, title: 'Smart forms', body: 'Registration, application and feedback forms for every session.' },
  { icon: ClipboardCheck, title: 'Fair selection', body: 'Review, score and select applicants with ease.' },
  { icon: UserCheck, title: 'Live attendance', body: 'Mark who showed up, session by session.' },
  { icon: Fingerprint, title: 'One ID, full journey', body: 'Follow each person across every programme, counted once.' },
]

function BrandPanel() {
  return (
    <aside className="hidden flex-col bg-brand-hover px-12 py-12 text-white lg:flex">
      <ChiiMark tone="light" height="h-12" />
      <p className="mt-8 text-[15px] leading-7 text-white/90">
        Manage every CHII intervention in one place, from sign-up to feedback. Track each young person across HEMP,
        HENT and HECO with one CHII ID.
      </p>
      <ul className="mt-10 space-y-5">
        {capabilities.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/5">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{title}</div>
              <div className="mt-0.5 text-[13px] leading-5 text-white/70">{body}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-10 text-xs text-white/55">© 2026 CHII · African Leadership University</div>
    </aside>
  )
}
