import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SECTION_KEYS, validateSectionDocument } from '@veggiedent/content-schema'
import { findRepositoryRoot, loadLandingPageContent } from './content-source'
import {
  COMMENTED_FAQ_ITEM,
  COMMENTED_FAQ_ITEM_POSITION,
  buildPageMetadata,
  buildSectionDocuments,
  unpublishedSections,
} from './section-documents'

/**
 * A tradução do conteúdo de hoje para os documentos do CMS (PLAN.md § T9).
 *
 * Estes testes são puros — nenhum banco, nenhuma rede. O que eles prendem é a
 * parte da migração em que uma decisão foi tomada: o que vira visibilidade, o
 * que é omitido por não ter valor real, e o que acontece com os blocos que hoje
 * estão comentados no código.
 */

const content = loadLandingPageContent()
const documents = buildSectionDocuments(content)

const PLACEHOLDER = /\[PLACEHOLDER/

interface ItemDeLista {
  readonly visivel: boolean
  readonly ordem: number
  readonly [campo: string]: unknown
}

function itensDe(secao: keyof typeof documents, lista: string): ItemDeLista[] {
  return documents[secao][lista] as ItemDeLista[]
}

describe('forma dos documentos gerados', () => {
  /**
   * Os documentos vão para a API pelo mesmo `PUT` que o painel usa, e ela valida
   * contra o esquema antes de gravar. Validar aqui também faz a suíte apontar o
   * campo errado em vez de deixar a migração falhar com um `422` no meio da
   * execução, com metade do conteúdo já gravado.
   *
   * A validação roda com uma referência de mídia de mentira no lugar do caminho
   * de arquivo: nesta etapa os campos de mídia ainda guardam caminhos, e a troca
   * por identificador é o passo seguinte (`media-registry.ts`).
   */
  it.each(SECTION_KEYS)('o documento de %s satisfaz o esquema da seção', (key) => {
    const resultado = validateSectionDocument(key, comMidiaFicticia(documents[key]))

    expect(resultado.valid ? {} : resultado.fields).toEqual({})
  })

  it('gera exatamente as 12 seções', () => {
    expect(Object.keys(documents).sort()).toEqual([...SECTION_KEYS].sort())
  })

  it('preserva a ordem dos itens na ordem do arquivo de conteúdo', () => {
    expect(itensDe('educacao', 'cards').map((card) => card.title)).toEqual(
      content.educacao.cards.map((card) => card.title),
    )
    expect(itensDe('educacao', 'cards').map((card) => card.ordem)).toEqual([0, 1, 2])
  })
})

describe('controles de publicação de hoje viram visibilidade', () => {
  it('Ingredientes nasce não publicada porque o conteúdo não está pronto', () => {
    expect(content.ingredientes.isContentReady).toBe(false)
    expect(unpublishedSections(content)).toEqual(['ingredientes'])
  })

  it('a seção não publicada leva junto o título já aprovado, em vez de nascer vazia', () => {
    expect(documents.ingredientes.heading).toBe(content.ingredientes.heading)
  })

  it('isReadyForProduction de cada pergunta vira a visibilidade do item', () => {
    const perguntasDoArquivo = itensDe('faq', 'items').filter(
      (item) => item.question !== COMMENTED_FAQ_ITEM.question,
    )

    expect(perguntasDoArquivo.map((item) => item.visivel)).toEqual(
      content.faq.items.map((item) => item.isReadyForProduction),
    )
  })

  it('a pergunta com espaço reservado entra não publicada, com o texto preservado', () => {
    const comPlaceholder = itensDe('faq', 'items').filter((item) =>
      PLACEHOLDER.test(String(item.answer)),
    )

    expect(comPlaceholder).toHaveLength(1)
    expect(comPlaceholder[0].visivel).toBe(false)
  })

  it('nenhum item visível carrega texto de espaço reservado', () => {
    const visiveisComPlaceholder = SECTION_KEYS.flatMap((key) =>
      Object.values(documents[key])
        .filter(Array.isArray)
        .flat()
        .filter(
          (item: ItemDeLista) =>
            item.visivel && Object.values(item).some((valor) => PLACEHOLDER.test(String(valor))),
        ),
    )

    expect(visiveisComPlaceholder).toEqual([])
  })
})

/**
 * O bloco comentado do FAQ (`Faq.content.ts`) é conteúdo pronto retirado da
 * página por comentário — exatamente o controle em código que a visibilidade do
 * CMS substitui. Ele entra preservado, na posição em que o autor o deixou, e
 * **não publicado**: publicá-lo volta a ser um clique no painel.
 *
 * O texto vive duas vezes: no arquivo de conteúdo, comentado, e em
 * `section-documents.ts`, como constante. Este teste confronta as duas cópias —
 * corrigir a vírgula de uma sem corrigir a outra reprova aqui.
 */
describe('a pergunta comentada do FAQ', () => {
  const arquivoFaq = readFileSync(
    resolve(findRepositoryRoot(), 'apps/lp/src/sections/Faq/Faq.content.ts'),
    'utf8',
  )

  const blocoComentado = arquivoFaq
    .split('\n')
    .filter((linha) => linha.trimStart().startsWith('//'))
    .join('\n')

  it('o texto da constante é o mesmo que está comentado no arquivo de conteúdo', () => {
    const semAspas = (texto: string): string => texto.replace(/["']/g, '')

    expect(semAspas(blocoComentado)).toContain(semAspas(COMMENTED_FAQ_ITEM.question))
    expect(semAspas(blocoComentado.replace(/\n\s*\/\/\s*/g, ' '))).toContain(
      semAspas(COMMENTED_FAQ_ITEM.answer),
    )
  })

  it('entra na posição em que o autor a deixou', () => {
    expect(itensDe('faq', 'items')[COMMENTED_FAQ_ITEM_POSITION].question).toBe(
      COMMENTED_FAQ_ITEM.question,
    )
  })

  it('entra não publicada', () => {
    expect(itensDe('faq', 'items')[COMMENTED_FAQ_ITEM_POSITION].visivel).toBe(false)
  })

  it('não desloca nenhuma pergunta que já está na página', () => {
    const publicadas = itensDe('faq', 'items')
      .filter((item) => item.visivel)
      .map((item) => item.question)

    expect(publicadas).toEqual(
      content.faq.items.filter((item) => item.isReadyForProduction).map((item) => item.question),
    )
  })
})

/**
 * O parceiro comentado de `OndeComprar.content.ts` é o caso oposto ao do FAQ, e
 * por isso fica de fora: ele não é conteúdo retirado da página, é uma **versão
 * anterior** de um parceiro que já está publicado. "Tudo de Bicho" aparece duas
 * vezes no arquivo — comentada com o logo positivo e `link: "#"`, e ativa com o
 * logo negativo e o endereço real da busca. Migrar as duas criaria um parceiro
 * repetido no painel, e o `#` é justamente um espaço reservado, que o C-08
 * proíbe entregar ao visitante.
 */
describe('o parceiro comentado de Onde comprar', () => {
  it('não vira um segundo item, porque o parceiro já está publicado', () => {
    const nomes = itensDe('onde_comprar', 'partners').map((partner) => partner.nome)

    expect(nomes).toEqual(content.ondeComprar.partners.map((partner) => partner.nome))
    expect(new Set(nomes).size).toBe(nomes.length)
  })
})

describe('campos sem valor real são omitidos, nunca preenchidos', () => {
  it('o rodapé não declara dados legais', () => {
    expect('legalData' in documents.footer).toBe(false)
  })

  it('a captura de lead não declara título do guia', () => {
    expect('ebookTitle' in documents.captura_lead).toBe(false)
  })

  it('os metadados não declaram imagem de compartilhamento nem seu texto alternativo', () => {
    const metadata = buildPageMetadata(content)

    expect('ogImage' in metadata).toBe(false)
    expect('ogImageAlt' in metadata).toBe(false)
  })

  it('os metadados trazem título, descrição e endereço canônico do index.html', () => {
    expect(buildPageMetadata(content)).toEqual({
      title: content.metadata.title,
      description: content.metadata.description,
      canonicalUrl: content.metadata.canonicalUrl,
    })
  })
})

const MIDIA_FICTICIA = '00000000-0000-4000-8000-000000000000'

/**
 * Troca todo caminho de arquivo por um identificador de mídia válido, para que a
 * validação de esquema veja o documento como ele ficará depois do passo de
 * mídia. Reconhece um caminho pelo que ele é: um texto que começa na raiz do
 * disco.
 */
function comMidiaFicticia(document: Record<string, unknown>): Record<string, unknown> {
  const trocar = (valor: unknown): unknown => {
    if (typeof valor === 'string') {
      return valor.startsWith('/') && valor.includes('/apps/lp/') ? MIDIA_FICTICIA : valor
    }
    if (Array.isArray(valor)) {
      return valor.map(trocar)
    }
    if (typeof valor === 'object' && valor !== null) {
      return Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
          chave,
          trocar(item),
        ]),
      )
    }
    return valor
  }

  return trocar(document) as Record<string, unknown>
}
