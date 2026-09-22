import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ENVIRONMENT } from '../../../config/environment'
import type { Environment } from '../../../config/environment.schema'
import { StorageOperationError } from '../../../shared/infrastructure/storage-operation.error'
import { MEDIA_KIND_POLICIES, policyForBucket, type MediaKind } from '../domain/media-kind'
import type {
  MediaStorage,
  StoredObject,
  UploadCredential,
} from '../domain/media-storage.port'
import type { UploadTarget } from '../domain/upload-plan'
import { MINIO_CLIENT, type MinioObjectStorageClient } from './minio-client'

/**
 * Validade da credencial de upload. Mesma janela de duas horas que o Supabase
 * usava (SDD § D-05): trocar de armazenamento não muda o tempo que o operador
 * tem para concluir o envio, só o protocolo pelo qual ele acontece.
 */
const CREDENTIAL_LIFETIME_SECONDS = 2 * 60 * 60

/**
 * Código que o cliente `minio` atribui a uma resposta HTTP 404 — inclusive a
 * de um `HEAD` sem corpo, como o que `statObject` faz (`minio-js`,
 * `internal/xml-parser.ts#parseResponseError`). Não é um código de erro do S3
 * (`NoSuchKey`): é sintetizado pelo cliente porque uma resposta a `HEAD` nunca
 * tem XML de erro para interpretar.
 */
const NOT_FOUND_CODE = 'NotFound'

function isNotFound(error: unknown): boolean {
  return (error as { code?: string }).code === NOT_FOUND_CODE
}

/**
 * Nome real do bucket no MinIO, por natureza de mídia.
 *
 * `MediaKindPolicy.bucket` (`veggiedent-images`/`veggiedent-videos`, em
 * `media-kind.ts`) é um identificador de **domínio**, gravado em
 * `media_assets.storage_path` — o mesmo valor em todo ambiente, porque é o que
 * dá sentido a `storage-path.ts` e à conciliação de arquivos órfãos (R-04).
 *
 * O bucket **real** no MinIO vem de `MINIO_BUCKET_IMAGES`/
 * `MINIO_BUCKET_VIDEOS`: variáveis de ambiente deliberadamente separadas do
 * nome de domínio, para que um ambiente pudesse, em tese, apontar para um
 * bucket físico com outro nome sem mexer em `media-kind.ts`. Na prática, hoje,
 * `docker-compose.yml` e `apps/api/test/setup-environment.ts` usam
 * exatamente os mesmos dois nomes que o domínio declara — é o contrato que
 * este arquivo espera: um ambiente que configurar um nome diferente aqui
 * ainda funciona (a tradução abaixo cobre isso), mas só o bucket
 * *configurado* nasce com política pública em `onModuleInit`.
 *
 * Decisão explícita, não prevista no plano original: cogitei fazer
 * `media-kind.ts` ler o nome do bucket do ambiente, mas isso vazaria
 * configuração de infraestrutura para o domínio (nada em `domain/` importa
 * `config/` ou framework — regra já declarada em `media.module.ts`). Mantendo
 * a tradução só aqui, na infraestrutura, o domínio continua descrevendo uma
 * política de negócio (qual bucket lógico cada natureza usa), e só o
 * adaptador que fala com o MinIO precisa saber o nome físico configurado.
 */
function actualBucketNameFor(kind: MediaKind, environment: Environment): string {
  return kind === 'image' ? environment.MINIO_BUCKET_IMAGES : environment.MINIO_BUCKET_VIDEOS
}

/**
 * Política de leitura pública e anônima do bucket — o mesmo efeito que os
 * buckets `public: true` do Supabase Storage tinham. Formato padrão de
 * política de bucket S3/MinIO (`Version` fixo em `2012-10-17`, o mesmo de toda
 * documentação oficial da AWS e do MinIO).
 */
function publicReadPolicy(bucket: string): Record<string, unknown> {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  }
}

/**
 * Armazenamento de mídia sobre o MinIO (SDD § D-05, reescrita em 2026-09-21).
 * Substitui `supabase-media-storage.ts`.
 *
 * Único ponto do sistema que fala com o MinIO, e o faz com a chave de
 * acesso do servidor — que **não sai daqui**. O navegador recebe apenas a URL
 * `PUT` pré-assinada emitida por `createUploadCredential`, válida para um
 * caminho, em um bucket, por tempo limitado.
 *
 * Nenhum método transfere bytes: emite credencial, pergunta o que existe,
 * calcula endereço público e apaga — mesma regra de `MediaStorage`.
 *
 * **Bootstrap dos buckets, decisão não prevista no plano original.** O
 * Supabase original criava os buckets por migração SQL, versionada em
 * `supabase/migrations/` e aplicada antes de qualquer subida da API. O MinIO
 * não tem mecanismo de migração equivalente para buckets. Em vez de exigir um
 * passo manual documentado (fácil de esquecer num ambiente novo — a mesma
 * "armadilha" que D-09 registra para o primeiro operador), `onModuleInit`
 * garante os dois buckets a cada subida da API: cria o que faltar e aplica a
 * política de leitura pública, de forma idempotente. Documentado também em
 * `docs/BANCO-DE-DADOS.md`.
 */
