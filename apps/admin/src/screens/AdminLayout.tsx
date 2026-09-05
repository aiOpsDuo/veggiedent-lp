import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { AdminAccessCheck, AdminApiClient } from '../api/admin-api-client'
import { useAuth } from '../auth/auth-context'
import { LEADS_PATH, METADATA_PATH, OPERATORS_PATH, SECTIONS_PATH } from '../routing/paths'

/** As áreas do painel, na ordem em que o operador costuma percorrê-las. */
const AREAS: readonly { readonly path: string; readonly label: string }[] = [
  { path: SECTIONS_PATH, label: 'Seções da página' },
  { path: METADATA_PATH, label: 'Metadados da página' },
  { path: LEADS_PATH, label: 'Leads recebidos' },
  { path: OPERATORS_PATH, label: 'Operadores' },
]

/**
 * O aviso da checagem de acesso, em linguagem de operador — sem "API" nem
 * "CMS" (T30-c). Não há mensagem para `autorizado`: o caminho feliz não
 * precisa de aviso nenhum, só o que exige atenção aparece na tela.
 */
const ACCESS_WARNING_BY_CHECK: Partial<Record<AdminAccessCheck, string>> = {
  indisponivel:
    'Não foi possível confirmar seu acesso agora. Salvar uma edição pode falhar até a conexão voltar.',
}

const LINK_CLASS_BASE = 'block rounded px-3 py-2 text-sm font-medium transition-colors'
const LINK_CLASS_ACTIVE = 'bg-slate-900 text-white'
const LINK_CLASS_INACTIVE = 'text-slate-700 hover:bg-slate-100'

function navLinkClassName({ isActive }: { readonly isActive: boolean }): string {
  return `${LINK_CLASS_BASE} ${isActive ? LINK_CLASS_ACTIVE : LINK_CLASS_INACTIVE}`
}

interface NavListProps {
  /** Fecha a gaveta do menu, em telas pequenas, ao escolher uma área. */
  readonly onNavigate?: () => void
}

/**
 * A lista de áreas, compartilhada entre a barra lateral fixa (telas largas) e
 * a gaveta (telas pequenas) — a mesma navegação, dois lugares de mostrar.
 *
 * `NavLink` marca sozinho a área ativa com `aria-current="page"`: é o que dá
 * ao operador a indicação de onde ele está, sem o painel duplicar essa lógica.
 */
function NavList({ onNavigate }: NavListProps): JSX.Element {
  return (
    <nav aria-label="Áreas do painel" className="flex flex-col gap-1">
      {AREAS.map((area) => (
        <NavLink key={area.path} to={area.path} onClick={onNavigate} className={navLinkClassName}>
          {area.label}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * Pergunta à API se ela aceita a sessão atual, sem expor "API"/"CMS" ao
 * operador (T30-c) — a checagem que antes vivia numa tela própria ("Início")
 * agora é um efeito colateral discreto do próprio layout: sessão que a API
 * recusa é encerrada em silêncio (a guarda de rota já leva ao login), e
 * indisponibilidade vira um aviso de uma linha, não uma tela inteira.
 */
function useAccessWarning(
  apiClient: AdminApiClient,
  accessToken: string | null,
  onUnauthorized: () => Promise<void>,
): string | null {
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    if (accessToken === null) {
      return
    }
    let current = true
    void apiClient.checkAccess(accessToken).then((result) => {
      if (!current) {
        return
      }
      if (result === 'nao-autorizado') {
        void onUnauthorized()
        return
      }
      setWarning(ACCESS_WARNING_BY_CHECK[result] ?? null)
    })
    return () => {
      current = false
    }
  }, [apiClient, accessToken, onUnauthorized])

  return warning
}

interface AdminLayoutProps {
  readonly apiClient: AdminApiClient
}

/**
 * O esqueleto autenticado: cabeçalho com quem está logado e a ação de sair, e
 * um menu com as áreas do painel.
 *
 * Só é montado por dentro da guarda — em nenhum caminho do roteador ele aparece
 * sem sessão confirmada.
 *
 * O menu é uma barra fixa à esquerda em telas largas (o painel "não é
 * mobile-first", PRD) e uma gaveta acionada por um botão em telas pequenas (o
 * painel "precisa ser utilizável" nelas) — a mesma lista de áreas nos dois
 * casos, nunca duas fontes da navegação. O cabeçalho (quem está logado, sair)
 * é um só, sempre visível, para não duplicar a mesma ação em dois lugares da
 * tela ao mesmo tempo.
 */
export function AdminLayout({ apiClient }: AdminLayoutProps): JSX.Element {
  const { state, signOut } = useAuth()
  const operatorEmail = state.status === 'ativa' ? state.session.operatorEmail : ''
  const accessToken = state.status === 'ativa' ? state.session.accessToken : null
  const [menuOpen, setMenuOpen] = useState(false)
  const accessWarning = useAccessWarning(apiClient, accessToken, signOut)

  return (
    <div data-testid="area-administrativa" className="flex min-h-screen bg-slate-50">
      <aside
        aria-label="Menu do painel"
        className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex"
      >
        <span className="mb-6 px-3 font-semibold text-slate-900">Painel Veggiedent</span>
        <NavList />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-slate-900/50"
          />
          <div className="relative flex h-full w-64 flex-col bg-white p-4 shadow-lg">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-semibold text-slate-900">Painel Veggiedent</span>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMenuOpen(false)}
                className="rounded px-2 py-1 text-lg text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <NavList onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 md:hidden"
            >
              Menu
            </button>
            <span className="font-semibold text-slate-900 md:hidden">Painel Veggiedent</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden truncate text-sm text-slate-600 sm:inline">
              {operatorEmail}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Sair
            </button>
          </div>
        </header>

        {accessWarning !== null && (
          <p role="alert" className="bg-amber-50 px-4 py-2 text-sm text-amber-900 md:px-8">
            {accessWarning}
          </p>
        )}

        <main className="flex-1 px-4 py-8 md:px-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
