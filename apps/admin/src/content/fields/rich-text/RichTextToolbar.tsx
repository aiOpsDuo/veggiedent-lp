import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  KEY_ENTER_COMMAND,
} from 'lexical'
import { useEffect, useState } from 'react'

/**
 * As duas únicas ações do campo de texto rico: **negrito** e **quebra de
 * linha**.
 *
 * A lista é curta de propósito. O que o operador marca em negrito é o que a
 * página exibe em destaque, e não existe controle de cor, tamanho ou fonte —
 * decisão de aparência é da página, não de quem escreve o texto.
 */

const BOTAO =
  'rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'

const BOTAO_ATIVO =
  'rounded border border-slate-500 bg-slate-200 px-2 py-1 text-sm text-slate-900 dark:border-slate-400 dark:bg-slate-600 dark:text-slate-100'

export function RichTextToolbar(): JSX.Element {
  const [editor] = useLexicalComposerContext()
  const [negritoAtivo, setNegritoAtivo] = useState(false)

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selecao = $getSelection()
          setNegritoAtivo($isRangeSelection(selecao) && selecao.hasFormat('bold'))
        })
      }),
    [editor],
  )

  /**
   * Enter faz **quebra de linha**, não parágrafo novo: o campo é um título, e
   * um título tem um parágrafo só. Sem isto, o segundo parágrafo sumiria na
   * sanitização e as duas linhas apareceriam grudadas na página.
   */
  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (evento) => {
          evento?.preventDefault()
          editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  )

  /** Clicar num botão não pode tirar o foco do texto, ou a seleção se perde. */
  const manterSelecao = (evento: { preventDefault: () => void }): void => evento.preventDefault()

  return (
    <div className="flex gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1">
      <button
        type="button"
        className={negritoAtivo ? BOTAO_ATIVO : BOTAO}
        aria-pressed={negritoAtivo}
        onMouseDown={manterSelecao}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      >
        <span className="font-bold">Negrito</span>
      </button>
      <button
        type="button"
        className={BOTAO}
        onMouseDown={manterSelecao}
        onClick={() => editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false)}
      >
        Quebra de linha
      </button>
    </div>
  )
}
