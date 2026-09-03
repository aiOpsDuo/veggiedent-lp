import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AdminApiClient, AdminAccessCheck } from '../api/admin-api-client'
import { useAuth } from '../auth/auth-context'
import { LEADS_PATH, METADATA_PATH, SECTIONS_PATH } from '../routing/paths'

const MESSAGE_BY_CHECK: Readonly<Record<AdminAccessCheck, string>> = {
  autorizado: 'A API do CMS aceitou a sua sessão.',
  'nao-autorizado': 'A API recusou a sua sessão. Entre novamente.',
  indisponivel: 'A API do CMS não respondeu. As telas de edição ficarão indisponíveis.',
}

interface HomeScreenProps {
  readonly apiClient: AdminApiClient
}

/**
 * O início do painel: por onde se chega a cada área.
 *
 * Além dos caminhos para as áreas do painel, ela responde a uma pergunta que
 * nenhuma outra tela responde a tempo: a API do CMS aceita o token que o
 * Supabase acabou de emitir? Sem essa resposta o operador só descobriria que a
 * sessão não vale ao tentar salvar alguma coisa. Nenhum conteúdo é lido daqui —
 * a resposta da API é descartada.
 */
export function HomeScreen({ apiClient }: HomeScreenProps): JSX.Element {
  const { state, signOut } = useAuth()
  const accessToken = state.status === 'ativa' ? state.session.accessToken : null
  const [check, setCheck] = useState<AdminAccessCheck | null>(null)

  useEffect(() => {
    if (accessToken === null) {
      return
    }
    let current = true
    void apiClient.checkAccess(accessToken).then((result) => {
      if (!current) {
        return
      }
      setCheck(result)
      if (result === 'nao-autorizado') {
        void signOut()
      }
    })
    return () => {
      current = false
    }
  }, [apiClient, accessToken, signOut])

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Início</h1>
      <ul className="space-y-1 text-slate-700">
        <li>
          <Link to={SECTIONS_PATH} className="underline">
            Editar as seções da página
          </Link>
        </li>
        <li>
          <Link to={METADATA_PATH} className="underline">
            Editar os metadados da página
          </Link>
        </li>
        <li>
          <Link to={LEADS_PATH} className="underline">
            Consultar os leads recebidos
          </Link>
        </li>
      </ul>
      <p role="status" className="text-sm text-slate-500">
        {check === null ? 'Conferindo o acesso à API…' : MESSAGE_BY_CHECK[check]}
      </p>
    </section>
  )
}
