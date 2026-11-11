import { useEffect, useState } from 'react'

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// The CHII dashboard's icons (served from /public), so the installed app matches the browser tab.
const ICON_512 = `${location.origin}/icon.png`
const APPLE_ICON = '/apple-icon.png'

export const manifest = {
  name: 'MELA Manager · CHII',
  short_name: 'MELA',
  description: 'Run CHII interventions and keep one record per person.',
  start_url: '/manage',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait-primary',
  background_color: '#f8f9fa',
  theme_color: '#102c5e',
  icons: [
    { src: ICON_512, sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
}

let deferred: PromptEvent | null = null
let ready = false
const listeners = new Set<() => void>()

/** Adds the manifest and app meta tags once, registers the service worker, and captures the install prompt. */
export function setupPwa() {
  if (ready || typeof document === 'undefined') return
  ready = true
  const head = document.head
  const add = (tag: string, attrs: Record<string, string>) => {
    if (head.querySelector(`${tag}[${Object.keys(attrs)[0]}="${Object.values(attrs)[0]}"]`)) return
    const el = document.createElement(tag)
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    head.appendChild(el)
  }
  add('link', { rel: 'manifest', href: `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}` })
  add('meta', { name: 'theme-color', content: '#102c5e' })
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' })
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' })
  add('meta', { name: 'apple-mobile-web-app-title', content: 'MELA' })
  add('link', { rel: 'apple-touch-icon', href: APPLE_ICON })

  // In the Next.js app, public/sw.js is served from the origin root.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    fetch('/sw.js', { method: 'HEAD' })
      .then((r) => (r.ok ? navigator.serviceWorker.register('/sw.js') : undefined))
      .catch(() => undefined)
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as PromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => {
    setupPwa()
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  return {
    canPrompt: !!deferred,
    installed: !!standalone,
    ios,
    install: async () => {
      if (!deferred) return false
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null
      force((n) => n + 1)
      return outcome === 'accepted'
    },
  }
}
