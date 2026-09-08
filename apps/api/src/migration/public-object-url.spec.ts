import { parsePublicObjectUrl, publicObjectUrl } from './public-object-url'

const URL_DO_INSTANTANEO =
  'https://wkcioegorxdvqtrzapem.supabase.co/storage/v1/object/public/veggiedent-images/53c77460-f784-4705-b485-2c6237fca02e/virbac-kv-hero.png'

describe('a URL pública de um objeto do armazenamento', () => {
  it('separa origem, bucket e caminho do objeto', () => {
    expect(parsePublicObjectUrl(URL_DO_INSTANTANEO)).toEqual({
      origin: 'https://wkcioegorxdvqtrzapem.supabase.co',
      bucket: 'veggiedent-images',
      objectPath: '53c77460-f784-4705-b485-2c6237fca02e/virbac-kv-hero.png',
    })
  })

  it('monta de volta a mesma URL, agora no projeto de destino', () => {
    const location = parsePublicObjectUrl(URL_DO_INSTANTANEO)

    expect(
      publicObjectUrl('https://outro-projeto.supabase.co', location!.bucket, location!.objectPath),
    ).toBe(
      'https://outro-projeto.supabase.co/storage/v1/object/public/veggiedent-images/53c77460-f784-4705-b485-2c6237fca02e/virbac-kv-hero.png',
    )
  })

  it('ignora a barra final da URL do projeto, para não gerar caminho duplo', () => {
    expect(publicObjectUrl('http://127.0.0.1:54321/', 'veggiedent-videos', 'id/v.mp4')).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/veggiedent-videos/id/v.mp4',
    )
  })

  it.each([
    ['uma URL que não é do armazenamento', 'https://exemplo.invalid/imagens/foto.png'],
    ['um caminho assinado, não público', 'https://p.supabase.co/storage/v1/object/sign/b/x.png'],
    ['uma URL sem caminho dentro do bucket', 'https://p.supabase.co/storage/v1/object/public/b'],
    ['uma URL com bucket vazio', 'https://p.supabase.co/storage/v1/object/public//x.png'],
    ['uma URL sem origem', '/storage/v1/object/public/b/x.png'],
  ])('recusa %s', (_caso, url) => {
    expect(parsePublicObjectUrl(url)).toBeNull()
  })
})
