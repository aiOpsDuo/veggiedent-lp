import type { Environment } from '../../../config/environment.schema'
import { StorageOperationError } from '../../../shared/infrastructure/storage-operation.error'
import { policyFor } from '../domain/media-kind'
import { planUpload } from '../domain/upload-plan'
import type { MinioObjectStorageClient } from './minio-client'
import { MinioMediaStorage } from './minio-media-storage'

const ENVIRONMENT: Environment = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
  MINIO_ENDPOINT: 'http://localhost:9000',
  MINIO_ROOT_USER: 'minioadmin',
  MINIO_ROOT_PASSWORD: 'minioadmin-secret',
  MINIO_BUCKET_IMAGES: 'veggiedent-images',
  MINIO_BUCKET_VIDEOS: 'veggiedent-videos',
  AUTH_JWT_SECRET: 'segredo-de-teste-com-pelo-menos-32-caracteres',
  ALLOWED_ORIGINS: 'http://localhost:5173',
}

function fakeClient(): jest.Mocked<MinioObjectStorageClient> {
  return {
    presignedPutObject: jest.fn(),
    statObject: jest.fn(),
    removeObject: jest.fn(),
    bucketExists: jest.fn(),
    makeBucket: jest.fn(),
    setBucketPolicy: jest.fn(),
  }
}

class FakeS3NotFoundError extends Error {
  readonly code = 'NotFound'
}

describe('MinioMediaStorage', () => {
  it('emite a credencial pedindo ao cliente o bucket real da natureza, não o nome de domínio', async () => {
    const client = fakeClient()
    client.presignedPutObject.mockResolvedValue('https://minio.local/veggiedent-images/abc/foto.png?assinatura')
    const storage = new MinioMediaStorage(client, ENVIRONMENT)

    const target = planUpload(
      { originalFilename: 'foto.png', contentType: 'image/png', sizeBytes: 1024 },
      'abc',
    )
    const credential = await storage.createUploadCredential(target)

    expect(client.presignedPutObject).toHaveBeenCalledWith(
      ENVIRONMENT.MINIO_BUCKET_IMAGES,
      'abc/foto.png',
      expect.any(Number),
    )
    expect(credential).toEqual({
      uploadUrl: 'https://minio.local/veggiedent-images/abc/foto.png?assinatura',
      expiresInSeconds: expect.any(Number),
    })
    expect(credential.expiresInSeconds).toBeGreaterThan(0)
  })

  it('consulta o objeto e traduz tamanho e tipo, com o bucket real', async () => {
    const client = fakeClient()
    client.statObject.mockResolvedValue({ size: 2048, metaData: { 'content-type': 'image/png' } })
    const storage = new MinioMediaStorage(client, ENVIRONMENT)

    const object = await storage.findObject(policyFor('image').bucket, 'abc/foto.png')

    expect(client.statObject).toHaveBeenCalledWith(ENVIRONMENT.MINIO_BUCKET_IMAGES, 'abc/foto.png')
    expect(object).toEqual({ sizeBytes: 2048, mimeType: 'image/png' })
  })

  it('devolve null quando o objeto não existe — upload não concluído', async () => {
    const client = fakeClient()
    client.statObject.mockRejectedValue(new FakeS3NotFoundError('Object not found'))
    const storage = new MinioMediaStorage(client, ENVIRONMENT)

    const object = await storage.findObject(policyFor('image').bucket, 'abc/foto.png')

    expect(object).toBeNull()
  })

  it('embrulha qualquer outro erro do armazenamento em StorageOperationError', async () => {
    const client = fakeClient()
    client.statObject.mockRejectedValue(new Error('MinIO indisponível'))
    const storage = new MinioMediaStorage(client, ENVIRONMENT)

    await expect(storage.findObject(policyFor('image').bucket, 'abc/foto.png')).rejects.toBeInstanceOf(
      StorageOperationError,
    )
  })

  it('monta a URL pública com o endpoint e o bucket real, não o de domínio', () => {
    const storage = new MinioMediaStorage(fakeClient(), ENVIRONMENT)

    const url = storage.publicUrlFor(policyFor('video').bucket, 'abc/video.mp4')

    expect(url).toBe('http://localhost:9000/veggiedent-videos/abc/video.mp4')
  })

  it('remove o objeto no bucket real', async () => {
    const client = fakeClient()
    client.removeObject.mockResolvedValue(undefined)
    const storage = new MinioMediaStorage(client, ENVIRONMENT)

    await storage.remove(policyFor('image').bucket, 'abc/foto.png')

    expect(client.removeObject).toHaveBeenCalledWith(ENVIRONMENT.MINIO_BUCKET_IMAGES, 'abc/foto.png')
  })

  it('recusa um bucket de domínio desconhecido', async () => {
    const storage = new MinioMediaStorage(fakeClient(), ENVIRONMENT)

    await expect(storage.remove('bucket-inexistente', 'abc/foto.png')).rejects.toThrow(
      'Bucket de mídia desconhecido',
    )
  })

  it('garante os dois buckets na subida: cria o que falta e aplica leitura pública', async () => {
    const client = fakeClient()
    client.bucketExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    client.makeBucket.mockResolvedValue(undefined)
    client.setBucketPolicy.mockResolvedValue(undefined)
    const storage = new MinioMediaStorage(client, ENVIRONMENT)

    await storage.onModuleInit()

    expect(client.makeBucket).toHaveBeenCalledTimes(1)
    expect(client.setBucketPolicy).toHaveBeenCalledTimes(2)
    const [, policyJson] = client.setBucketPolicy.mock.calls[0] as [string, string]
    expect(JSON.parse(policyJson)).toMatchObject({
      Statement: [expect.objectContaining({ Effect: 'Allow', Action: ['s3:GetObject'] })],
    })
  })
})
