/**
 * Texto rico: o pouco de HTML que um campo de conteúdo pode guardar, e a
 * política única que decide o que sobrevive.
 *
 * Um campo `texto-rico` guarda HTML escrito por um operador no painel. HTML de
 * origem externa renderizado na página pública é caminho de injeção de script,
 * então a regra é uma lista de permissão fechada: **negrito, itálico e quebra
 * de linha**, sem nenhum atributo. Tudo o mais — tag desconhecida, `<script>`,
 * `onerror=`, `javascript:` em `href` — é removido.
 *
 * A política mora aqui, e não em cada consumidor, porque divergência entre a
 * lista da escrita e a da leitura é o defeito que faria a sanitização parecer
 * ativa e não ser. A LP, o painel e a API constroem o sanitizador com a mesma
 * função; só a janela muda (o navegador tem a sua, a API monta uma com jsdom).
 */
import DOMPurify, { type Config, type WindowLike } from 'dompurify'

/** As marcações que fazem sentido num título e sobrevivem à sanitização. */
export const RICH_TEXT_ALLOWED_TAGS = ['strong', 'b', 'em', 'i', 'br'] as const

/**
 * Como cada marcação permitida é guardada depois de normalizada. `b` e `i` são
 * aceitos na entrada porque editores os produzem (o Lexical exporta
 * `<b><strong>`), mas o que fica gravado é sempre a forma canônica — a LP então
 * conhece três tags, não cinco, e o mesmo destaque nunca aparece aninhado.
 */
const CANONICAL_TAG_BY_TAG: Readonly<Record<string, 'strong' | 'em' | 'br'>> = {
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  br: 'br',
}

/** Nenhum atributo é permitido: sem atributo não há `on*` nem `javascript:`. */
export const RICH_TEXT_ALLOWED_ATTRIBUTES: readonly string[] = []

export type RichTextSanitizer = (html: unknown) => string

const TEXT_NODE = 3
const ELEMENT_NODE = 1

const PURIFY_CONFIG: Config & { RETURN_DOM_FRAGMENT: true } = {
  ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
  ALLOWED_ATTR: [...RICH_TEXT_ALLOWED_ATTRIBUTES],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  /**
   * O conteúdo de uma tag proibida **permanece** como texto — remover a tag
   * `<span>` de um editor não pode apagar a palavra que ela envolvia. A exceção
   * é `<script>`/`<style>`, cujo conteúdo o próprio DOMPurify descarta junto.
   */
  KEEP_CONTENT: true,
  RETURN_DOM_FRAGMENT: true,
}

function isEmphasisTag(tag: 'strong' | 'em' | 'br'): tag is 'strong' | 'em' {
  return tag !== 'br'
}

/**
 * Reconstrói o conteúdo já sanitizado usando só as tags canônicas, sem repetir
 * um destaque dentro dele mesmo.
 */
function appendNormalized(
  source: Node,
  target: Element,
  document: Document,
  open: ReadonlySet<string>,
): void {
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      target.appendChild(document.createTextNode(child.textContent ?? ''))
      continue
    }
    if (child.nodeType !== ELEMENT_NODE) continue

    const tag = CANONICAL_TAG_BY_TAG[(child as Element).tagName.toLowerCase()]
    if (tag === undefined) {
      // Não deveria acontecer depois do DOMPurify; se acontecer, o texto fica e
      // a marcação some, que é o lado seguro do erro.
      appendNormalized(child, target, document, open)
      continue
    }
    if (!isEmphasisTag(tag)) {
      target.appendChild(document.createElement(tag))
      continue
    }
    if (open.has(tag)) {
      appendNormalized(child, target, document, open)
      continue
    }

    const element = document.createElement(tag)
    target.appendChild(element)
    appendNormalized(child, element, document, new Set([...open, tag]))
  }
}

/**
 * Constrói o sanitizador de texto rico para uma janela DOM.
 *
 * @param window `window` no navegador; uma janela do jsdom na API.
 */
export function createRichTextSanitizer(window: WindowLike): RichTextSanitizer {
  const purify = DOMPurify(window)

  if (!purify.isSupported) {
    // Sem isto, um ambiente sem DOM devolveria o HTML **intacto**, e a
    // sanitização falharia em silêncio — exatamente o modo de falha perigoso.
    throw new Error('Sanitização de texto rico indisponível: a janela informada não tem DOM.')
  }

  return (html: unknown): string => {
    if (typeof html !== 'string' || html === '') return ''

    const fragment = purify.sanitize(html, PURIFY_CONFIG)
    const document = fragment.ownerDocument
    const container = document.createElement('div')
    appendNormalized(fragment, container, document, new Set())
    return container.innerHTML
  }
}

/**
 * Se o campo está vazio para quem lê a página: só marcação, sem texto.
 *
 * **Não é uma função de segurança** — é a medida de "preenchido" que a
 * obrigatoriedade do campo usa. A remoção de tags aqui serve para contar
 * caracteres visíveis, nunca para tornar HTML seguro; isso é papel do
 * sanitizador acima.
 */
export function isBlankRichText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}
