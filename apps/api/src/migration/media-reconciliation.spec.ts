import {
  getSectionSchema,
  siteMetadataSchema,
  type SectionKey,
} from '@veggiedent/content-schema'
import { policyForMimeType } from '../modules/media/domain/media-kind'
import {
  UnknownMediaTypeError,
  contentTypeOfUrl,
  fileNameFromUrl,
  mediaValuesByAddress,
  referencedUrls,
  type DocumentPair,
} from './media-reconciliation'
import { loadContentSnapshot, defaultSnapshotPath } from './content-snapshot'

const BASE = 'https://p.supabase.co/storage/v1/object/public/veggiedent-images'

function par(key: SectionKey, snapshot: Record<string, unknown>): DocumentPair {
  return { scope: key, schema: getSectionSchema(key), snapshot, stored: {} }
}

describe('o nome do arquivo dentro da URL', () => {
  it.each([
    [`${BASE}/id-da-midia/virbac-kv-hero.png`, 'virbac-kv-hero.png'],
    [`${BASE}/id/foto.jpg?token=abc`, 'foto.jpg'],
    [`${BASE}/id/foto.jpg#trecho`, 'foto.jpg'],
    ['https://exemplo.invalid/imagens/logo.svg', 'logo.svg'],
  ])('de %s é %s', (url, esperado) => {
    expect(fileNameFromUrl(url)).toBe(esperado)
  })
})

describe('o tipo do arquivo, deduzido da extensão', () => {
  const extensoes = [
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.webp', 'image/webp'],
    ['.avif', 'image/avif'],
    ['.gif', 'image/gif'],
    ['.svg', 'image/svg+xml'],
    ['.mp4', 'video/mp4'],
    ['.webm', 'video/webm'],
  ] as const

  it.each(extensoes)('%s vira %s', (extensao, esperado) => {
    expect(contentTypeOfUrl(`${BASE}/id/arquivo${extensao}`)).toBe(esperado)
  })

  /**
   * Um tipo que a carga deduza mas que nenhum bucket aceite faria o envio ser
   * recusado só na credencial, com a carga já em andamento. A lista precisa
   * continuar sendo um subconjunto do que os buckets aceitam.
   */
  it.each(extensoes)('%s produz um tipo que algum bucket aceita', (_extensao, tipo) => {
    expect(policyForMimeType(tipo)).toBeDefined()
  })

  it('recusa uma extensão que não conhece, dizendo qual URL', () => {
    expect(() => contentTypeOfUrl(`${BASE}/id/planilha.xlsx`)).toThrow(UnknownMediaTypeError)
  })

  it('recusa um arquivo sem extensão', () => {
    expect(() => contentTypeOfUrl(`${BASE}/id/arquivo`)).toThrow(UnknownMediaTypeError)
  })
})

describe('os endereços dos campos de mídia de um documento', () => {
  it('inclui campo de topo e campo de item de lista, com a posição no endereço', () => {
    const valores = mediaValuesByAddress(getSectionSchema('rotina'), {
      heading: 'Rotina',
      steps: [
        { ordem: 0, visivel: true, image: `${BASE}/a/um.jpg` },
        { ordem: 1, visivel: true, image: `${BASE}/b/dois.jpg` },
      ],
    })

    expect([...valores]).toEqual([
      ['steps[0].image', `${BASE}/a/um.jpg`],
      ['steps[1].image', `${BASE}/b/dois.jpg`],
    ])
  })

  it('ignora campo de texto, inclusive o texto alternativo que acompanha a imagem', () => {
    const valores = mediaValuesByAddress(getSectionSchema('hero'), {
      image: `${BASE}/a/hero.png`,
      imageAlt: 'Descrição da imagem',
      headline: 'Título',
    })

    expect([...valores.keys()]).toEqual(['image'])
  })

  it('ignora campo de mídia vazio, em vez de tratá-lo como referência', () => {
    expect(mediaValuesByAddress(siteMetadataSchema, { title: 'T', ogImage: '' }).size).toBe(0)
  })

  it('atravessa também o esquema dos metadados da página', () => {
    const valores = mediaValuesByAddress(siteMetadataSchema, {
      title: 'T',
      ogImage: `${BASE}/a/compartilhar.png`,
    })

    expect([...valores]).toEqual([['ogImage', `${BASE}/a/compartilhar.png`]])
  })
})

describe('as URLs que o instantâneo referencia', () => {
  it('conta o mesmo arquivo uma vez só, mesmo em dois campos', () => {
    const video = 'https://p.supabase.co/storage/v1/object/public/veggiedent-videos/a/v.mp4'
    const urls = referencedUrls([
      par('demonstracao', {
        bannerVideo: video,
        videos: [{ ordem: 0, visivel: true, video, label: 'Um' }],
      }),
    ])

    expect(urls).toEqual([video])
  })

  it('encontra as 21 mídias distintas do instantâneo do repositório', () => {
    const snapshot = loadContentSnapshot(defaultSnapshotPath())
    const pares = Object.entries(snapshot.sections).map(([key, documento]) =>
      par(key as SectionKey, documento as Record<string, unknown>),
    )

    expect(referencedUrls(pares)).toHaveLength(21)
  })
})
