import { LexicalComposer, type InitialConfigType } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { useMemo } from 'react'
import { carregarHtmlNoEditor, extrairHtmlDoEditor } from './rich-text-html'
import { RichTextToolbar } from './RichTextToolbar'

/**
 * O controle de um campo `texto-rico`: um editor Lexical com negrito e quebra
 * de linha, que guarda HTML.
 *
 * O operador não vê HTML em momento nenhum — ele digita o texto e marca o
 * trecho que quer destacar. A tradução para HTML, e a sanitização dele, ficam
 * em `rich-text-html.ts`.
 */

const MOLDURA = 'overflow-hidden rounded border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'

const MOLDURA_INVALIDA =
  'overflow-hidden rounded border border-red-500 bg-white dark:bg-slate-800'

const AREA_DE_TEXTO =
  'min-h-[3rem] px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:text-slate-100'

export interface RichTextInputProps {
  readonly id: string
  readonly describedBy: string | undefined
  readonly invalid: boolean
  readonly required: boolean
  readonly label: string
  readonly value: unknown
  readonly onChange: (value: string) => void
}

export function RichTextInput({
  id,
  describedBy,
  invalid,
  required,
  label,
  value,
  onChange,
}: RichTextInputProps): JSX.Element {
  /**
   * O conteúdo entra no editor **uma vez**, na montagem: dali em diante quem
   * guarda o texto é o editor, como em qualquer campo não controlado. Recarregar
   * a cada tecla digitada desfaria a posição do cursor a cada letra.
   */
  const configuracaoInicial = useMemo<InitialConfigType>(
    () => ({
      namespace: 'campo-texto-rico',
      theme: { text: { bold: 'font-bold', italic: 'italic' } },
      onError: (erro: Error) => {
        throw erro
      },
      editorState: (editor) => carregarHtmlNoEditor(editor, value),
    }),
    [],
  )

  return (
    <LexicalComposer initialConfig={configuracaoInicial}>
      <div className={invalid ? MOLDURA_INVALIDA : MOLDURA}>
        <RichTextToolbar />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              id={id}
              className={AREA_DE_TEXTO}
              aria-label={label}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              aria-required={required || undefined}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(editorState, editor) =>
            onChange(editorState.read(() => extrairHtmlDoEditor(editor)))
          }
        />
      </div>
    </LexicalComposer>
  )
}
