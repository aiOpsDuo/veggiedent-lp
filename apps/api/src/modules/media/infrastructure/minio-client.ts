import { Client } from 'minio'
import type { Environment } from '../../../config/environment.schema'

/** Token de injeção do cliente MinIO. Só a infraestrutura deste módulo o injeta. */
export const MINIO_CLIENT = Symbol('MinioClient')

/**
 * A fatia da API do cliente `minio` que `MinioMediaStorage` de fato usa.
 *
 * Uma interface própria, mais estreita que a classe `Client` inteira do
 * pacote — mesmo espírito das portas do domínio (ISP): o que torna o
 * adaptador testável sem um MinIO de verdade é depender só disto. Um dublê de
 * teste implementa meia dúzia de métodos, não a superfície inteira do
 * cliente. A classe `Client` real satisfaz esta interface estruturalmente,
 * sem qualquer adaptação — é só um tipo mais estreito para o mesmo objeto.
 */
export interface MinioObjectStorageClient {
  presignedPutObject(
    bucketName: string,
    objectName: string,
    expirySeconds?: number,
  ): Promise<string>
  statObject(
    bucketName: string,
    objectName: string,
  ): Promise<{ size: number; metaData: Record<string, string> }>
  removeObject(bucketName: string, objectName: string): Promise<void>
  bucketExists(bucketName: string): Promise<boolean>
  makeBucket(bucketName: string, region?: string): Promise<void>
  setBucketPolicy(bucketName: string, policy: string): Promise<void>
}

/**
 * Região fixa e arbitrária. O MinIO não federa regiões como o S3 real, mas o
 * protocolo de assinatura (SigV4) exige uma. Qualquer string funciona — esta é
 * a mesma usada nos exemplos oficiais do MinIO e do `minio-js`.
 */
const REGION = 'us-east-1'

/**
 * Cliente MinIO do servidor, para o módulo de mídia (SDD § D-05).
 *
 * `MINIO_ENDPOINT` chega validado como URL completa (`environment.schema.ts`),
 * mas o construtor do `minio` pede host, porta e protocolo separados — daí o
 * `new URL(...)` para desmontar.
 */
export function createMinioClient(environment: Environment): MinioObjectStorageClient {
  const endpoint = new URL(environment.MINIO_ENDPOINT)
  const useSSL = endpoint.protocol === 'https:'
  return new Client({
    endPoint: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : useSSL ? 443 : 80,
    useSSL,
    accessKey: environment.MINIO_ROOT_USER,
    secretKey: environment.MINIO_ROOT_PASSWORD,
    region: REGION,
  })
}
