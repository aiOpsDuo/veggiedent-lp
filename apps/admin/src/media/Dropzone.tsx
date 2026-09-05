import { ImageUp, LoaderCircle, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * As peças visuais do campo de imagem em estilo de soltar/enviar (T36, item
 * 2): o retângulo tracejado, o ícone de envio quando vazio, a animação de
 * carregamento e o botão de excluir. Vivem à parte de `MediaField.tsx` para
 * que a variante de múltiplas imagens (T36, item 3) as reaproveite sem
 * duplicar a mesma casca visual em dois arquivos (regra G5, DRY) — só o tipo
 * `imagem` usa este estilo; vídeo continua com o seletor de arquivo
 * tradicional, que não ganha nada em virar dropzone (não há como "arrastar e
 * ver" um vídeo do mesmo jeito que uma imagem, e o campo já mostra progresso e
 * prévia com controles de reprodução).
 *
 * Nenhuma peça aqui sabe o que é "campo único" ou "múltiplas imagens" — isso é
 * assunto de quem monta a peça (`MediaField` e `MultiImageMediaField`), não
 * dela.
 */

const SHELL_BASE_CLASS =
  'relative flex w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors dark:border-slate-600 dark:bg-slate-800'

const SHELL_INTERACTIVE_CLASS =
  'cursor-pointer hover:border-slate-400 hover:bg-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-700/60'

const SHELL_DISABLED_CLASS = 'cursor-not-allowed opacity-60'

/** O anel de foco do teclado, ligado ao `<input>` oculto por `peer` (Tailwind). */
const SHELL_FOCUS_CLASS =
  'peer-focus-visible:ring-2 peer-focus-visible:ring-slate-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-slate-400'

interface DropzoneShellProps {
  readonly children: ReactNode
  readonly interactive: boolean
  /** Classe de tamanho/proporção — cada chamador decide a própria forma. */
  readonly className: string
}

/**
 * O retângulo tracejado em si. Não é `<label>` por padrão: quem o usa decide
 * se ele envolve um `<input type="file">` (dropzone clicável) ou só exibe
 * conteúdo (ex.: enquanto o envio está em andamento, sem input dentro).
 */
export function DropzoneShell({ children, interactive, className }: DropzoneShellProps): JSX.Element {
  const stateClass = interactive ? SHELL_INTERACTIVE_CLASS : SHELL_DISABLED_CLASS
  return (
    <div className={`${SHELL_BASE_CLASS} ${SHELL_FOCUS_CLASS} ${stateClass} ${className}`}>
      {children}
    </div>
  )
}

/** O ícone de upload centralizado, exibido quando o campo está vazio. */
export function DropzoneEmptyIcon({ label }: { readonly label: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 px-4 text-center text-slate-400 dark:text-slate-500">
      <ImageUp className="h-9 w-9" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

/**
 * A animação de carregamento dentro do próprio campo (T36, item 2) — troca a
 * barra de progresso que existia antes por um spinner e o texto de
 * porcentagem, os dois dentro da área do dropzone. `role="status"` é o que
 * chega a quem usa leitor de tela: a barra visual não anuncia nada sozinha.
 */
export function DropzoneUploading({ percent }: { readonly percent: number }): JSX.Element {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400"
    >
      <LoaderCircle className="h-8 w-8 animate-spin" aria-hidden="true" />
      <span className="text-sm">{`Enviando… ${percent}%`}</span>
    </div>
  )
}

const DELETE_BUTTON_CLASS =
  'absolute bottom-2 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-red-100/90 text-red-700 shadow-md transition-colors hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:bg-red-950/80 dark:text-red-300 dark:hover:bg-red-600 dark:hover:text-white'

/**
 * Só ícone, sem texto visível — o rótulo continua existindo como
 * `aria-label`, então o nome acessível do botão não muda (T36, item 2): fundo
 * levemente avermelhado em repouso, vermelho cheio em destaque/hover, canto
 * inferior direito, grande o bastante (40px) para ser clicado sem exigir
 * precisão. Nunca fica dentro do `<label>` do dropzone — ver `MediaField.tsx`
 * — para que clicar nele não abra o seletor de arquivo por engano.
 */
export function DeleteImageButton({
  label,
  onClick,
}: {
  readonly label: string
  readonly onClick: () => void
}): JSX.Element {
  return (
    <button type="button" aria-label={label} className={DELETE_BUTTON_CLASS} onClick={onClick}>
      <Trash2 className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
