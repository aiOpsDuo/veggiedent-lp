import { AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Aviso do resultado de uma ação — sucesso ou falha — repetido, com o mesmo
 * papel ARIA e cor, em cada tela que salva ou exclui algo. Centralizar aqui
 * (T35, item 6) acrescenta o ícone que faz o sinal não depender só da cor
 * (contraste que quem não distingue vermelho de verde perde) e evita que as
 * cinco telas que mostravam este aviso divirjam sozinhas com o tempo.
 */
export type NoticeTone = 'sucesso' | 'falha'

interface NoticeProps {
  readonly tone: NoticeTone
  readonly message: string
}

const TONE_CLASS: Record<NoticeTone, string> = {
  sucesso: 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300',
  falha: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
}

export function Notice({ tone, message }: NoticeProps): JSX.Element {
  const Icon = tone === 'sucesso' ? CheckCircle2 : AlertCircle
  return (
    <p
      role={tone === 'falha' ? 'alert' : 'status'}
      className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${TONE_CLASS[tone]}`}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {message}
    </p>
  )
}
