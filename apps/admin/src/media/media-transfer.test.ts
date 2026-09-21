import { arquivoDe } from '../../test/arquivo'
import type { MediaKind, UploadCredential } from './media-gateway'
import { MediaTransferError, transferFor } from './media-transfer'

/**
 * `directTransfer` é o único caminho de transferência que sobrou depois da
 * troca do Supabase Storage pelo MinIO (SDD § D-05, reescrita em 2026-09-21):
 * não há mais protocolo retomável, então este teste é quem garante que o
 * `PUT` contra `uploadUrl` continua reportando progresso e traduzindo status
 * HTTP em resultado, para imagem e vídeo igualmente.
 *
 * O dublê de `XMLHttpRequest` fica só aqui — é a única classe que fala com a
 * rede neste arquivo, e nenhum teste acima dele (`media-service.test.ts`)
 * precisa saber que ela existe.
 */
class FakeXMLHttpRequest {
  static ultima: FakeXMLHttpRequest | undefined

  method = ''
  url = ''
  status = 0
  readonly headers: Record<string, string> = {}
  readonly upload = new EventTarget()
  corpoEnviado: unknown
  private readonly alvo = new EventTarget()

  constructor() {
    FakeXMLHttpRequest.ultima = this
  }

  open(method: string, url: string): void {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.alvo.addEventListener(type, listener)
  }

  send(body: unknown): void {
    this.corpoEnviado = body
  }

  progresso(loaded: number, total: number): void {
    this.upload.dispatchEvent(Object.assign(new Event('progress'), { lengthComputable: true, loaded, total }))
  }

  concluir(status: number): void {
    this.status = status
    this.alvo.dispatchEvent(new Event('load'))
  }

  falhar(): void {
    this.alvo.dispatchEvent(new Event('error'))
  }
}

const CREDENCIAL_BASE = {
  bucket: 'veggiedent-images',
  path: 'abc/foto.jpg',
  uploadUrl: 'https://armazenamento.test/veggiedent-images/abc/foto.jpg?X-Amz-Signature=exemplo',
  expiresInSeconds: 7200,
  maxBytes: 10 * 1024 * 1024,
} as const

function credencialDe(kind: MediaKind): UploadCredential {
  return { ...CREDENCIAL_BASE, kind }
}

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
})

afterEach(() => {
  vi.unstubAllGlobals()
  FakeXMLHttpRequest.ultima = undefined
})

describe.each<MediaKind>(['image', 'video'])('transferFor(%s)', (kind) => {
  it('faz um PUT direto para a uploadUrl da credencial, com o tipo do arquivo', async () => {
    const arquivo = arquivoDe('midia.bin', 'application/octet-stream', 1000)

    const envio = transferFor(kind)(credencialDe(kind), arquivo, () => undefined)
    const xhr = FakeXMLHttpRequest.ultima
    expect(xhr?.method).toBe('PUT')
    expect(xhr?.url).toBe(CREDENCIAL_BASE.uploadUrl)
    expect(xhr?.headers['content-type']).toBe('application/octet-stream')
    expect(xhr?.corpoEnviado).toBe(arquivo)

    xhr?.concluir(200)
    await expect(envio).resolves.toBeUndefined()
  })

  it('reporta progresso durante o envio e conclui em 1 ao terminar', async () => {
    const fracoes: number[] = []
    const envio = transferFor(kind)(credencialDe(kind), arquivoDe('midia.bin', 'image/jpeg', 1000), (fracao) =>
      fracoes.push(fracao),
    )

    FakeXMLHttpRequest.ultima?.progresso(250, 1000)
    FakeXMLHttpRequest.ultima?.progresso(1000, 1000)
    FakeXMLHttpRequest.ultima?.concluir(200)
    await envio

    expect(fracoes).toEqual([0.25, 1, 1])
  })

  it('recusa quando o armazenamento responde um status de erro', async () => {
    const envio = transferFor(kind)(credencialDe(kind), arquivoDe('midia.bin', 'image/jpeg', 1000), () => undefined)

    FakeXMLHttpRequest.ultima?.concluir(403)

    await expect(envio).rejects.toEqual(
      new MediaTransferError(
        'O armazenamento recusou o arquivo (erro 403). Tente de novo; se persistir, verifique o tamanho e o tipo do arquivo.',
      ),
    )
  })

  it('recusa com mensagem de conexão quando a rede falha no meio do envio', async () => {
    const envio = transferFor(kind)(credencialDe(kind), arquivoDe('midia.bin', 'image/jpeg', 1000), () => undefined)

    FakeXMLHttpRequest.ultima?.falhar()

    await expect(envio).rejects.toEqual(
      new MediaTransferError('A conexão caiu durante o envio do arquivo. Verifique a rede e tente de novo.'),
    )
  })
})
