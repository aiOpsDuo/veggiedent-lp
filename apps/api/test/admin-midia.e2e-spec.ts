import { HttpStatus } from '@nestjs/common'
import request from 'supertest'
import { startContentHarness, type ContentHarness } from './content-harness'
import { exampleDocument, exampleMetadata } from './documento-de-exemplo'

/**
 * Rotas de mídia (T7; SDD § D-05, § C-06, C-07 e § R-04).
 *
 * O que esta suíte prende, em ordem de importância:
 *
 * 1. **Os bytes não passam pela API.** Nenhuma rota daqui recebe arquivo: a API
 *    emite credencial e o navegador — aqui, o próprio teste — envia direto ao
 *    armazenamento. O dublê de armazenamento recusa arquivo sem credencial
 *    emitida para aquele caminho, então o caminho testado é o de verdade.
 * 2. **O registro só nasce depois da confirmação** do upload (risco R-04).
 * 3. **Tipo não suportado é recusado com mensagem clara, em português.**
 * 4. **Mídia em uso não é removida** — `409`, sem apagar registro nem arquivo.
 */

const IMAGEM = { contentType: 'image/png', bucket: 'veggiedent-images' }
const VIDEO = { contentType: 'video/mp4', bucket: 'veggiedent-videos' }

const MEGABYTE = 1024 * 1024
const AGORA = '2026-09-02T12:00:00.000Z'

interface CredencialEmitida {
  kind: string
  bucket: string
  path: string
  token: string
  signedUrl: string
  resumableEndpoint: string
  expiresInSeconds: number
  maxBytes: number
}

