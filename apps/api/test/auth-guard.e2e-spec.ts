import { Controller, Get, HttpStatus, Logger } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import type { AuthenticatedOperator } from '../src/modules/auth/domain/authenticated-operator'
import { issuerFor } from '../src/modules/auth/infrastructure/jwks-token-verifier'
import { CurrentOperator } from '../src/modules/auth/presentation/current-operator.decorator'
import { Public } from '../src/modules/auth/presentation/public.decorator'
import { createTestApp } from './create-test-app'
import {
  createSigningKey,
  signToken,
  startJwksServer,
  type JwksServer,
  type TestSigningKey,
} from './signing-keys'

const OPERATOR_ID = '11111111-2222-3333-4444-555555555555'
const OPERATOR_EMAIL = 'operadora@veggiedent.test'
const AUDIENCE = 'authenticated'
const SECRET_CONTENT = 'rascunho administrativo que ninguém deslogado pode ler'

const issuer = issuerFor(process.env.SUPABASE_URL as string)
const inSeconds = (offset: number): number =>
  Math.floor(Date.now() / 1000) + offset

/**
 * ESTE controller é o coração do critério C-01: "um endpoint administrativo
 * novo, criado sem marcação, nasce protegido".
 *
 * Ele é declarado aqui, no teste, e não existe em `src/`. Ninguém o listou em
 * lugar nenhum, nenhum `@UseGuards` o alcança e nenhum arquivo da aplicação
 * sabe que ele existe — exatamente a situação de quem vai criar um endpoint
 * novo na T6, T7 ou T8 e esquecer de pensar em autenticação.
 *
 * Ele só responde 401 se a guarda for de fato global (`APP_GUARD`). Trocar a
 * guarda global por `@UseGuards(AuthenticationGuard)` aplicado rota a rota nos
 * controllers de `src/` deixaria este endpoint aberto, e este teste falharia —
 * que é a proteção que se quer contra essa regressão.
 */
@Controller('admin/endpoint-recem-criado')
class EndpointRecemCriadoController {
  @Get()
  listar(): { rascunho: string } {
    return { rascunho: SECRET_CONTENT }
  }
}

/** Endpoint protegido de propósito, para o caminho feliz. */
@Controller('admin/sonda-protegida')
class SondaProtegidaController {
  @Get()
  quemSouEu(
    @CurrentOperator() operator: AuthenticatedOperator | undefined,
  ): { operator: AuthenticatedOperator | undefined } {
    return { operator }
  }
}

/** Endpoint liberado de propósito, para provar que o decorador funciona. */
@Public()
@Controller('sonda-publica')
class SondaPublicaController {
  @Get()
  ler(): { publico: true } {
    return { publico: true }
  }
}

