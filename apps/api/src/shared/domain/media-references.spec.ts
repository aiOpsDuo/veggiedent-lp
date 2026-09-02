import {
  demonstracaoSchema,
  heroSchema,
  siteMetadataSchema,
} from '@veggiedent/content-schema'
import { collectMediaIds, withResolvedMedia } from './media-references'

const IMAGEM = '00000000-0000-4000-8000-00000000000a'
const VIDEO = '00000000-0000-4000-8000-00000000000b'
const POSTER = '00000000-0000-4000-8000-00000000000c'

const urls = new Map([
  [IMAGEM, 'https://cdn.exemplo/imagem.png'],
  [VIDEO, 'https://cdn.exemplo/video.mp4'],
  [POSTER, 'https://cdn.exemplo/poster.png'],
])

const heroi = (image: unknown) => ({ headline: 'Hálito fresco', image, imageAlt: 'Cão' })

const demonstracao = (items: unknown[]) => ({ heading: 'Veja como é', videos: items })

const video = (ordem: number, media: Record<string, unknown>) => ({
  visivel: true,
  ordem,
  title: `Vídeo ${ordem + 1}`,
  ...media,
})

describe('collectMediaIds', () => {
  it('reúne os identificadores dos campos de topo', () => {
    expect(collectMediaIds(heroSchema, heroi(IMAGEM))).toEqual([IMAGEM])
  })

  it('reúne também os identificadores dentro dos itens de lista', () => {
    const ids = collectMediaIds(
      demonstracaoSchema,
      demonstracao([video(0, { video: VIDEO, poster: POSTER })]),
    )

    expect(ids.sort()).toEqual([VIDEO, POSTER].sort())
  })

  it('não repete a mesma mídia usada em mais de um lugar', () => {
    const ids = collectMediaIds(
      demonstracaoSchema,
      demonstracao([video(0, { poster: POSTER }), video(1, { poster: POSTER })]),
    )

    expect(ids).toEqual([POSTER])
  })

  it('ignora campo de mídia vazio, ausente ou fora de forma', () => {
    expect(collectMediaIds(heroSchema, heroi(''))).toEqual([])
    expect(collectMediaIds(heroSchema, { headline: 'Sem imagem' })).toEqual([])
    expect(collectMediaIds(heroSchema, heroi(42))).toEqual([])
    expect(collectMediaIds(demonstracaoSchema, demonstracao(['não é um item']))).toEqual([])
  })
})

describe('withResolvedMedia', () => {
  it('troca o identificador pela URL pública no campo de topo', () => {
    const resolvido = withResolvedMedia(heroSchema, heroi(IMAGEM), urls)

    expect(resolvido.image).toBe('https://cdn.exemplo/imagem.png')
  })

  it('não toca no texto alternativo, que é texto e não mídia', () => {
    const resolvido = withResolvedMedia(heroSchema, heroi(IMAGEM), urls)

    expect(resolvido.imageAlt).toBe('Cão')
    expect(resolvido.headline).toBe('Hálito fresco')
  })

  it('resolve a mídia de cada item de lista, não só a do topo', () => {
    const resolvido = withResolvedMedia(
      demonstracaoSchema,
      demonstracao([video(0, { video: VIDEO, poster: POSTER })]),
      urls,
    )

    expect(resolvido.videos).toEqual([
      video(0, {
        video: 'https://cdn.exemplo/video.mp4',
        poster: 'https://cdn.exemplo/poster.png',
      }),
    ])
  })

  it('omite o campo cuja mídia foi apagada, em vez de entregar o identificador', () => {
    // A LP não sabe renderizar um identificador; campo ausente ela já trata
    // como vazio (risco R-03). Entregar o UUID seria pior do que não entregar.
    const resolvido = withResolvedMedia(heroSchema, heroi('mídia-que-não-existe'), urls)

    expect('image' in resolvido).toBe(false)
    expect(resolvido.headline).toBe('Hálito fresco')
  })

  it('omite o campo de mídia fora de forma sem derrubar o documento', () => {
    expect('image' in withResolvedMedia(heroSchema, heroi(42), urls)).toBe(false)
    expect('image' in withResolvedMedia(heroSchema, heroi(''), urls)).toBe(false)
  })

  it('não inventa campo de mídia que o documento não tem', () => {
    expect(withResolvedMedia(heroSchema, { headline: 'Só texto' }, urls)).toEqual({
      headline: 'Só texto',
    })
  })

  it('preserva item de lista fora de forma', () => {
    const resolvido = withResolvedMedia(
      demonstracaoSchema,
      demonstracao([null, 42, video(0, { poster: POSTER })]),
      urls,
    )

    expect((resolvido.videos as unknown[])[0]).toBeNull()
    expect((resolvido.videos as unknown[])[1]).toBe(42)
  })

  it('não altera o documento recebido', () => {
    const original = demonstracao([video(0, { video: VIDEO, poster: POSTER })])
    const copia = JSON.parse(JSON.stringify(original)) as unknown

    withResolvedMedia(demonstracaoSchema, original, urls)

    expect(original).toEqual(copia)
  })

  it('serve também aos metadados da página, declarados com o mesmo contrato', () => {
    const resolvido = withResolvedMedia(
      siteMetadataSchema,
      { title: 'Veggiedent', ogImage: IMAGEM, ogImageAlt: 'Embalagem' },
      urls,
    )

    expect(resolvido.ogImage).toBe('https://cdn.exemplo/imagem.png')
    expect(resolvido.ogImageAlt).toBe('Embalagem')
  })
})
