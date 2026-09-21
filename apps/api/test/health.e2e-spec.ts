import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { MINIO_CLIENT } from '../src/modules/media/infrastructure/minio-client'
import { createTestApp } from './create-test-app'
import { FakeMinioClient } from './fake-storage'

describe('GET /api/health', () => {
  let app: INestApplication

  beforeAll(async () => {
    // `MinioMediaStorage` (`MediaModule`) verifica o bucket ao subir
    // (`OnModuleInit`); sem um dublê aqui, a suíte tentaria alcançar um MinIO
    // de verdade só para exercitar a sonda de saúde, que não depende de mídia.
    app = await createTestApp({}, {}, [{ provide: MINIO_CLIENT, useValue: new FakeMinioClient() }])
  })

  afterAll(async () => {
    await app.close()
  })

  it('responde 200 com o estado do processo', async () => {
    const response = await request(app.getHttpServer()).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })

  it('não atende fora do prefixo /api', async () => {
    const response = await request(app.getHttpServer()).get('/health')

    expect(response.status).toBe(404)
  })
})
