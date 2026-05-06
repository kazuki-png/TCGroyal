'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react'

type Theme = 'light' | 'dark'

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

const THEME_CHANGE_EVENT = 'tcg-royal-theme-change'

function getThemeSnapshot(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem('theme')
    return stored === 'dark' || stored === 'light' ? stored : null
  } catch {
    return null
  }
}

function getPreferredTheme(): Theme {
  const stored = getStoredTheme()
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function subscribeThemeChange(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(
    subscribeThemeChange,
    getThemeSnapshot,
    () => 'light'
  )

  useEffect(() => {
    applyTheme(getPreferredTheme())
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = getThemeSnapshot() === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    try {
      localStorage.setItem('theme', next)
    } catch {}
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }, [])

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)
