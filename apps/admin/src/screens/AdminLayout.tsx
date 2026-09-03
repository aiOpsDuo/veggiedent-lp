import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { SECTIONS_PATH } from '../routing/paths'

/**
 * O esqueleto autenticado: cabeçalho com quem está logado, o caminho para as
 * seções e a ação de sair.
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
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-900">Painel Veggiedent</span>
            <nav aria-label="Áreas do painel">
              <Link to={SECTIONS_PATH} className="text-sm text-slate-700 hover:underline">
                Seções da página
              </Link>
            </nav>
          </div>
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
