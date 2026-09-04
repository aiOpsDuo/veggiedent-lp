import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { createRichTextSanitizer } from '@veggiedent/content-schema'
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical'

/**
 * A ida e a volta entre o HTML guardado no CMS e o estado do editor.
 *
 * Os dois sentidos passam pelo **mesmo** sanitizador da política única
 * (`@veggiedent/content-schema`): na entrada, porque o que veio do banco pode
 * ser mais antigo que a política ou ter sido gravado por outro caminho; na
 * saída, porque o Lexical exporta marcação de apresentação (`<p>`, `<span
 * style>`, `<b><strong>`) que não é conteúdo e não deve ser guardada.
 */

const sanitizar = createRichTextSanitizer(window)

/** Reconstrói o conteúdo do editor a partir do HTML guardado. */
export function carregarHtmlNoEditor(editor: LexicalEditor, html: unknown): void {
  const limpo = sanitizar(html)
  const paragrafo = $createParagraphNode()

  if (limpo !== '') {
    const documento = new DOMParser().parseFromString(limpo, 'text/html')
    paragrafo.append(...$generateNodesFromDOM(editor, documento))
  }

  $getRoot().append(paragrafo)
}

/**
 * O HTML que o campo grava. Precisa rodar dentro de uma leitura do estado do
 * editor (`editorState.read`), que é de onde `$generateHtmlFromNodes` lê.
 */
export function extrairHtmlDoEditor(editor: LexicalEditor): string {
  return sanitizar($generateHtmlFromNodes(editor, null))
}
