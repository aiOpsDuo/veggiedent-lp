import type { ReactNode } from 'react'

/**
 * Barra de ação fixa no rodapé da viewport (T35, item 8): `position: fixed`,
 * não `absolute` — a diferença é o que faz a barra acompanhar o scroll em vez
 * de ficar presa ao fim do conteúdo. Feita para "Salvar e publicar" e para
 * qualquer ação primária futura equivalente: um componente reutilizável, não
 * uma solução só para a tela de seção.
 *
 * Quem usa esta barra deve reservar espaço no fim do próprio conteúdo (ex.:
 * `pb-24` no contêiner rolável) para que ela nunca cubra a última linha ao
 * rolar até o fim.
 */
interface ActionBarProps {
  readonly children: ReactNode
}

export function ActionBar({ children }: ActionBarProps): JSX.Element {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_-6px_rgba(15,23,42,0.25)] backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-slate-700 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/85 md:px-8">
      <div className="mx-auto flex max-w-5xl items-center gap-3">{children}</div>
    </div>
  )
}