describe('rotas administrativas de mídia', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  const agente = (): request.Agent => request.agent(harness.app.getHttpServer())
  const comToken = (req: request.Test): request.Test =>
    req.set('authorization', `Bearer ${harness.token}`)

  const pedirCredencial = (
    tipo: { contentType: string },
    sizeBytes: number,
    originalFilename = 'arquivo de teste.bin',
  ): request.Test =>
    comToken(
      agente()
        .post('/api/admin/media/upload-url')
        .send({ originalFilename, contentType: tipo.contentType, sizeBytes }),
    )

  /**
   * O passo 2 de D-05, feito por quem faz o papel do navegador: os bytes vão do
   * cliente direto ao armazenamento, com a credencial emitida pela API.
   */
  const enviarComoNavegador = (
    credencial: CredencialEmitida,
    sizeBytes: number,
    mimeType: string,
  ): void => {
    harness.database.storage.uploadWithCredential(
      credencial.token,
      credencial.bucket,
      credencial.path,
      { sizeBytes, mimeType },
    )
  }

  const confirmar = (corpo: Record<string, unknown>): request.Test =>
    comToken(agente().post('/api/admin/media').send(corpo))

  /** O fluxo inteiro dos três passos, para os testes que partem de uma mídia. */
  async function enviarMidia(
    tipo: { contentType: string; bucket: string },
    sizeBytes: number,
    originalFilename = 'arquivo de teste.bin',
  ): Promise<Record<string, unknown>> {
    const emissao = await pedirCredencial(tipo, sizeBytes, originalFilename)
    const credencial = emissao.body as CredencialEmitida
    enviarComoNavegador(credencial, sizeBytes, tipo.contentType)
    const registro = await confirmar({
      kind: credencial.kind,
      path: credencial.path,
      originalFilename,
    })
    return registro.body as Record<string, unknown>
  }

  describe('emissão da credencial de upload', () => {
    it('responde 401 sem token e não emite credencial nenhuma', async () => {
      const response = await agente()
        .post('/api/admin/media/upload-url')
        .send({ originalFilename: 'foto.png', contentType: 'image/png', sizeBytes: 1024 })

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(harness.database.storage.issuedCredentials).toHaveLength(0)
    })

    it('devolve credencial, caminho e bucket da natureza deduzida do tipo', async () => {
      const response = await pedirCredencial(VIDEO, 120 * MEGABYTE, 'Demonstração final.mp4')

      expect(response.status).toBe(HttpStatus.CREATED)
      expect(response.body).toMatchObject({
        kind: 'video',
        bucket: VIDEO.bucket,
        maxBytes: 500 * MEGABYTE,
      })
      expect(response.body.token).toEqual(expect.any(String))
      expect(response.body.signedUrl).toContain(VIDEO.bucket)
      expect(response.body.resumableEndpoint).toContain('/storage/v1/upload/resumable')
      expect(response.body.expiresInSeconds).toBeGreaterThan(0)
    })

    it('gera um caminho sem acento nem espaço, mantendo a extensão', async () => {
      const response = await pedirCredencial(IMAGEM, 2048, 'Cão sorrindo NA praça.png')

      expect(response.body.path).toMatch(/^[0-9a-f-]{36}\/cao-sorrindo-na-praca\.png$/)
    })

    it('não cria registro de mídia ao emitir a credencial', async () => {
      await pedirCredencial(IMAGEM, 2048)

      expect(harness.database.rows('media_assets')).toHaveLength(0)
      expect(harness.database.callsTo('media_assets')).toHaveLength(0)
    })

    it('recusa tipo de arquivo não suportado com mensagem clara em português', async () => {
      const response = await pedirCredencial({ contentType: 'application/pdf' }, 2048)

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.error).toBe('Dados inválidos.')
      expect(response.body.fields.contentType).toBe(
        'Tipo de arquivo não suportado. Tipos aceitos: image/jpeg, image/png, image/webp, image/avif, image/gif, image/svg+xml, video/mp4, video/webm.',
      )
      expect(harness.database.storage.issuedCredentials).toHaveLength(0)
    })

    it('recusa arquivo acima do limite do bucket, dizendo qual é o limite', async () => {
      const response = await pedirCredencial(IMAGEM, 11 * MEGABYTE)

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields.sizeBytes).toBe(
        'Arquivo maior que o limite de 10 MB para imagem.',
      )
      expect(harness.database.storage.issuedCredentials).toHaveLength(0)
    })

    it('aceita vídeo de centenas de MB, que é o porte que o projeto tem', async () => {
      const response = await pedirCredencial(VIDEO, 480 * MEGABYTE)

      expect(response.status).toBe(HttpStatus.CREATED)
    })

    it('recusa vídeo acima de 500 MB', async () => {
      const response = await pedirCredencial(VIDEO, 501 * MEGABYTE)

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields.sizeBytes).toBe(
        'Arquivo maior que o limite de 500 MB para vídeo.',
      )
    })
  })

  describe('registro da mídia', () => {
    it('responde 401 sem token e não grava', async () => {
      const response = await agente()
        .post('/api/admin/media')
        .send({ kind: 'image', path: 'x/foto.png', originalFilename: 'foto.png' })

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(harness.database.rows('media_assets')).toHaveLength(0)
    })

    /** Risco R-04: sem arquivo confirmado, não existe mídia. */
    it('recusa a confirmação quando o arquivo não está no armazenamento', async () => {
      const emissao = await pedirCredencial(IMAGEM, 2048, 'foto.png')

      const response = await confirmar({
        kind: 'image',
        path: emissao.body.path,
        originalFilename: 'foto.png',
      })

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields.path).toBe(
        'Nenhum arquivo neste caminho do armazenamento. Envie o arquivo com a credencial antes de confirmar.',
      )
      expect(harness.database.rows('media_assets')).toHaveLength(0)
    })

    it('registra a mídia depois do upload e devolve a URL pública', async () => {
      const registro = await enviarMidia(IMAGEM, 3 * MEGABYTE, 'Cão sorrindo.png')

      expect(registro).toMatchObject({
        kind: 'image',
        mimeType: 'image/png',
        sizeBytes: 3 * MEGABYTE,
        originalFilename: 'Cão sorrindo.png',
      })
      expect(registro.publicUrl).toContain(`${IMAGEM.bucket}/`)
      expect(registro.storagePath).toContain(`${IMAGEM.bucket}/`)
      expect(harness.database.rows('media_assets')).toHaveLength(1)
    })

    /**
     * Os bytes só existem do lado do armazenamento: a API recebeu nome, tipo e
     * tamanho, e o tamanho que ela registra é o que o armazenamento informa —
     * não o que o corpo da requisição afirmou.
     */
    it('registra um vídeo de centenas de MB sem que o arquivo passe pela API', async () => {
      const tamanhoReal = 320 * MEGABYTE
      const emissao = await pedirCredencial(VIDEO, tamanhoReal, 'demonstracao.mp4')
      const credencial = emissao.body as CredencialEmitida

      enviarComoNavegador(credencial, tamanhoReal, VIDEO.contentType)
      const registro = await confirmar({
        kind: 'video',
        path: credencial.path,
        originalFilename: 'demonstracao.mp4',
        width: 1920,
        height: 1080,
        durationSeconds: 42.5,
      })

      expect(registro.status).toBe(HttpStatus.CREATED)
      expect(registro.body).toMatchObject({
        kind: 'video',
        sizeBytes: tamanhoReal,
        width: 1920,
        height: 1080,
        durationSeconds: 42.5,
      })
      expect(harness.database.storage.storedPaths).toEqual([
        `${VIDEO.bucket}/${credencial.path}`,
      ])
    })

    it('recusa arquivo que não corresponde à natureza declarada', async () => {
      const emissao = await pedirCredencial(IMAGEM, 2048, 'foto.png')
      const credencial = emissao.body as CredencialEmitida
      enviarComoNavegador(credencial, 2048, IMAGEM.contentType)

      const response = await confirmar({
        kind: 'video',
        path: credencial.path,
        originalFilename: 'foto.png',
      })

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(harness.database.rows('media_assets')).toHaveLength(0)
    })

    it('recusa natureza de mídia desconhecida', async () => {
      const response = await confirmar({
        kind: 'planilha',
        path: 'x/planilha.csv',
        originalFilename: 'planilha.csv',
      })

      expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(response.body.fields.kind).toBe('Natureza de mídia desconhecida. Use image ou video.')
    })

    it('confirmar duas vezes o mesmo caminho não duplica o registro', async () => {
      const emissao = await pedirCredencial(IMAGEM, 2048, 'foto.png')
      const credencial = emissao.body as CredencialEmitida
      enviarComoNavegador(credencial, 2048, IMAGEM.contentType)
      const corpo = { kind: 'image', path: credencial.path, originalFilename: 'foto.png' }

      const primeira = await confirmar(corpo)
      const segunda = await confirmar(corpo)

      expect(segunda.status).toBe(HttpStatus.CREATED)
      expect(segunda.body.id).toBe(primeira.body.id)
      expect(harness.database.rows('media_assets')).toHaveLength(1)
    })
  })

  describe('consulta de uma mídia', () => {
    it('responde 401 sem token', async () => {
      const response = await agente().get(
        '/api/admin/media/00000000-0000-4000-8000-000000000001',
      )

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })

    it('devolve o registro pelo identificador', async () => {
      const registrada = await enviarMidia(IMAGEM, 2048, 'foto.png')

      const response = await comToken(agente().get(`/api/admin/media/${registrada.id}`))

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toEqual(registrada)
    })

    it('responde 404 para identificador inexistente', async () => {
      const response = await comToken(
        agente().get('/api/admin/media/00000000-0000-4000-8000-00000000dead'),
      )

      expect(response.status).toBe(HttpStatus.NOT_FOUND)
    })

    it('responde 404 para identificador malformado, sem consultar o banco', async () => {
      const response = await comToken(agente().get('/api/admin/media/nao-e-uuid'))

      expect(response.status).toBe(HttpStatus.NOT_FOUND)
      expect(harness.database.callsTo('media_assets')).toHaveLength(0)
    })
  })

  describe('remoção de uma mídia', () => {
    const secaoQueUsa = (mediaId: string) => ({
      key: 'hero',
      data: { ...exampleDocument('hero'), image: mediaId },
      is_published: true,
      updated_at: AGORA,
      updated_by: null,
    })

    it('responde 401 sem token e não apaga', async () => {
      const registrada = await enviarMidia(IMAGEM, 2048, 'foto.png')

      const response = await agente().delete(`/api/admin/media/${registrada.id}`)

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(harness.database.rows('media_assets')).toHaveLength(1)
    })

    it('apaga o registro e o arquivo quando ninguém usa a mídia', async () => {
      const registrada = await enviarMidia(IMAGEM, 2048, 'foto.png')

      const response = await comToken(agente().delete(`/api/admin/media/${registrada.id}`))

      expect(response.status).toBe(HttpStatus.NO_CONTENT)
      expect(harness.database.rows('media_assets')).toHaveLength(0)
      expect(harness.database.storage.storedPaths).toHaveLength(0)
    })

    it('recusa com 409 a remoção de mídia referenciada por uma seção', async () => {
      const registrada = await enviarMidia(IMAGEM, 2048, 'foto.png')
      harness.database.seed('content_sections', [secaoQueUsa(registrada.id as string)])

      const response = await comToken(agente().delete(`/api/admin/media/${registrada.id}`))

      expect(response.status).toBe(HttpStatus.CONFLICT)
      expect(response.body).toEqual({
        statusCode: HttpStatus.CONFLICT,
        error: 'Recurso em uso por outro registro.',
      })
      expect(harness.database.rows('media_assets')).toHaveLength(1)
      expect(harness.database.storage.storedPaths).toHaveLength(1)
    })

    /** Visibilidade não apaga conteúdo: a seção desligada volta idêntica (C-08). */
    it('recusa com 409 mesmo quando a seção que usa a mídia está despublicada', async () => {
      const registrada = await enviarMidia(IMAGEM, 2048, 'foto.png')
      harness.database.seed('content_sections', [
        { ...secaoQueUsa(registrada.id as string), is_published: false },
      ])

      const response = await comToken(agente().delete(`/api/admin/media/${registrada.id}`))

      expect(response.status).toBe(HttpStatus.CONFLICT)
    })

    it('recusa com 409 a remoção de mídia usada nos metadados da página', async () => {
      const registrada = await enviarMidia(IMAGEM, 2048, 'foto.png')
      await comToken(
        agente()
          .put('/api/admin/metadata')
          .send({
            ...exampleMetadata(),
            ogImage: registrada.id,
            ogImageAlt: 'Imagem de compartilhamento',
          }),
      )

      const response = await comToken(agente().delete(`/api/admin/media/${registrada.id}`))

      expect(response.status).toBe(HttpStatus.CONFLICT)
      expect(harness.database.rows('media_assets')).toHaveLength(1)
    })

    it('volta a permitir a remoção depois que a seção deixa de usar a mídia', async () => {
      const registrada = await enviarMidia(IMAGEM, 2048, 'foto.png')
      harness.database.seed('content_sections', [secaoQueUsa(registrada.id as string)])
      harness.database.seed('content_sections', [])

      const response = await comToken(agente().delete(`/api/admin/media/${registrada.id}`))

      expect(response.status).toBe(HttpStatus.NO_CONTENT)
    })

    it('responde 404 ao remover identificador inexistente', async () => {
      const response = await comToken(
        agente().delete('/api/admin/media/00000000-0000-4000-8000-00000000dead'),
      )

      expect(response.status).toBe(HttpStatus.NOT_FOUND)
    })
  })
})
