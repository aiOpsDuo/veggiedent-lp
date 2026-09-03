import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AdminApiClient, AdminAccessCheck } from '../api/admin-api-client'
import { useAuth } from '../auth/auth-context'
import { SECTIONS_PATH } from '../routing/paths'

const MESSAGE_BY_CHECK: Readonly<Record<AdminAccessCheck, string>> = {
  autorizado: 'A API do CMS aceitou a sua sessão.',
  'nao-autorizado': 'A API recusou a sua sessão. Entre novamente.',
  indisponivel: 'A API do CMS não respondeu. As telas de edição ficarão indisponíveis.',
}

interface HomeScreenProps {
  readonly apiClient: AdminApiClient
}

/**
 * A área do painel onde as telas das próximas tarefas entram.
 *
 * Hoje ela responde a uma única pergunta, que é a que fecha o ciclo desta
 * tarefa: a API do CMS aceita o token que o Supabase acabou de emitir? Sem essa
 * resposta o operador só descobriria que a sessão não vale ao tentar salvar
 * alguma coisa. Nenhum conteúdo é lido daqui — a resposta da API é descartada.
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
      <p className="text-slate-700">
        <Link to={SECTIONS_PATH} className="underline">
          Editar as seções da página
        </Link>
        . As telas de mídia e de leads entram aqui nas próximas etapas.
      </p>
      <p role="status" className="text-sm text-slate-500">
        {check === null ? 'Conferindo o acesso à API…' : MESSAGE_BY_CHECK[check]}
      </p>
    </section>
  )
}
