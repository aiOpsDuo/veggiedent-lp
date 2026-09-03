import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'

/**
 * O esqueleto autenticado: cabeçalho com quem está logado e a ação de sair, e
 * a área onde as telas de conteúdo, mídia e leads (T11–T13) vão entrar.
 *
 * Só é montado por dentro da guarda — em nenhum caminho do roteador ele aparece
 * sem sessão confirmada.
 */
export function AdminLayout(): JSX.Element {
  const { state, signOut } = useAuth()
  const operatorEmail = state.status === 'ativa' ? state.session.operatorEmail : ''

  return (
    <div data-testid="area-administrativa" className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-semibold text-slate-900">Painel Veggiedent</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{operatorEmail}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
