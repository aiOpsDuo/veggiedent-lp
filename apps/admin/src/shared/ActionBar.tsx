import type { ReactNode } from 'react'

/**
 * Barra de ação fixa no rodapé da viewport (T35, item 8): `position: fixed`,
 * não `absolute` — a diferença é o que faz a barra acompanhar o scroll em vez
 * de ficar presa ao fim do conteúdo. Feita para "Salvar e publicar" e para
 * qualquer ação primária futura equivalente: um componente reutilizável, não
 * uma solução só para a tela de seção.
 *
 * `start`/`end` (T36, item 1) — em vez de um único `children` — porque a barra
 * sempre separa duas intenções opostas: sair da tela (esquerda) e confirmar a
 * ação principal (direita). Nomear os dois lados explicitamente evita que a
 * ordem dos elementos, e não a prop, seja o que decide o layout. `start` é
 * opcional porque nem toda tela tem para onde voltar (ex. Metadados, que não é
 * uma sub-tela de nada) — nesse caso a barra mostra só `end`, alinhado à
 * direita.
 *
 * Quem usa esta barra deve reservar espaço no fim do próprio conteúdo (ex.:
 * `pb-24` no contêiner rolável) para que ela nunca cubra a última linha ao
 * rolar até o fim.
 */
interface ActionBarProps {
  readonly start?: ReactNode
  readonly end: ReactNode
}

export function ActionBar({ start, end }: ActionBarProps): JSX.Element {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_-6px_rgba(15,23,42,0.25)] backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-slate-700 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/85 md:px-8">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">{start}</div>
        <div className="flex items-center gap-3">{end}</div>
      </div>
    </div>
  )
}
