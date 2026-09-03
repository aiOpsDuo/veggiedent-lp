import { arquivoDe } from '../../test/arquivo'
import type {
  MediaGateway,
  MediaResult,
  RegisterRequest,
  RegisteredMedia,
  UploadCredential,
  UploadRequest,
} from './media-gateway'
import { ApiMediaService } from './media-service'
import { MediaTransferError, type MediaTransfer } from './media-transfer'

/**
 * Os três passos do envio (SDD § D-05) e, sobretudo, o que acontece **antes**
 * do primeiro deles: um arquivo que o armazenamento nunca aceitaria não gasta
 * nenhuma chamada. O espião conta as chamadas, então "recusado no painel" é uma
 * afirmação verificável e não uma leitura de código.
 */

const TOKEN = 'token-do-operador'

const CREDENCIAL: UploadCredential = {
  kind: 'video',
  bucket: 'veggiedent-videos',
  path: 'abc/video.mp4',
  signedUrl: 'https://armazenamento.test/object/upload/sign/veggiedent-videos/abc/video.mp4',
  token: 'credencial-temporaria',
  resumableEndpoint: 'https://armazenamento.test/storage/v1/upload/resumable/sign',
  expiresInSeconds: 7200,
  maxBytes: 524288000,
}

const REGISTRADA: RegisteredMedia = {
  id: '11111111-2222-3333-4444-555555555555',
  kind: 'video',
  publicUrl: 'https://armazenamento.test/public/abc/video.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 4 * 1024 * 1024,
  originalFilename: 'video.mp4',
}

class GatewayEspiao implements MediaGateway {
  readonly credenciaisPedidas: UploadRequest[] = []
  readonly registros: RegisterRequest[] = []
  readonly consultas: string[] = []

  constructor(
    private readonly credencial: MediaResult<UploadCredential> = {
      status: 'ok',
      value: CREDENCIAL,
    },
    private readonly registro: MediaResult<RegisteredMedia> = {
      status: 'ok',
      value: REGISTRADA,
    },
  ) {}

  async requestUploadCredential(
    _accessToken: string,
    request: UploadRequest,
  ): Promise<MediaResult<UploadCredential>> {
    this.credenciaisPedidas.push(request)
    return this.credencial
  }

  async registerMedia(
    _accessToken: string,
    request: RegisterRequest,
  ): Promise<MediaResult<RegisteredMedia>> {
    this.registros.push(request)
    return this.registro
  }

  async getMedia(_accessToken: string, id: string): Promise<MediaResult<RegisteredMedia>> {
    this.consultas.push(id)
    return { status: 'ok', value: REGISTRADA }
  }
}

const semTransferencia: MediaTransfer = async () => {
  throw new Error('Nenhuma transferência deveria ter começado.')
}

function servico(
  gateway: MediaGateway,
  transfer: MediaTransfer = async (_credential, _file, onProgress) => onProgress(1),
): ApiMediaService {
  return new ApiMediaService(gateway, TOKEN, () => transfer)
}

describe('recusa no painel, antes de qualquer chamada (SDD § C-06, C-07)', () => {
  it('não pede credencial para tipo de arquivo não suportado', async () => {
    const gateway = new GatewayEspiao()

    const resultado = await servico(gateway, semTransferencia).send(
      'video',
      arquivoDe('planilha.pdf', 'application/pdf', 1000),
      () => undefined,
    )

    expect(resultado).toEqual({
      status: 'recusada',
      message: 'Tipo de arquivo não suportado para vídeo. Envie MP4 ou WebM.',
    })
    expect(gateway.credenciaisPedidas).toEqual([])
    expect(gateway.registros).toEqual([])
  })

  it('não pede credencial para arquivo acima do teto de 50 MB do projeto', async () => {
    const gateway = new GatewayEspiao()

    const resultado = await servico(gateway, semTransferencia).send(
      'video',
      arquivoDe('longo.mp4', 'video/mp4', 60 * 1024 * 1024),
      () => undefined,
    )

    expect(resultado).toEqual({
      status: 'recusada',
      message: 'O arquivo tem 60 MB e o limite para vídeo é 50 MB.',
    })
    expect(gateway.credenciaisPedidas).toEqual([])
  })
})

describe('envio em três passos', () => {
  it('declara nome, tipo e tamanho, transfere e só então registra', async () => {
    const gateway = new GatewayEspiao()
    const transferidos: string[] = []

    const resultado = await servico(gateway, async (credential, file, onProgress) => {
      expect(gateway.registros).toEqual([])
      transferidos.push(`${file.name} -> ${credential.path}`)
      onProgress(1)
    }).send('video', arquivoDe('video.mp4', 'video/mp4', 4 * 1024 * 1024), () => undefined)

    expect(gateway.credenciaisPedidas).toEqual([
      { originalFilename: 'video.mp4', contentType: 'video/mp4', sizeBytes: 4 * 1024 * 1024 },
    ])
    expect(transferidos).toEqual(['video.mp4 -> abc/video.mp4'])
    expect(gateway.registros).toEqual([
      { kind: 'video', path: 'abc/video.mp4', originalFilename: 'video.mp4' },
    ])
    expect(resultado).toEqual({ status: 'enviada', media: REGISTRADA })
  })

  it('informa o progresso de quem transfere', async () => {
    const fracoes: number[] = []

    await servico(new GatewayEspiao(), async (_credential, _file, onProgress) => {
      onProgress(0.25)
      onProgress(1)
    }).send('video', arquivoDe('video.mp4', 'video/mp4', 1000), (fracao) =>
      fracoes.push(fracao),
    )

    expect(fracoes).toEqual([0.25, 1])
  })

  it('não registra mídia quando a transferência falha', async () => {
    const gateway = new GatewayEspiao()

    const resultado = await servico(gateway, async () => {
      throw new MediaTransferError('A conexão caiu durante o envio do arquivo.')
    }).send('video', arquivoDe('video.mp4', 'video/mp4', 1000), () => undefined)

    expect(resultado).toEqual({
      status: 'recusada',
      message: 'A conexão caiu durante o envio do arquivo.',
    })
    expect(gateway.registros).toEqual([])
  })

  it('repassa a recusa da API sem reescrevê-la', async () => {
    const gateway = new GatewayEspiao({
      status: 'recusado',
      message: 'Tipo de arquivo não suportado. Tipos aceitos: video/mp4, video/webm.',
    })

    const resultado = await servico(gateway, semTransferencia).send(
      'video',
      arquivoDe('video.mp4', 'video/mp4', 1000),
      () => undefined,
    )

    expect(resultado).toEqual({
      status: 'recusada',
      message: 'Tipo de arquivo não suportado. Tipos aceitos: video/mp4, video/webm.',
    })
  })
})

describe('prévia do que já está guardado', () => {
  it('descreve a mídia pelo identificador', async () => {
    const gateway = new GatewayEspiao()

    expect(await servico(gateway).describe(REGISTRADA.id)).toEqual(REGISTRADA)
    expect(gateway.consultas).toEqual([REGISTRADA.id])
  })
})
