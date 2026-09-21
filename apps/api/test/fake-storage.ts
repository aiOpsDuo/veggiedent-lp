/**
 * Armazenamento em memória com a forma da fatia do cliente `minio` que
 * `MinioMediaStorage` usa (`MinioObjectStorageClient`, em
 * `src/modules/media/infrastructure/minio-client.ts`).
 *
 * Existe pela mesma razão do dublê do banco: a suíte não pode depender de
 * rede, e o que precisa ser exercitado é o adaptador **real** de
 * armazenamento (`MinioMediaStorage`), com a aplicação inteira em cima dele —
 * não um dublê de porta conversando com outro dublê.
 *
 * Ele reproduz a regra que dá sentido ao SDD § D-05: um arquivo só entra no
 * armazenamento com uma credencial emitida para aquele caminho, e a API nunca
 * o coloca lá — quem chama `uploadWithCredential` no teste faz o papel do
 * navegador, com a URL pré-assinada devolvida pela API. Um arquivo que
 * aparecesse no armazenamento sem credencial seria um dublê mentindo sobre o
 * fluxo que a tarefa precisa provar.
 *
 * **Reescrito em 2026-09-21** (SDD § D-05): antes reproduzia a forma do
 * cliente `@supabase/supabase-js` (`.from(bucket).createSignedUploadUrl()`
 * etc.), com uma credencial de duas partes (`signedUrl` + `token`, para o
 * protocolo retomável). Agora reproduz a forma do cliente `minio` — uma única
 * URL `PUT` pré-assinada — e existe **um dublê só** para as duas pontas do
 * armazenamento (antes: `FakeStorage` do lado do Supabase Storage), porque o
 * MinIO tem um cliente só, sem a distinção Storage API/protocolo retomável.
 */

export interface StoredFile {
  readonly sizeBytes: number
  readonly mimeType: string
}

interface IssuedCredential {
  readonly bucket: string
  readonly path: string
  readonly uploadUrl: string
}

/** Mesmo `code` que o cliente `minio` de verdade atribui a um `HEAD` 404. */
class FakeNotFoundError extends Error {
  readonly code = 'NotFound'
}

function keyOf(bucket: string, path: string): string {
  return `${bucket}/${path}`
}

export class FakeMinioClient {
  private readonly files = new Map<string, StoredFile>()
  private readonly buckets = new Set<string>()
  private readonly credentials: IssuedCredential[] = []
  private nextId = 1

  // --- Forma do cliente `minio` (`MinioObjectStorageClient`) --------------
  // É o que `MINIO_CLIENT` injeta em `MinioMediaStorage` nos testes.

  async presignedPutObject(bucketName: string, objectName: string): Promise<string> {
    return this.issueCredential(bucketName, objectName)
  }

  async statObject(
    bucketName: string,
    objectName: string,
  ): Promise<{ size: number; metaData: Record<string, string> }> {
    const file = this.find(bucketName, objectName)
    if (!file) {
      throw new FakeNotFoundError(`Object not found: ${keyOf(bucketName, objectName)}`)
    }
    return { size: file.sizeBytes, metaData: { 'content-type': file.mimeType } }
  }

  async removeObject(bucketName: string, objectName: string): Promise<void> {
    this.forget(bucketName, objectName)
  }

  async bucketExists(bucketName: string): Promise<boolean> {
    return this.buckets.has(bucketName)
  }

  async makeBucket(bucketName: string): Promise<void> {
    this.buckets.add(bucketName)
  }

  async setBucketPolicy(): Promise<void> {
    // Nada a verificar nos testes: a política pública é um pré-requisito
    // operacional (docs/BANCO-DE-DADOS.md), não uma regra que a suíte prende.
  }

  // --- Manipulação direta pelos testes (o papel do navegador) --------------

  issueCredential(bucket: string, path: string): string {
    const uploadUrl = `https://minio-de-teste.local/${keyOf(bucket, path)}?X-Amz-Credential=fake-${this.nextId++}`
    this.credentials.push({ bucket, path, uploadUrl })
    return uploadUrl
  }

  /** Credenciais emitidas até agora, para o teste conferir o que foi liberado. */
  get issuedCredentials(): readonly IssuedCredential[] {
    return this.credentials
  }

  /**
   * O papel do navegador no passo 2 de D-05. Recusa uma URL que não tenha
   * sido emitida para exatamente este bucket e caminho, como o armazenamento
   * de verdade recusaria uma assinatura que não bate.
   */
  uploadWithCredential(uploadUrl: string, bucket: string, path: string, file: StoredFile): void {
    const credential = this.credentials.find(
      (issued) =>
        issued.uploadUrl === uploadUrl && issued.bucket === bucket && issued.path === path,
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
