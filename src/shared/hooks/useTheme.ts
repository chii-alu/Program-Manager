import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'mela-theme'

function read(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme) || 'light'
  } catch {
    return 'light'
  }
}

/** Light/dark theme, shared across every screen through localStorage and the root class. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  useEffect(() => {
    const sync = (e: Event) => setTheme((e as CustomEvent<Theme>).detail)
    window.addEventListener('mela-theme', sync)
    return () => window.removeEventListener('mela-theme', sync)
  }, [])

  const set = useCallback((t: Theme) => {
    setTheme(t)
    window.dispatchEvent(new CustomEvent('mela-theme', { detail: t }))
  }, [])

  return { theme, setTheme: set, toggle: () => set(theme === 'dark' ? 'light' : 'dark') }
}
