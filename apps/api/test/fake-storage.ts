/**
 * Armazenamento em memória com a forma de resposta do Supabase Storage.
 *
 * Existe pela mesma razão do dublê do banco: a suíte não pode depender de rede,
 * e o que precisa ser exercitado é o adaptador **real** de armazenamento, com
 * a aplicação inteira em cima dele.
 *
 * Ele reproduz a regra que dá sentido ao SDD § D-05: um arquivo só entra no
 * armazenamento com uma credencial emitida para aquele caminho, e a API nunca
 * o coloca lá — quem chama `uploadWithCredential` no teste faz o papel do
 * navegador. Um arquivo que aparecesse no armazenamento sem credencial seria um
 * dublê mentindo sobre o fluxo que a tarefa precisa provar.
 */

export interface StoredFile {
  readonly sizeBytes: number
  readonly mimeType: string
}

export interface StorageResult<T> {
  data: T | null
  error: { message: string; status: number } | null
}

const NOT_FOUND_STATUS = 404
const PUBLIC_URL_PREFIX = 'https://projeto-de-teste.supabase.co/storage/v1/object/public'

function keyOf(bucket: string, path: string): string {
  return `${bucket}/${path}`
}

function notFound(bucket: string, path: string): StorageResult<never> {
  return {
    data: null,
    error: { message: `Object not found: ${keyOf(bucket, path)}`, status: NOT_FOUND_STATUS },
  }
}

interface IssuedCredential {
  readonly bucket: string
  readonly path: string
  readonly token: string
}

class FakeBucketApi {
  constructor(
    private readonly storage: FakeStorage,
    private readonly bucket: string,
  ) {}

  async createSignedUploadUrl(
    path: string,
  ): Promise<StorageResult<{ signedUrl: string; token: string; path: string }>> {
    const token = this.storage.issueCredential(this.bucket, path)
    return {
      data: {
        signedUrl: `https://projeto-de-teste.supabase.co/storage/v1/object/upload/sign/${keyOf(this.bucket, path)}?token=${token}`,
        token,
        path,
      },
      error: null,
    }
  }

  async info(
    path: string,
  ): Promise<StorageResult<{ size: number; contentType: string }>> {
    const file = this.storage.find(this.bucket, path)
    if (!file) {
      return notFound(this.bucket, path)
    }
    return { data: { size: file.sizeBytes, contentType: file.mimeType }, error: null }
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    return { data: { publicUrl: `${PUBLIC_URL_PREFIX}/${keyOf(this.bucket, path)}` } }
  }

  async remove(paths: string[]): Promise<StorageResult<{ name: string }[]>> {
    const removed = paths.filter((path) => this.storage.forget(this.bucket, path))
    return { data: removed.map((name) => ({ name })), error: null }
  }
}

export class FakeStorage {
  private readonly files = new Map<string, StoredFile>()
  private readonly credentials: IssuedCredential[] = []
  private nextToken = 1

  from(bucket: string): FakeBucketApi {
    return new FakeBucketApi(this, bucket)
  }

  issueCredential(bucket: string, path: string): string {
    const token = `credencial-${this.nextToken++}`
    this.credentials.push({ bucket, path, token })
    return token
  }

  /** Credenciais emitidas até agora, para o teste conferir o que foi liberado. */
  get issuedCredentials(): readonly IssuedCredential[] {
    return this.credentials
  }

  /**
   * O papel do navegador no passo 2 de D-05. Recusa uma credencial que não
   * tenha sido emitida para exatamente este bucket e caminho, como o
   * armazenamento de verdade recusa.
   */
  uploadWithCredential(token: string, bucket: string, path: string, file: StoredFile): void {
    const credential = this.credentials.find(
      (issued) => issued.token === token && issued.bucket === bucket && issued.path === path,
    )
    if (!credential) {
      throw new Error(`Credencial inválida para ${keyOf(bucket, path)}.`)
    }
    this.files.set(keyOf(bucket, path), file)
  }

  find(bucket: string, path: string): StoredFile | undefined {
    return this.files.get(keyOf(bucket, path))
  }

  forget(bucket: string, path: string): boolean {
    return this.files.delete(keyOf(bucket, path))
  }

  get storedPaths(): string[] {
    return [...this.files.keys()]
  }
}
