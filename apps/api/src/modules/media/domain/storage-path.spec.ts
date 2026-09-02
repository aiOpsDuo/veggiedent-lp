import { splitStoragePath, toStoragePath } from './storage-path'

describe('caminho de armazenamento qualificado pelo bucket', () => {
  it('vai e volta sem perder nada', () => {
    const storagePath = toStoragePath('veggiedent-videos', 'abc-123/demonstracao.mp4')

    expect(storagePath).toBe('veggiedent-videos/abc-123/demonstracao.mp4')
    expect(splitStoragePath(storagePath)).toEqual({
      bucket: 'veggiedent-videos',
      objectPath: 'abc-123/demonstracao.mp4',
    })
  })

  it('separa no primeiro nível: o resto do caminho fica inteiro', () => {
    expect(splitStoragePath('bucket/a/b/c.png').objectPath).toBe('a/b/c.png')
  })

  it('caminho sem separador sai com o objeto vazio, em vez de apontar para outro arquivo', () => {
    expect(splitStoragePath('caminho-corrompido')).toEqual({
      bucket: 'caminho-corrompido',
      objectPath: '',
    })
  })
})
