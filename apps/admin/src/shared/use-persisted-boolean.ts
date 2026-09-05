import { useState } from 'react'

/**
 * Um booleano lembrado entre sessões do navegador (armazenamento local) — ex.:
 * o menu lateral recolhido (T35, item 3). Falha de leitura ou escrita (modo
 * anônimo, armazenamento bloqueado) nunca quebra a tela: cai para o valor
 * padrão e a preferência simplesmente não persiste.
 */
export function usePersistedBoolean(
  key: string,
  defaultValue: boolean,
): readonly [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => readStoredBoolean(key, defaultValue))

  function update(next: boolean): void {
    setValue(next)
    try {
      window.localStorage.setItem(key, String(next))
    } catch {
      // Armazenamento indisponível — a escolha vale só para esta sessão.
    }
  }

  return [value, update]
}

function readStoredBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored === 'true') {
      return true
    }
    if (stored === 'false') {
      return false
    }
    return defaultValue
  } catch {
    return defaultValue
  }
}
