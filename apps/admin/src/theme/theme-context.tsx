import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Tema claro/escuro do painel (T35, item 4): `darkMode: 'class'` do Tailwind,
 * sem biblioteca nova. A escolha do operador é lembrada (armazenamento
 * local); sem escolha prévia, o padrão é a preferência do sistema
 * operacional — nunca claro à força para quem já usa o sistema no escuro.
 *
 * A classe `dark` é aplicada na raiz do documento: é o gancho que o Tailwind
 * usa para decidir qual variante `dark:` renderizar em qualquer componente da
 * árvore, sem que cada tela precise ler o tema por conta própria.
 */

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'veggiedent-admin-tema'

interface ThemeContextValue {
  readonly theme: Theme
  readonly toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function prefersDarkSystemTheme(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function initialTheme(): Theme {
  return readStoredTheme() ?? (prefersDarkSystemTheme() ? 'dark' : 'light')
}

export function ThemeProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Armazenamento indisponível — o tema escolhido vale só para esta sessão.
    }
  }, [theme])

  function toggleTheme(): void {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme só pode ser usado dentro de ThemeProvider.')
  }
  return context
}
