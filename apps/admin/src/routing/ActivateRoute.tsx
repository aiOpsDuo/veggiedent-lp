import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import type { ActivationTokens } from '../auth/auth-gateway'
import { ActivateScreen } from '../screens/ActivateScreen'
import { SessionCheck } from '../screens/SessionCheck'

const INVALID_LINK_MESSAGE =
  'Este link de ativação é inválido ou já expirou. Peça a quem administra o painel para gerar um novo convite.'

/**
 * Lê os tokens do fragmento da URL (`#access_token=...&refresh_token=...`),
 * como o link de convite os entrega (SDD § D-09). Um link expirado ou já
 * trocado volta do Supabase com `#error=...` em vez dos tokens — ambos os
 * casos caem em "ausente", e a tela trata os dois com a mesma mensagem, sem
 * distinguir motivo.
 */
function readActivationTokens(hash: string): ActivationTokens | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (
    accessToken === null ||
    accessToken.length === 0 ||
    refreshToken === null ||
    refreshToken.length === 0
  ) {
    return null
  }
  return { accessToken, refreshToken }
}

type ActivationState = 'ativando' | 'invalido' | 'pronta'

/**
 * A rota do link de convite (SDD § D-09, § C-13): pública, porque quem chega
 * aqui ainda não tem sessão — é justamente o que esta tela lhe dá.
 *
 * Fica fora da guarda global de propósito, ao lado da rota de login — a
 * mesma razão pela qual `RequireSession` existe também é o motivo de esta
 * rota não poder estar dentro dela.
 */
export function ActivateRoute(): JSX.Element {
  const { activate } = useAuth()
  const [state, setState] = useState<ActivationState>('ativando')

  useEffect(() => {
    const tokens = readActivationTokens(window.location.hash)
    if (tokens === null) {
      setState('invalido')
      return
    }
    let current = true
    void activate(tokens).then((result) => {
      // Os tokens são de uso único: tirá-los da URL evita reenviá-los a um
      // recarregamento ou deixá-los na história do navegador.
      window.history.replaceState(null, '', window.location.pathname)
      if (!current) {
        return
      }
      setState(result.ok ? 'pronta' : 'invalido')
    })
    return () => {
      current = false
    }
  }, [activate])

  if (state === 'ativando') {
    return <SessionCheck />
  }

  if (state === 'invalido') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm space-y-2 rounded-lg bg-white p-8 text-center shadow">
          <h1 className="text-xl font-semibold text-slate-900">Link de ativação</h1>
          <p role="alert" className="text-sm text-red-700">
            {INVALID_LINK_MESSAGE}
          </p>
        </div>
      </main>
    )
  }

  return <ActivateScreen />
}
