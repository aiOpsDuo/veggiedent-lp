import { describe, expect, it } from 'vitest'
import { SECTION_KEYS } from '../src/contract'
import type { SectionKey } from '../src/contract'
import { MESSAGES, minimumItemsMessage } from '../src/messages'
import { demonstracaoSchema } from '../src/sections'
import { validateSectionDocument, validateSiteMetadata } from '../src/validation'
import { mediaId, validSectionDocuments, validSiteMetadata } from './fixtures'

interface InvalidCase {
  readonly description: string
  readonly document: unknown
  readonly errorPath: string
  readonly message: string
}

function withoutField(section: SectionKey, field: string): Record<string, unknown> {
  const { [field]: removed, ...rest } = validSectionDocuments[section] as Record<string, unknown>
  return rest
}

function replacingFirstItem(section: SectionKey, list: string, changes: Record<string, unknown>): unknown {
  const document = validSectionDocuments[section] as Record<string, unknown>
  const items = document[list] as Record<string, unknown>[]
  return { ...document, [list]: [{ ...items[0], ...changes }, ...items.slice(1)] }
}

const invalidCases: Record<SectionKey, InvalidCase> = {
  hero: {
    description: 'título principal ausente',
    document: withoutField('hero', 'headline'),
    errorPath: 'hero.headline',
    message: MESSAGES.required,
  },
  educacao: {
    description: 'card com imagem sem texto alternativo',
    document: replacingFirstItem('educacao', 'cards', { imageAlt: '   ' }),
    errorPath: 'educacao.cards.0.imageAlt',
    message: MESSAGES.required,
  },
  rotina: {
    description: 'passo com caminho de arquivo no lugar do identificador da mídia',
    document: replacingFirstItem('rotina', 'steps', { image: '/images/rotina/observar-boca.jpg' }),
    errorPath: 'rotina.steps.0.image',
    message: MESSAGES.mediaReference,
  },
  produto: {
    description: 'lista de benefícios vazia',
    document: { ...validSectionDocuments.produto, benefits: [] },
    errorPath: 'produto.benefits',
    message: minimumItemsMessage(1),
  },
  demonstracao: {
    description: 'vídeo sem indicação de visibilidade',
    document: replacingFirstItem('demonstracao', 'videos', { visivel: undefined }),
    errorPath: 'demonstracao.videos.0.visivel',
    message: MESSAGES.required,
  },
  prova_autoridade: {
    description: 'dois números com a mesma posição de ordenação',
    document: {
      ...validSectionDocuments.prova_autoridade,
      stats: validSectionDocuments.prova_autoridade.stats.map((stat) => ({ ...stat, ordem: 0 })),
    },
    errorPath: 'prova_autoridade.stats.1.ordem',
    message: MESSAGES.duplicateOrder,
  },
  captura_lead: {
    description: 'texto do modal de sucesso ausente',
    document: withoutField('captura_lead', 'successModalTitle'),
    errorPath: 'captura_lead.successModalTitle',
    message: MESSAGES.required,
  },
  onde_comprar: {
    description: 'parceiro com link inválido',
    document: replacingFirstItem('onde_comprar', 'partners', { link: 'lupipet' }),
    errorPath: 'onde_comprar.partners.0.link',
    message: MESSAGES.invalidLink,
  },
  faq: {
    description: 'pergunta sem resposta',
    document: replacingFirstItem('faq', 'items', { answer: '' }),
    errorPath: 'faq.items.0.answer',
    message: MESSAGES.required,
  },
}

describe('validação de documento de seção', () => {
  it.each(SECTION_KEYS)('aceita o documento válido de %s', (key) => {
    const result = validateSectionDocument(key, validSectionDocuments[key])

    expect(result.valid ? null : result.fields).toBeNull()
    expect(result.valid).toBe(true)
  })

  it.each(SECTION_KEYS)('recusa o documento inválido de %s', (key) => {
    const { document, errorPath, message } = invalidCases[key]

    const result = validateSectionDocument(key, document)

    expect(result.valid).toBe(false)
    expect(result.valid ? {} : result.fields).toMatchObject({ [errorPath]: message })
  })

  it.each(SECTION_KEYS)('preserva a acentuação do documento de %s na ida e na volta', (key) => {
    const result = validateSectionDocument(key, validSectionDocuments[key])

    expect(result.valid ? result.data : null).toEqual(validSectionDocuments[key])
  })
})

describe('fundo do banner da Demonstração', () => {
  const { bannerVideo, ...semFundo } = validSectionDocuments.demonstracao

  it('aceita o banner com vídeo, sem nenhuma imagem cadastrada', () => {
    expect(validateSectionDocument('demonstracao', { ...semFundo, bannerVideo }).valid).toBe(true)
  })

  it('aceita o banner com imagem, sem pedir descrição — o fundo é decorativo', () => {
    const result = validateSectionDocument('demonstracao', { ...semFundo, bannerImage: mediaId(11) })

    expect(result.valid ? {} : result.fields).toEqual({})
    expect(result.valid).toBe(true)
  })

  it('aceita o banner sem vídeo e sem imagem — os dois campos são opcionais', () => {
    expect(validateSectionDocument('demonstracao', semFundo).valid).toBe(true)
  })

  it('recusa a descrição da imagem do banner, que não é campo do esquema', () => {
    const result = validateSectionDocument('demonstracao', {
      ...semFundo,
      bannerImage: mediaId(11),
      bannerImageAlt: 'Descrição que não deveria existir',
    })

    expect(result.valid ? {} : result.fields).toEqual({
      'demonstracao.bannerImageAlt': MESSAGES.unknownField,
    })
  })

  it('não tem campo de miniatura em nenhum vídeo da lista', () => {
    const videos = demonstracaoSchema.lists.find((list) => list.name === 'videos')

    expect(videos?.itemFields.map((field) => field.name)).toEqual(['label', 'video'])
  })
})

describe('validação dos metadados da página', () => {
  it('aceita os metadados válidos', () => {
    expect(validateSiteMetadata(validSiteMetadata).valid).toBe(true)
  })

  it('aceita metadados sem imagem de compartilhamento', () => {
    const result = validateSiteMetadata({ ...validSiteMetadata, ogImage: undefined, ogImageAlt: undefined })

    expect(result.valid).toBe(true)
  })

  it('exige texto alternativo quando a imagem de compartilhamento é preenchida', () => {
    const result = validateSiteMetadata({ ...validSiteMetadata, ogImage: mediaId(11) })

    expect(result.valid ? {} : result.fields).toEqual({
      'metadata.ogImageAlt': MESSAGES.altRequiredWithImage,
    })
  })

  it('recusa metadados sem descrição', () => {
    const { description, ...rest } = validSiteMetadata

    const result = validateSiteMetadata(rest)

    expect(result.valid ? {} : result.fields).toMatchObject({
      'metadata.description': MESSAGES.required,
    })
  })
})