@Injectable()
export class MinioMediaStorage implements MediaStorage, OnModuleInit {
  private readonly logger = new Logger(MinioMediaStorage.name)

  constructor(
    @Inject(MINIO_CLIENT) private readonly client: MinioObjectStorageClient,
    @Inject(ENVIRONMENT) private readonly environment: Environment,
  ) {}

  /**
   * Sequencial, de propósito — não `Promise.all`. São só dois buckets, uma
   * vez por subida do processo: o custo de serializar as duas chamadas é
   * irrelevante. Verificado contra o MinIO real do compose durante esta
   * tarefa: as duas chamadas de `setBucketPolicy` **concorrentes** sobre o
   * mesmo cliente produziram, de forma intermitente, `IncompleteBody` do
   * servidor (`S3Error`/`code: 'IncompleteBody'`) — não reproduz sequencial.
   */
  async onModuleInit(): Promise<void> {
    for (const policy of Object.values(MEDIA_KIND_POLICIES)) {
      await this.ensurePublicBucket(actualBucketNameFor(policy.kind, this.environment))
    }
  }

  async createUploadCredential(target: UploadTarget): Promise<UploadCredential> {
    const bucket = actualBucketNameFor(target.policy.kind, this.environment)
    const uploadUrl = await this.client.presignedPutObject(
      bucket,
      target.path,
      CREDENTIAL_LIFETIME_SECONDS,
    )
    return { uploadUrl: this.toPublicUrl(uploadUrl), expiresInSeconds: CREDENTIAL_LIFETIME_SECONDS }
  }

  /**
   * Ausência do arquivo é resposta, não falha: é o caso de um upload que não
   * chegou ao fim. Qualquer outro erro sobe — tratar indisponibilidade do
   * armazenamento como "arquivo não existe" faria a API recusar uma confirmação
   * legítima dizendo a coisa errada.
   */
  async findObject(bucket: string, path: string): Promise<StoredObject | null> {
    try {
      const stat = await this.client.statObject(this.resolveBucket(bucket), path)
      return { sizeBytes: stat.size, mimeType: stat.metaData['content-type'] ?? null }
    } catch (error) {
      if (isNotFound(error)) {
        return null
      }
      throw new StorageOperationError('consultar arquivo no armazenamento', error as Error)
    }
  }

  publicUrlFor(bucket: string, path: string): string {
    const endpoint = this.environment.MINIO_PUBLIC_URL.replace(/\/+$/, '')
    return `${endpoint}/${this.resolveBucket(bucket)}/${path}`
  }

  /**
   * Troca só a origem (protocolo + host + porta) de uma URL assinada contra
   * `MINIO_ENDPOINT` pela origem pública (`MINIO_PUBLIC_URL`), preservando
   * caminho e query string intactos — é ali que mora a assinatura SigV4
   * (`X-Amz-Signature` e companhia). A assinatura em si não muda: continua
   * válida porque `docker/nginx.conf` (location `/storage/`) devolve, ao
   * MinIO, o mesmo `Host` usado para assiná-la.
   */
  private toPublicUrl(signedUrl: string): string {
    const signed = new URL(signedUrl)
    const publicBase = new URL(this.environment.MINIO_PUBLIC_URL)
    const publicPathPrefix = publicBase.pathname.replace(/\/+$/, '')
    return `${publicBase.origin}${publicPathPrefix}${signed.pathname}${signed.search}`
  }

  async remove(bucket: string, path: string): Promise<void> {
    try {
      await this.client.removeObject(this.resolveBucket(bucket), path)
    } catch (error) {
      throw new StorageOperationError('remover arquivo do armazenamento', error as Error)
    }
  }

  /** Traduz o bucket de domínio (gravado em `storage_path`) para o bucket real. */
  private resolveBucket(domainBucket: string): string {
    const policy = policyForBucket(domainBucket)
    if (policy === undefined) {
      throw new Error(`Bucket de mídia desconhecido: ${domainBucket}`)
    }
    return actualBucketNameFor(policy.kind, this.environment)
  }

  private async ensurePublicBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket)
    if (!exists) {
      await this.client.makeBucket(bucket)
      this.logger.log(`Bucket "${bucket}" criado no MinIO.`)
    }
    await this.client.setBucketPolicy(bucket, JSON.stringify(publicReadPolicy(bucket)))
  }
}
