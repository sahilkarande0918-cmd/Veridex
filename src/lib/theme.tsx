import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }

const C = createContext<Ctx | null>(null)
const KEY = 'veridex-theme'

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY) as Theme | null
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* private mode */ }
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  }, [theme])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggle = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))

  return <C.Provider value={{ theme, setTheme, toggle }}>{children}</C.Provider>
}

export function useTheme() {
  const v = useContext(C)
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>')
  return v
}
