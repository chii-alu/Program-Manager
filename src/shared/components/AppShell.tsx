import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  BarChart3,
  Bell,
  BellOff,
  BookOpen,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ClipboardCheck,
  CornerDownLeft,
  Database,
  Download,
  Keyboard,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Plus,
  Search,
  Settings,
  Sheet,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Sun,
  Table2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { ChiiMark } from './Brand'
import { MenuItem, Popover } from './Popover'
import { Modal } from './Modal'
import { ChartsPageSkeleton, PageSkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { Toaster } from './Toaster'
import { HelpWidget } from './HelpWidget'
import { CountUp } from './StatStrip'
import { RangePanel, TimeFilter } from './TimeFilter'
import { useTheme } from '../hooks/useTheme'
import { startRealtime, timeAgo, toast, useNotifications } from '../lib/notify'
import { bounds, totals, useTimeRange } from '../lib/time'
import { useInstall } from '../lib/pwa'
import { Portal, Role, applications, participants, pillarStats, pillarsFor, portalMeta, roleMeta, sessions } from '../data/mela'

export type ShellProps = {
  role: Role
  portal: Portal
  active: string
  onNavigate?: (to: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
  children: React.ReactNode
}

type NavItem = { key: string; label: string; short?: string; icon: React.ComponentType<{ className?: string }>; count?: number }
type NavGroup = { title: string; items: NavItem[] }

const SB_KEY = 'mela-sidebar'
function readSidebar(): { width: number; collapsed: boolean } {
  try {
    return { width: 248, collapsed: false, ...JSON.parse(localStorage.getItem(SB_KEY) || '{}') }
  } catch {
    return { width: 248, collapsed: false }
  }
}

export function department(role: Role, portal: Portal) {
  if (role === 'admin') return { unit: 'MELA team', scope: portal === 'admin' ? 'Viewing all pillars' : `Viewing ${portalMeta[portal].label}` }
  if (role === 'reviewer') return { unit: 'Review panel', scope: `${portalMeta[portal].label} applications` }
  if (role === 'none') return { unit: 'No department', scope: 'Awaiting access' }
  return { unit: `${portalMeta[portal].label} pillar`, scope: portalMeta[portal].full }
}

/** Live figures for the signed-in person's department; changes with portal, role and period. */
export function departmentStats(role: Role, portal: Portal, range: ReturnType<typeof useTimeRange>['range']) {
  if (role === 'reviewer') {
    const todo = applications.filter((a) => a.score == null).length
    return [
      { label: 'To score', value: todo, tone: todo ? 'warn' : 'good' },
      { label: 'Assigned', value: applications.length },
    ]
  }
  if (role === 'none') return []
  const pls = pillarsFor(portal)
  const t = totals(range)
  return [
    { label: 'Reached', value: pls.reduce((n, pl) => n + t[pl], 0) },
    { label: 'Open', value: sessions.filter((s) => pls.includes(s.pillar) && s.status === 'open').length, tone: 'good' },
    { label: 'Sessions', value: pls.reduce((n, pl) => n + pillarStats[pl].sessions, 0) },
  ]
}

export function AppShell({ role, portal, active, onNavigate, onPortalChange, onSignOut, children }: ShellProps) {
  const reduce = useReducedMotion()
  const [moreOpen, setMoreOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [sb, setSb] = useState(readSidebar)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(true)
  const { theme, toggle } = useTheme()
  const { range } = useTimeRange()
  const groups = navFor(role, portal)
  const primary = bottomFor(role)
  const me = roleMeta[role]
  const collapsed = sb.collapsed

  // Hovering the collapsed rail peeks it open over the page; it shrinks back on leave.
  const [peek, setPeek] = useState<'off' | 'open' | 'closing'>('off')
  const peekTimer = useRef<number | undefined>(undefined)
  const peeking = collapsed && peek === 'open'
  const overlay = collapsed && peek !== 'off'
  const peekEnter = () => {
    window.clearTimeout(peekTimer.current)
    if (!collapsed || !window.matchMedia('(hover: hover)').matches) return
    peekTimer.current = window.setTimeout(() => setPeek('open'), 120)
  }
  const peekLeave = () => {
    window.clearTimeout(peekTimer.current)
    setPeek((p) => (p === 'open' ? 'closing' : 'off'))
    peekTimer.current = window.setTimeout(() => setPeek('off'), 200)
  }
  useEffect(() => () => window.clearTimeout(peekTimer.current), [])

  const go = (k: string) => {
    setMoreOpen(false)
    setPaletteOpen(false)
    peekLeave()
    onNavigate?.(k)
  }

  // Short skeleton on arrival, and when the period or portal changes.
  const firstRun = useRef(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), firstRun.current ? 380 : 260)
    if (!firstRun.current) setLoading(true)
    firstRun.current = false
    return () => clearTimeout(t)
  }, [range.preset, range.from, range.to, portal])

  useEffect(() => {
    startRealtime()
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const persist = (next: { width: number; collapsed: boolean }) => {
    window.clearTimeout(peekTimer.current)
    setPeek('off')
    setSb(next)
    try {
      localStorage.setItem(SB_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = collapsed ? 68 : sb.width
    let latest = sb
    setDragging(true)
    const move = (ev: PointerEvent) => {
      const w = startW + ev.clientX - startX
      latest = w < 150 ? { width: sb.width, collapsed: true } : { width: Math.min(340, Math.max(208, w)), collapsed: false }
      setSb(latest)
    }
    const up = () => {
      setDragging(false)
      persist(latest)
      window.removeEventListener('pointermove', move)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const wide = !collapsed || peeking
  const L = wide ? 'hidden lg:block' : 'hidden'

  return (
    <div className={`relative flex h-full overflow-hidden bg-canvas text-ink ${dragging ? 'cursor-col-resize select-none' : ''}`}>
      {/* Holds the rail's place in the layout while the sidebar peeks over the page */}
      {overlay && <div aria-hidden className="hidden w-[68px] shrink-0 md:block" />}
      {/* Sidebar: rail on tablets, resizable on desktop, peeks open on hover when collapsed */}
      <aside
        style={{ ['--sbw' as string]: `${collapsed && !peeking ? 68 : sb.width}px` }}
        onMouseEnter={peekEnter}
        onMouseLeave={peekLeave}
        className={`hidden w-[68px] shrink-0 flex-col border-r border-line bg-surface md:flex lg:w-[var(--sbw)] ${
          overlay ? 'absolute inset-y-0 left-0 z-30 shadow-xl' : 'relative'
        } ${dragging ? '' : 'transition-[width] duration-200 ease-out'}`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <span className={wide ? 'lg:hidden' : ''}>
            <ChiiMark compact />
          </span>
          <span className={`min-w-0 flex-1 ${L}`}>
            <ChiiMark />
          </span>
          {wide && !peeking && (
            <button
              type="button"
              onClick={() => persist({ ...sb, collapsed: true })}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="hidden h-7 w-7 shrink-0 place-items-center rounded-md text-faint transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink lg:grid"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <ProfileCard role={role} portal={portal} wide={wide} onPortalChange={onPortalChange} />

        <nav className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 lg:px-3">
          {groups.map((g, gi) => (
            <div key={g.title} className={gi > 0 ? `mt-4 border-t border-line pt-4 ${wide ? 'lg:mt-5 lg:border-0 lg:pt-0' : ''}` : ''}>
              <div className={`mb-1 truncate px-2.5 text-[11px] font-medium text-faint ${L}`}>{g.title}</div>
              <ul className="space-y-0.5">
                {g.items.map((it) => (
                  <li key={it.key}>
                    <SideLink item={it} wide={wide} active={active === it.key} onClick={() => go(it.key)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-line p-2.5 lg:p-3">
          {collapsed && (
            <button
              type="button"
              onClick={() => persist({ ...sb, collapsed: false })}
              title={peeking ? 'Keep sidebar open' : 'Expand sidebar'}
              className={`hidden h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink lg:flex ${
                peeking ? 'lg:justify-start' : 'lg:justify-center'
              }`}
            >
              <ChevronsRight className="h-4 w-4 shrink-0" />
              {peeking && <span className="truncate">Keep open</span>}
            </button>
          )}
          <FooterButton wide={wide} icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggle} />
          <FooterButton wide={wide} icon={LogOut} label="Sign out" onClick={onSignOut} danger />
        </div>

        {/* Resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize · double-click to reset"
          onPointerDown={startDrag}
          onDoubleClick={() => persist({ width: 248, collapsed: false })}
          className={`group absolute inset-y-0 -right-1.5 z-20 hidden w-3 cursor-col-resize ${overlay ? '' : 'lg:block'}`}
        >
          <span className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors duration-150 ease-out ${dragging ? 'bg-brand-600' : 'bg-transparent group-hover:bg-brand-200'}`} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <ChiiMark compact />
            <span className="truncate text-sm font-semibold">{portalMeta[portal].label}</span>
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-line bg-canvas px-3 text-left text-sm text-faint transition-colors duration-150 ease-out hover:border-line-strong md:flex"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Search people, CHII IDs, pages…</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
            {role !== 'none' && (
              <>
                <span className="hidden sm:block">
                  <TimeFilter />
                </span>
                <span className="sm:hidden">
                  <TimeFilter compact />
                </span>
              </>
            )}
            {role !== 'none' && role !== 'reviewer' && (
              <Popover
                width="w-56"
                trigger={({ toggle: t }) => (
                  <button
                    type="button"
                    onClick={t}
                    className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-brand-hover xl:inline-flex"
                  >
                    <Plus className="h-4 w-4" /> Create
                  </button>
                )}
              >
                {(close) => (
                  <div className="p-1">
                    <MenuItem icon={Layers} onClick={() => (close(), go('new-session'))}>New session</MenuItem>
                    <MenuItem icon={Upload} onClick={() => (close(), go('import'))}>Import a sheet</MenuItem>
                    {role === 'admin' && <MenuItem icon={ShieldCheck} onClick={() => (close(), go('staff'))}>Add staff member</MenuItem>}
                  </div>
                )}
              </Popover>
            )}
            <IconButton label="Search" className="md:hidden" onClick={() => setPaletteOpen(true)}>
              <Search className="h-[18px] w-[18px]" />
            </IconButton>
            <IconButton label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggle} className="hidden sm:grid">
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </IconButton>
            <NotificationsMenu onGo={go} />
            <div className="hidden md:block">
              <UserMenu role={role} portal={portal} theme={theme} onTheme={toggle} onGo={go} onShortcuts={() => setShortcutsOpen(true)} onSignOut={onSignOut} />
            </div>
            <button type="button" onClick={() => setMoreOpen(true)} aria-label="Account and menu" className="ml-1 md:hidden">
              <Avatar initials={me.initials} />
            </button>
          </div>
        </header>

        <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-0">
          {role === 'none' ? (
            <NoRole email={me.email} onSignOut={onSignOut} />
          ) : (
            <>
              {loading && (active === 'analytics' || active === 'overview' ? <ChartsPageSkeleton /> : <PageSkeleton />)}
              <motion.div
                key={active}
                className={loading ? 'hidden' : ''}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={loading ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              >
                {children}
              </motion.div>
            </>
          )}
        </main>

        {/* Bottom nav: phones only */}
        {role !== 'none' && (
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            <ul className="grid" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
              {primary.map((it) => (
                <li key={it.key}>
                  <BottomLink item={it} active={active === it.key} onClick={() => go(it.key)} />
                </li>
              ))}
              <li>
                <BottomLink item={{ key: 'more', label: 'More', icon: Menu }} active={moreOpen || !primary.some((p) => p.key === active)} onClick={() => setMoreOpen(true)} />
              </li>
            </ul>
          </nav>
        )}
      </div>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={role}
        portal={portal}
        groups={groups}
        active={active}
        theme={theme}
        onTheme={toggle}
        onGo={go}
        onPortalChange={onPortalChange}
        onSignOut={onSignOut}
      />
      {paletteOpen && <CommandPalette groups={groups} role={role} onClose={() => setPaletteOpen(false)} onGo={go} onTheme={toggle} />}
      <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Keyboard shortcuts" size="sm" icon={<Keyboard className="h-4 w-4" />}>
        <dl className="divide-y divide-line text-sm">
          {[
            ['Search everything', '⌘ K'],
            ['Close a dialog or menu', 'Esc'],
            ['Open the first search result', 'Enter'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2.5">
              <dt className="text-body">{k}</dt>
              <dd>
                <kbd className="rounded border border-line bg-canvas px-2 py-0.5 text-xs font-medium text-muted">{v}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Modal>
      <Toaster onAction={go} />
      {role !== 'none' && <HelpWidget onGo={go} />}
    </div>
  )
}

/* ---------------- Sidebar pieces ---------------- */

function ProfileCard({ role, portal, wide, onPortalChange }: { role: Role; portal: Portal; wide: boolean; onPortalChange?: (p: string) => void }) {
  const dept = department(role, portal)
  return (
    <div className="border-b border-line px-2.5 py-3 lg:px-3">
      <div className={`flex flex-col items-center gap-1.5 ${wide ? 'lg:hidden' : ''}`} title={`${portalMeta[portal].label} · ${dept.unit}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={portal}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            className="rounded bg-brand-50 px-1 text-[9px] font-semibold text-brand-600"
          >
            {portalMeta[portal].label}
          </motion.span>
        </AnimatePresence>
      </div>
      {wide && (
        <div className="hidden lg:block">
          {role === 'admin' ? (
            <Popover
              align="left"
              width="w-[calc(100%)] min-w-[220px]"
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} className="flex w-full items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-left transition-colors duration-150 ease-out hover:border-line-strong">
                  <span className="text-xs font-semibold">{portalMeta[portal].label}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted">{dept.scope}</span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                </button>
              )}
            >
              {(close) => <PortalList portal={portal} onPick={(p) => (onPortalChange?.(p), close())} />}
            </Popover>
          ) : (
            <div className="truncate rounded-lg bg-canvas px-2.5 py-1.5 text-[11px] text-muted">{dept.scope}</div>
          )}
        </div>
      )}
    </div>
  )
}

function PortalList({ portal, onPick }: { portal: Portal; onPick: (p: Portal) => void }) {
  return (
    <ul className="p-1">
      {(Object.keys(portalMeta) as Portal[]).map((p) => (
        <li key={p}>
          <button type="button" onClick={() => onPick(p)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-canvas">
            <span className="w-11 text-sm font-semibold">{portalMeta[p].label}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{portalMeta[p].full}</span>
            {p === portal && <Check className="h-4 w-4 text-brand-600" />}
          </button>
        </li>
      ))}
    </ul>
  )
}

function FooterButton({ wide, icon: Icon, label, onClick, danger }: { wide: boolean; icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex h-9 w-full items-center justify-center gap-2.5 rounded-lg px-2.5 text-sm text-body transition-colors duration-150 ease-out ${wide ? 'lg:justify-start' : ''} ${
        danger ? 'hover:bg-bad-bg hover:text-bad' : 'hover:bg-canvas'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted" />
      <span className={`truncate ${wide ? 'hidden lg:inline' : 'hidden'}`}>{label}</span>
    </button>
  )
}

function SideLink({ item, active, wide, onClick }: { item: NavItem; active: boolean; wide: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-10 w-full items-center justify-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150 ease-out ${wide ? 'lg:h-9 lg:justify-start' : ''} ${
        active ? 'bg-brand-50 font-semibold text-brand-600' : 'text-body hover:bg-canvas hover:text-ink'
      }`}
    >
      {active && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand-600" transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} />}
      <Icon className={`h-[18px] w-[18px] shrink-0 ${wide ? 'lg:h-4 lg:w-4' : ''} ${active ? 'text-brand-600' : 'text-muted group-hover:text-ink'}`} />
      <span className={`min-w-0 flex-1 truncate text-left ${wide ? 'hidden lg:block' : 'hidden'}`}>{item.label}</span>
      {item.count != null && <span className={`rounded-full bg-canvas px-1.5 text-[11px] font-medium tabular-nums text-muted ${wide ? 'hidden lg:block' : 'hidden'}`}>{item.count}</span>}
    </button>
  )
}

function BottomLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-brand-600' : 'text-muted'}`}>
      <span className="relative grid h-7 w-12 place-items-center">
        {active && <motion.span layoutId="bottom-active" className="absolute inset-0 rounded-full bg-brand-50" transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} />}
        <Icon className="relative h-5 w-5" />
      </span>
      <span className="max-w-full truncate px-1">{item.short ?? item.label}</span>
    </button>
  )
}

/* ---------------- Top bar menus ---------------- */

function NotificationsMenu({ onGo }: { onGo: (k: string) => void }) {
  const { items, unread, markRead, markAll, remove, clear } = useNotifications()
  const dot = { bad: 'bg-bad', good: 'bg-good', warn: 'bg-warn', info: 'bg-brand-600' }
  return (
    <Popover
      width="w-[min(360px,calc(100vw-24px))]"
      trigger={({ toggle }) => (
        <IconButton label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={toggle}>
          <Bell className="h-[18px] w-[18px]" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key={unread}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white ring-2 ring-surface"
              >
                {unread > 9 ? '9+' : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </IconButton>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            <button type="button" disabled={!unread} onClick={markAll} className="text-xs font-medium text-brand-600 disabled:text-faint">
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <EmptyState compact icon={BellOff} title="You're all caught up" body="New imports, exports and session alerts will show here." />
          ) : (
            <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">
              <AnimatePresence initial={false}>
                {items.map((n) => (
                  <motion.li key={n.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="group">
                    <div className={`flex gap-3 px-4 py-3 ${n.unread ? 'bg-brand-50/50' : ''}`}>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.unread ? dot[n.tone] : 'bg-line-strong'}`} />
                      <button
                        type="button"
                        onClick={() => {
                          markRead(n.id)
                          if (n.to) {
                            close()
                            onGo(n.to)
                          }
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className={`text-sm ${n.unread ? 'font-semibold' : 'font-medium'}`}>{n.title}</div>
                        <div className="truncate text-xs text-muted">{n.body}</div>
                      </button>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-faint">{timeAgo(n.at)}</span>
                        <button type="button" aria-label="Dismiss" onClick={() => remove(n.id)} className="text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-ink">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          {items.length > 0 && (
            <button type="button" onClick={clear} className="w-full border-t border-line py-2.5 text-xs font-medium text-muted hover:text-ink">
              Clear all
            </button>
          )}
        </div>
      )}
    </Popover>
  )
}

function InstallItem({ onDone }: { onDone?: () => void }) {
  const { canPrompt, installed, ios, install } = useInstall()
  if (installed) return null
  return (
    <MenuItem
      icon={Smartphone}
      onClick={async () => {
        onDone?.()
        if (canPrompt) {
          const ok = await install()
          toast({ title: ok ? 'MELA installed' : 'Install cancelled', tone: ok ? 'good' : 'info' })
        } else {
          toast({ title: 'Install MELA on this device', body: ios ? 'Tap Share, then “Add to Home Screen”.' : 'Use your browser menu → “Install app”.', tone: 'info' })
        }
      }}
      hint="PWA"
    >
      Install app
    </MenuItem>
  )
}

function UserMenu(props: { role: Role; portal: Portal; theme: 'light' | 'dark'; onTheme: () => void; onGo: (k: string) => void; onShortcuts: () => void; onSignOut?: () => void }) {
  const { role, portal, theme, onTheme, onGo, onShortcuts, onSignOut } = props
  const me = roleMeta[role]
  const dept = department(role, portal)
  return (
    <Popover
      width="w-64"
      trigger={({ toggle, open }) => (
        <button type="button" onClick={toggle} className={`ml-1 flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 transition-colors duration-150 ease-out hover:bg-canvas ${open ? 'bg-canvas' : ''}`}>
          <Avatar initials={me.initials} />
          <span className="hidden text-left leading-tight 2xl:block">
            <span className="block max-w-[120px] truncate text-[13px] font-semibold">{me.user}</span>
            <span className="block text-[11px] text-muted">{dept.unit}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-3 border-b border-line p-3">
            <Avatar initials={me.initials} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{me.user}</div>
              <div className="truncate text-xs text-muted">{me.email}</div>
              <span className="mt-1 inline-flex rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">
                {me.label} · {dept.unit}
              </span>
            </div>
          </div>
          <div className="p-1">
            <MenuItem icon={User} onClick={close}>My profile</MenuItem>
            <MenuItem icon={Settings} onClick={close}>Account settings</MenuItem>
            <MenuItem icon={theme === 'dark' ? Sun : Moon} onClick={onTheme} hint={theme === 'dark' ? 'Dark' : 'Light'}>
              Theme
            </MenuItem>
            <MenuItem icon={Keyboard} onClick={() => (close(), onShortcuts())} hint="⌘K">
              Keyboard shortcuts
            </MenuItem>
            <InstallItem onDone={close} />
            {role === 'admin' && (
              <MenuItem icon={ShieldCheck} onClick={() => (close(), onGo('staff'))}>
                Staff access
              </MenuItem>
            )}
            <MenuItem icon={BookOpen} onClick={close}>Platform guide</MenuItem>
          </div>
          <div className="border-t border-line p-1">
            <MenuItem icon={LogOut} tone="bad" onClick={onSignOut}>
              Sign out
            </MenuItem>
          </div>
        </div>
      )}
    </Popover>
  )
}

function CommandPalette({ groups, role, onClose, onGo, onTheme }: { groups: NavGroup[]; role: Role; onClose: () => void; onGo: (k: string) => void; onTheme: () => void }) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const results = useMemo(() => {
    const t = q.toLowerCase()
    const pages = groups.flatMap((g) => g.items).filter((i) => i.label.toLowerCase().includes(t))
    const people = role === 'reviewer' || !t ? [] : participants.filter((p) => `${p.id} ${p.name}`.toLowerCase().includes(t)).slice(0, 5)
    const actions = [...(role !== 'reviewer' ? [{ key: 'new-session', label: 'Create a new session', icon: Plus }] : []), { key: 'theme', label: 'Toggle dark mode', icon: Moon }].filter((a) => a.label.toLowerCase().includes(t))
    return { pages, people, actions }
  }, [q, groups, role])

  const first = results.pages[0]?.key ?? (results.people[0] ? `person:${results.people[0].id}` : results.actions[0]?.key)
  const run = (k?: string) => {
    if (!k) return
    if (k === 'theme') {
      onTheme()
      onClose()
      return
    }
    onGo(k)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 px-3 pt-[10vh]" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-16px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={ref}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run(first)}
            placeholder="Search pages, people or CHII IDs…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          <Group title="Pages">
            {results.pages.map((i) => (
              <PaletteRow key={i.key} icon={i.icon} label={i.label} first={first === i.key} onClick={() => run(i.key)} />
            ))}
          </Group>
          {results.people.length > 0 && (
            <Group title="People">
              {results.people.map((p) => (
                <PaletteRow key={p.id} icon={User} label={p.name} meta={p.id} first={first === `person:${p.id}`} onClick={() => run(`person:${p.id}`)} />
              ))}
            </Group>
          )}
          {results.actions.length > 0 && (
            <Group title="Actions">
              {results.actions.map((a) => (
                <PaletteRow key={a.key} icon={a.icon} label={a.label} first={first === a.key} onClick={() => run(a.key)} />
              ))}
            </Group>
          )}
          {!first && <EmptyState compact icon={Search} title={`Nothing matches “${q}”`} body="Try a CHII ID like CHII-000214 or a page name." />}
        </div>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const kids = React.Children.toArray(children)
  if (!kids.length) return null
  return (
    <div className="mb-1">
      <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-faint">{title}</div>
      {kids}
    </div>
  )
}

const PaletteRow: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; meta?: string; first?: boolean; onClick: () => void }> = ({ icon: Icon, label, meta, first, onClick }) => (
  <button type="button" onClick={onClick} className={`flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-canvas ${first ? 'bg-canvas' : ''}`}>
    <Icon className="h-4 w-4 shrink-0 text-muted" />
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {meta && <span className="font-mono text-xs text-brand-600">{meta}</span>}
    {first && <CornerDownLeft className="h-3.5 w-3.5 text-faint" />}
  </button>
)

function MoreSheet(props: {
  open: boolean
  onClose: () => void
  role: Role
  portal: Portal
  groups: NavGroup[]
  active: string
  theme: 'light' | 'dark'
  onTheme: () => void
  onGo: (k: string) => void
  onPortalChange?: (p: string) => void
  onSignOut?: () => void
}) {
  const { open, onClose, role, portal, groups, active, theme, onTheme, onGo, onPortalChange, onSignOut } = props
  const reduce = useReducedMotion()
  const me = roleMeta[role]
  const dept = department(role, portal)
  const { range, setRange } = useTimeRange()
  const b = bounds(range)
  const [from, setFrom] = useState(format(b.start, 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(b.end, 'yyyy-MM-dd'))
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Menu"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
            className="absolute inset-x-0 bottom-0 max-h-[88%] overflow-y-auto overflow-x-hidden rounded-t-2xl bg-surface pb-[max(env(safe-area-inset-bottom),16px)]"
          >
            <div className="sticky top-0 z-10 bg-surface px-5 pb-3 pt-2.5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
              <div className="flex items-center gap-3">
                <span className="relative">
                  <Avatar initials={me.initials} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-good ring-2 ring-surface" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{me.user}</div>
                  <div className="truncate text-xs text-muted">
                    {me.label} · {dept.unit}
                  </div>
                </div>
                <IconButton label="Close" onClick={onClose}>
                  <X className="h-5 w-5" />
                </IconButton>
              </div>
            </div>

            {role !== 'none' && (
              <div className="space-y-4 px-5">
                <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line" style={{ gridTemplateColumns: `repeat(${departmentStats(role, portal, range).length || 1}, minmax(0, 1fr))` }}>
                  {departmentStats(role, portal, range).map((s) => (
                    <div key={s.label} className="min-w-0 bg-surface px-3 py-2">
                      <dt className="truncate text-[11px] text-faint">{s.label}</dt>
                      <dd className={`text-base font-semibold tabular-nums ${s.tone === 'warn' ? 'text-warn' : s.tone === 'good' ? 'text-good' : ''}`}>
                        <CountUp value={s.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-faint">Portal</div>
                  {role === 'admin' ? (
                    <div className="grid grid-cols-4 gap-1 rounded-lg bg-canvas p-1">
                      {(Object.keys(portalMeta) as Portal[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onPortalChange?.(p)}
                          className={`h-9 rounded-md text-sm font-semibold transition-colors duration-150 ease-out ${p === portal ? 'bg-surface text-brand-600 shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted'}`}
                        >
                          {portalMeta[p].label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="truncate rounded-lg bg-canvas px-3 py-2 text-sm">
                      <span className="font-semibold">{portalMeta[portal].label}</span> <span className="text-muted">· {dept.scope}</span>
                    </div>
                  )}
                </div>
                <div className="overflow-hidden rounded-xl border border-line">
                  <RangePanel from={from} to={to} setFrom={setFrom} setTo={setTo} preset={range.preset} setRange={setRange} onDone={onClose} />
                </div>
              </div>
            )}

            {groups.map((g) => (
              <div key={g.title} className="mt-5 px-3">
                <div className="mb-1 px-2 text-[11px] font-medium text-faint">{g.title}</div>
                <ul className="grid grid-cols-1 gap-0.5 min-[420px]:grid-cols-2">
                  {g.items.map((it) => {
                    const Icon = it.icon
                    const on = active === it.key
                    return (
                      <li key={it.key}>
                        <button type="button" onClick={() => onGo(it.key)} className={`flex h-11 w-full items-center gap-3 rounded-lg px-2 text-sm ${on ? 'bg-brand-50 font-semibold text-brand-600' : 'text-body'}`}>
                          <Icon className="h-[18px] w-[18px] shrink-0 text-muted" />
                          <span className="truncate">{it.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

            <div className="mx-5 mt-5 space-y-0.5 border-t border-line pt-3">
              <button type="button" onClick={onTheme} className="flex h-11 w-full items-center gap-3 text-sm text-body">
                {theme === 'dark' ? <Sun className="h-[18px] w-[18px] text-muted" /> : <Moon className="h-[18px] w-[18px] text-muted" />}
                <span className="flex-1 text-left">Dark mode</span>
                <span className={`relative h-6 w-10 rounded-full transition-colors duration-150 ease-out ${theme === 'dark' ? 'bg-brand' : 'bg-line-strong'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ease-out ${theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </span>
              </button>
              <div className="-mx-2.5">
                <InstallItem onDone={onClose} />
              </div>
              <button type="button" onClick={onSignOut} className="flex h-11 w-full items-center gap-3 text-sm font-medium text-bad">
                <LogOut className="h-[18px] w-[18px]" /> Sign out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function NoRole({ email, onSignOut }: { email: string; onSignOut?: () => void }) {
  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-warn-bg text-warn">
          <ShieldOff className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold">No staff role yet</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          You're signed in as <span className="break-all font-medium text-ink">{email}</span>, but this account has no MELA staff role, so there's no data to show. Ask a MELA admin to add you on the Staff access page.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <a href="mailto:mela@chii.alu.edu" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover">
            Email the MELA team
          </a>
          <button type="button" onClick={onSignOut} className="inline-flex h-10 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-canvas">
            Use another account
          </button>
        </div>
      </div>
    </div>
  )
}

export function Avatar({ initials }: { initials: string }) {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-semibold text-white">{initials}</span>
}

function IconButton({ label, children, className = '', onClick }: { label: string; children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink ${className}`}
    >
      {children}
    </button>
  )
}

function navFor(role: Role, portal: Portal): NavGroup[] {
  if (role === 'none') return []
  if (role === 'reviewer') {
    return [
      {
        title: 'Review',
        items: [
          { key: 'overview', label: 'Review queue', short: 'Queue', icon: LayoutGrid },
          { key: 'applications', label: 'Applications', short: 'Apps', icon: ClipboardCheck, count: 23 },
        ],
      },
    ]
  }
  return [
    {
      title: 'Workspace',
      items: [
        { key: 'overview', label: 'Overview', icon: LayoutGrid },
        { key: 'analytics', label: 'Analytics', icon: BarChart3 },
        { key: 'interventions', label: 'Interventions', short: 'Sessions', icon: Layers },
        { key: 'participants', label: 'CHII Participants', short: 'People', icon: Users },
        { key: 'feedback', label: 'CHII Feedbacks', short: 'Feedback', icon: MessageSquareText },
        ...(role === 'admin' ? [{ key: 'chii-db', label: 'CHII database', icon: Database }] : []),
      ],
    },
    {
      title: portal === 'admin' ? 'Consolidated databases' : `${portalMeta[portal].label} database`,
      items: [
        { key: 'db-participants', label: 'Participants sheet', icon: Table2 },
        { key: 'db-feedback', label: 'Feedback sheet', icon: Sheet },
      ],
    },
    {
      title: 'Tools',
      items: [
        { key: 'import', label: 'Import a sheet', icon: Upload },
        ...(role === 'admin'
          ? [
              { key: 'staff', label: 'Staff access', icon: ShieldCheck },
              { key: 'data', label: 'Data & exports', icon: Download },
            ]
          : []),
      ],
    },
  ]
}

function bottomFor(role: Role): NavItem[] {
  const all = navFor(role, 'admin').flatMap((g) => g.items)
  const keys = role === 'reviewer' ? ['overview', 'applications'] : ['overview', 'interventions', 'participants', 'analytics']
  return keys.map((k) => all.find((i) => i.key === k)!).filter(Boolean)
}