describe('guarda global de autenticação', () => {
  let app: INestApplication
  let jwksServer: JwksServer
  let projectKey: TestSigningKey
  let intruderKey: TestSigningKey
  let warned: jest.SpyInstance

  const validClaims = () => ({
    sub: OPERATOR_ID,
    email: OPERATOR_EMAIL,
    aud: AUDIENCE,
    iss: issuer,
    exp: inSeconds(3600),
    iat: inSeconds(-10),
  })

  const get = (path: string, token?: string) => {
    const pending = request(app.getHttpServer()).get(path)
    return token === undefined ? pending : pending.set('Authorization', token)
  }

  beforeAll(async () => {
    projectKey = await createSigningKey('chave-do-projeto')
    intruderKey = await createSigningKey('chave-de-outro-emissor')
    jwksServer = await startJwksServer([projectKey])

    app = await createTestApp(
      {
        controllers: [
          EndpointRecemCriadoController,
          SondaProtegidaController,
          SondaPublicaController,
        ],
      },
      { SUPABASE_JWKS_URL: jwksServer.url },
    )
  })

  afterAll(async () => {
    await app.close()
    await jwksServer.close()
  })

  beforeEach(() => {
    warned = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
  })

  afterEach(() => {
    warned.mockRestore()
  })

  describe('um endpoint novo, criado sem nenhuma marcação', () => {
    it('nasce protegido — responde 401 sem token', async () => {
      const response = await get('/api/admin/endpoint-recem-criado')

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
      expect(response.text).not.toContain(SECRET_CONTENT)
    })

    it('só responde depois que alguém apresenta um token válido', async () => {
      const token = await signToken(projectKey, validClaims())

      const response = await get(
        '/api/admin/endpoint-recem-criado',
        `Bearer ${token}`,
      )

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toEqual({ rascunho: SECRET_CONTENT })
    })
  })

  describe('recusa', () => {
    it('responde 401 sem token', async () => {
      const response = await get('/api/admin/sonda-protegida')

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })

    it('responde 401 com token malformado', async () => {
      const response = await get(
        '/api/admin/sonda-protegida',
        'Bearer isto-nao-e-um-jwt',
      )

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })

    it('responde 401 com token expirado', async () => {
      const token = await signToken(projectKey, {
        ...validClaims(),
        iat: inSeconds(-7200),
        exp: inSeconds(-3600),
      })

      const response = await get('/api/admin/sonda-protegida', `Bearer ${token}`)

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })

    it('responde 401 com token assinado por chave errada', async () => {
      const token = await signToken(intruderKey, validClaims())

      const response = await get('/api/admin/sonda-protegida', `Bearer ${token}`)

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })

    it('responde 401 com token de outro emissor', async () => {
      const token = await signToken(projectKey, {
        ...validClaims(),
        iss: 'https://outro-projeto.supabase.co/auth/v1',
      })

      const response = await get('/api/admin/sonda-protegida', `Bearer ${token}`)

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })

    it('responde 401 com token de outro público', async () => {
      const token = await signToken(projectKey, {
        ...validClaims(),
        aud: 'outro-publico',
      })

      const response = await get('/api/admin/sonda-protegida', `Bearer ${token}`)

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })

    it('responde 401 quando o esquema não é Bearer', async () => {
      const token = await signToken(projectKey, validClaims())

      const response = await get('/api/admin/sonda-protegida', `Basic ${token}`)

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED)
    })
  })

  describe('aceitação', () => {
    it('responde 200 com token válido e entrega o operador ao handler', async () => {
      const token = await signToken(projectKey, validClaims())

      const response = await get('/api/admin/sonda-protegida', `Bearer ${token}`)

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toEqual({
        operator: { id: OPERATOR_ID, email: OPERATOR_EMAIL },
      })
    })

    it('libera endpoint marcado com @Public() sem nenhum token', async () => {
      const response = await get('/api/sonda-publica')

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toEqual({ publico: true })
    })

    it('mantém a sonda de saúde acessível sem token', async () => {
      const response = await get('/api/health')

      expect(response.status).toBe(HttpStatus.OK)
      expect(response.body).toEqual({ status: 'ok' })
    })

    /**
     * O Swagger é montado direto no adaptador HTTP, fora do roteador do NestJS:
     * a guarda global não o alcança e nenhum `@Public()` o cobre. Isso está
     * registrado aqui de propósito, para não ser descoberto como surpresa. Não
     * é exposição: em produção a documentação simplesmente não é publicada
     * (`shouldExposeApiDocs`), e ela descreve rotas, nunca dados.
     */
    it('não bloqueia a documentação, que vive fora do roteador do NestJS', async () => {
      const response = await get('/api/docs')

      expect(response.status).toBe(HttpStatus.OK)
    })
  })

  describe('resposta de recusa', () => {
    it('segue o formato único de erro, sem campo a mais', async () => {
      const response = await get('/api/admin/sonda-protegida')

      expect(response.body).toEqual({
        statusCode: 401,
        error: 'Autenticação necessária.',
      })
      expect(Object.keys(response.body).sort()).toEqual(['error', 'statusCode'])
    })

    it('não distingue os motivos de recusa para o cliente', async () => {
      const expirado = await signToken(projectKey, {
        ...validClaims(),
        exp: inSeconds(-1),
      })
      const chaveErrada = await signToken(intruderKey, validClaims())

      const respostas = [
        await get('/api/admin/sonda-protegida'),
        await get('/api/admin/sonda-protegida', 'Bearer isto-nao-e-um-jwt'),
        await get('/api/admin/sonda-protegida', `Bearer ${expirado}`),
        await get('/api/admin/sonda-protegida', `Bearer ${chaveErrada}`),
      ]

      for (const resposta of respostas) {
        expect(resposta.body).toEqual({
          statusCode: 401,
          error: 'Autenticação necessária.',
        })
      }
    })

    it('não vaza credencial, token nem detalhe interno', async () => {
      const token = await signToken(intruderKey, validClaims())

      const response = await get('/api/admin/sonda-protegida', `Bearer ${token}`)

      expect(response.text).not.toContain(token)
      expect(response.text).not.toContain('SUPABASE')
      expect(response.text).not.toContain('jose')
      expect(response.text).not.toContain('JWKS')
      expect(response.text).not.toContain(jwksServer.url)
      expect(response.text).not.toMatch(/\bat .+:\d+:\d+/)
    })

    it('registra o motivo no log do servidor sem escrever o token', async () => {
      const token = await signToken(projectKey, {
        ...validClaims(),
        exp: inSeconds(-1),
      })

      await get('/api/admin/sonda-protegida', `Bearer ${token}`)

      expect(warned).toHaveBeenCalledWith(
        'Requisição recusada pela guarda: token expirado.',
      )
      for (const [mensagem] of warned.mock.calls) {
        expect(String(mensagem)).not.toContain(token)
      }
    })
  })
})
