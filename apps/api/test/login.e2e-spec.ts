import { Controller, Get, HttpStatus } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { OPERATOR_CREDENTIALS_READER } from '../src/modules/auth/domain/operator-credentials-reader.port'
import type {
  OperatorCredentials,
  OperatorCredentialsReader,
} from '../src/modules/auth/domain/operator-credentials-reader.port'
import { hashPassword } from '../src/modules/auth/infrastructure/password-hasher'
import { createAuthTestApp } from './create-auth-test-app'

const OPERATOR_EMAIL = 'operadora@veggiedent.test'
const OPERATOR_PASSWORD = 'senha-forte-do-operador'
const OPERATOR: OperatorCredentials = {
  id: '22222222-3333-4444-5555-666666666666',
  email: OPERATOR_EMAIL,
  passwordHash: '',
}

/** Rota-sonda protegida, só para provar que o token devolvido pelo login é aceito pela guarda global. */
@Controller('admin/sonda-de-login')
class SondaDeLoginController {
  @Get()
  ok(): { ok: true } {
    return { ok: true }
  }
}

function fakeCredentialsReader(operator: OperatorCredentials | null): OperatorCredentialsReader {
  return { findByEmail: jest.fn().mockResolvedValue(operator) }
}

describe('POST /api/auth/login (SDD § D-03, § C-02)', () => {
  let app: INestApplication
  let operatorComHash: OperatorCredentials

  beforeAll(async () => {
    operatorComHash = { ...OPERATOR, passwordHash: await hashPassword(OPERATOR_PASSWORD) }
  })

  afterEach(async () => {
    await app?.close()
  })

  async function startAppWith(operator: OperatorCredentials | null): Promise<INestApplication> {
    return createAuthTestApp({ controllers: [SondaDeLoginController] }, [
      { provide: OPERATOR_CREDENTIALS_READER, useValue: fakeCredentialsReader(operator) },
    ])
  }

  it('credenciais válidas devolvem um token aceito pela guarda em rota protegida', async () => {
    app = await startAppWith(operatorComHash)

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: OPERATOR_EMAIL, password: OPERATOR_PASSWORD })

    expect(login.status).toBe(HttpStatus.OK)
    expect(login.body).toEqual({
      accessToken: expect.any(String),
      expiresInSeconds: expect.any(Number),
    })

    const protegida = await request(app.getHttpServer())
      .get('/api/admin/sonda-de-login')
      .set('Authorization', `Bearer ${login.body.accessToken}`)

    expect(protegida.status).toBe(HttpStatus.OK)
    expect(protegida.body).toEqual({ ok: true })
  })

  it('e-mail inexistente responde 401 genérico', async () => {
    app = await startAppWith(null)

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ninguem@veggiedent.test', password: 'qualquer-coisa' })

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(response.body).toEqual({ statusCode: 401, error: 'Autenticação necessária.' })
  })

  it('senha incorreta responde exatamente o mesmo 401 genérico', async () => {
    app = await startAppWith(operatorComHash)

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: OPERATOR_EMAIL, password: 'senha-errada' })

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(response.body).toEqual({ statusCode: 401, error: 'Autenticação necessária.' })
  })

  it('corpo inválido (sem e-mail de verdade) responde 422, não 401', async () => {
    app = await startAppWith(null)

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nao-e-um-email', password: 'x' })

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(response.body.fields).toEqual({ email: 'Informe um e-mail válido.' })
  })

  it('o endpoint de login é público — não exige token', async () => {
    app = await startAppWith(operatorComHash)

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: OPERATOR_EMAIL, password: OPERATOR_PASSWORD })

    expect(response.status).not.toBe(HttpStatus.UNAUTHORIZED)
  })
})
