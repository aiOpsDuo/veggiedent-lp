import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp } from './create-test-app'

describe('GET /api/health', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
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
