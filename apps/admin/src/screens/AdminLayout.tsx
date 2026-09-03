import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { LEADS_PATH, METADATA_PATH, SECTIONS_PATH } from '../routing/paths'

/** As áreas do painel, na ordem em que o operador costuma percorrê-las. */
const AREAS: readonly { readonly path: string; readonly label: string }[] = [
  { path: SECTIONS_PATH, label: 'Seções da página' },
  { path: METADATA_PATH, label: 'Metadados da página' },
  { path: LEADS_PATH, label: 'Leads recebidos' },
]

/**
 * O esqueleto autenticado: cabeçalho com quem está logado, os caminhos para as
 * áreas do painel e a ação de sair.
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
            <nav aria-label="Áreas do painel" className="flex flex-wrap gap-4">
              {AREAS.map((area) => (
                <Link
                  key={area.path}
                  to={area.path}
                  className="text-sm text-slate-700 hover:underline"
                >
                  {area.label}
                </Link>
              ))}
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
