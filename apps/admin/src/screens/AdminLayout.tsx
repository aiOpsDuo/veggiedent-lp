import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { VEGGIEDENT_LOGO_URL } from '@veggiedent/design-tokens'
import {
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Inbox,
  Menu,
  Moon,
  Sun,
  Tags,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { AdminAccessCheck, AdminApiClient } from '../api/admin-api-client'
import { useAuth } from '../auth/auth-context'
import { HOME_PATH, LEADS_PATH, METADATA_PATH, OPERATORS_PATH, SECTIONS_PATH } from '../routing/paths'
import { usePersistedBoolean } from '../shared/use-persisted-boolean'
import { useTheme } from '../theme/theme-context'

/** As áreas do painel, na ordem em que o operador costuma percorrê-las. */
const AREAS: readonly { readonly path: string; readonly label: string; readonly icon: LucideIcon }[] = [
  { path: SECTIONS_PATH, label: 'Seções da página', icon: FileText },
  { path: METADATA_PATH, label: 'Metadados da página', icon: Tags },
  { path: LEADS_PATH, label: 'Leads recebidos', icon: Inbox },
  { path: OPERATORS_PATH, label: 'Operadores', icon: Users },
]

/** Chave de armazenamento local do estado do menu — recolhido ou aberto (T35, item 3). */
const SIDEBAR_COLLAPSED_KEY = 'veggiedent-admin-menu-recolhido'

/**
 * O aviso da checagem de acesso, em linguagem de operador — sem "API" nem
 * "CMS" (T30-c). Não há mensagem para `autorizado`: o caminho feliz não
 * precisa de aviso nenhum, só o que exige atenção aparece na tela.
 */
const ACCESS_WARNING_BY_CHECK: Partial<Record<AdminAccessCheck, string>> = {
  indisponivel:
    'Não foi possível confirmar seu acesso agora. Salvar uma edição pode falhar até a conexão voltar.',
}

const LINK_CLASS_BASE =
  'flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors duration-150'
const LINK_CLASS_ACTIVE = 'bg-brand-primary text-white'
const LINK_CLASS_INACTIVE =
  'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'

function navLinkClassName({ isActive }: { readonly isActive: boolean }): string {
  return `${LINK_CLASS_BASE} ${isActive ? LINK_CLASS_ACTIVE : LINK_CLASS_INACTIVE}`
}

interface NavListProps {
  /** Fecha a gaveta do menu, em telas pequenas, ao escolher uma área. */
  readonly onNavigate?: () => void
  /** Some com o rótulo visível (T35, item 3) — o nome do campo continua acessível via `sr-only`. */
  readonly collapsed?: boolean
}

/**
 * A lista de áreas, compartilhada entre a barra lateral fixa (telas largas) e
 * a gaveta (telas pequenas) — a mesma navegação, dois lugares de mostrar.
 *
 * `NavLink` marca sozinho a área ativa com `aria-current="page"`: é o que dá
 * ao operador a indicação de onde ele está, sem o painel duplicar essa lógica.
 *
 * Cada área tem um ícone (T35, item 5) que nunca é a única forma de
 * identificá-la: o rótulo continua no DOM mesmo com o menu recolhido, só
 * visualmente escondido (`sr-only`) — um ícone mudo não seria anunciado por
 * leitor de tela.
 */
function NavList({ onNavigate, collapsed = false }: NavListProps): JSX.Element {
  return (
    <nav aria-label="Áreas do painel" className="flex flex-col gap-1">
      {AREAS.map((area) => {
        const Icon = area.icon
        return (
          <NavLink
            key={area.path}
            to={area.path}
            onClick={onNavigate}
            title={collapsed ? area.label : undefined}
            className={navLinkClassName}
          >
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className={collapsed ? 'sr-only' : ''}>{area.label}</span>
          </NavLink>
        )
      })}
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
 * O menu é uma barra fixa à esquerda em telas largas — recolhível, com o
 * estado lembrado entre sessões (T35, item 3) — e uma gaveta acionada por um
 * botão em telas pequenas (o painel "precisa ser utilizável" nelas, PRD). A
 * mesma lista de áreas nos dois casos, nunca duas fontes da navegação. O
 * cabeçalho (quem está logado, tema, sair) é um só, sempre visível.
 */
export function AdminLayout({ apiClient }: AdminLayoutProps): JSX.Element {
  const { state, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const operatorEmail = state.status === 'ativa' ? state.session.operatorEmail : ''
  const accessToken = state.status === 'ativa' ? state.session.accessToken : null
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = usePersistedBoolean(SIDEBAR_COLLAPSED_KEY, false)
  const accessWarning = useAccessWarning(apiClient, accessToken, signOut)

  return (
    <div
      data-testid="area-administrativa"
      className="flex min-h-screen bg-slate-50 dark:bg-slate-950"
    >
      <aside
        aria-label="Menu do painel"
        className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white p-4 transition-[width] duration-150 dark:border-slate-800 dark:bg-slate-900 md:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <Link
          to={HOME_PATH}
          aria-label="Ir para o painel"
          className="mb-6 flex items-center px-1"
        >
          <img src={VEGGIEDENT_LOGO_URL} alt="Veggiedent" className="h-8 w-auto" />
        </Link>
        <div className="flex-1">
          <NavList collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir o menu' : 'Recolher o menu'}
          title={collapsed ? 'Expandir o menu' : 'Recolher o menu'}
          className="mt-4 flex items-center justify-center rounded border border-slate-200 py-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {collapsed ? (
            <ChevronsRight aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ChevronsLeft aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-slate-900/50"
          />
          <div className="relative flex h-full w-64 flex-col bg-white p-4 shadow-lg dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between">
              <img src={VEGGIEDENT_LOGO_URL} alt="Veggiedent" className="h-8 w-auto" />
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMenuOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <NavList onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              className="rounded border border-slate-300 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
            <img src={VEGGIEDENT_LOGO_URL} alt="Veggiedent" className="h-6 w-auto md:hidden" />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              className="rounded border border-slate-300 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? (
                <Sun aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Moon aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
            <span className="hidden truncate text-sm text-slate-600 dark:text-slate-400 sm:inline">
              {operatorEmail}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Sair
            </button>
          </div>
        </header>

        {accessWarning !== null && (
          <p
            role="alert"
            className="bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200 md:px-8"
          >
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
