import {
  EnvironmentValidationError,
  parseEnvironment,
} from './environment'
import { DEFAULT_PORT } from './environment.schema'

const validEnvironment = {
  DATABASE_URL: 'mysql://veggiedent_app:senha-ficticia@localhost:3306/veggiedent',
  MINIO_ENDPOINT: 'http://localhost:9000',
  MINIO_PUBLIC_URL: 'http://localhost:9000',
  MINIO_ROOT_USER: 'minioadmin-ficticio',
  MINIO_ROOT_PASSWORD: 'minioadmin-senha-ficticia',
  MINIO_BUCKET_IMAGES: 'veggiedent-images',
  MINIO_BUCKET_VIDEOS: 'veggiedent-videos',
  AUTH_JWT_SECRET: 'segredo-ficticio-com-pelo-menos-32-caracteres',
  ALLOWED_ORIGINS: 'http://localhost:5173',
}

describe('parseEnvironment', () => {
  it('devolve o ambiente tipado, com os valores opcionais em seus padrões', () => {
    const environment = parseEnvironment({ ...validEnvironment })

    expect(environment.NODE_ENV).toBe('development')
    expect(environment.PORT).toBe(DEFAULT_PORT)
    expect(environment.DATABASE_URL).toBe(validEnvironment.DATABASE_URL)
  })

  it('converte a porta para número', () => {
    const environment = parseEnvironment({ ...validEnvironment, PORT: '4000' })

    expect(environment.PORT).toBe(4000)
  })

  it('descarta variáveis que não pertencem ao contrato do ambiente', () => {
    const environment = parseEnvironment({
      ...validEnvironment,
      VARIAVEL_ALHEIA: 'valor',
    })

    expect(environment).not.toHaveProperty('VARIAVEL_ALHEIA')
  })

  it('recusa subir e nomeia a variável obrigatória ausente', () => {
    const { AUTH_JWT_SECRET, ...semSegredo } = validEnvironment

    expect(() => parseEnvironment(semSegredo)).toThrow(EnvironmentValidationError)
    expect(() => parseEnvironment(semSegredo)).toThrow(
      /AUTH_JWT_SECRET: variável obrigatória ausente\./,
    )
  })

  it('trata variável obrigatória vazia como ausente', () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, ALLOWED_ORIGINS: '' }),
    ).toThrow(/ALLOWED_ORIGINS: variável obrigatória ausente\./)
  })

  it('acusa formato inválido sem imprimir o valor recebido', () => {
    const segredoDoUsuario = 'segredo-jwt-que-nao-pode-vazar-em-mensagem-de-erro'

    try {
      parseEnvironment({
        ...validEnvironment,
        AUTH_JWT_SECRET: segredoDoUsuario,
        MINIO_ENDPOINT: 'nao-e-uma-url',
      })
      throw new Error('parseEnvironment deveria ter recusado o ambiente.')
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      const message = (error as Error).message
      expect(message).toMatch(/MINIO_ENDPOINT: valor fora do formato esperado\./)
      expect(message).not.toContain('nao-e-uma-url')
      expect(message).not.toContain(segredoDoUsuario)
    }
  })

  it('lista todas as variáveis com problema, não só a primeira', () => {
    expect(() => parseEnvironment({})).toThrow(
      expect.objectContaining({
        message: expect.stringContaining('DATABASE_URL'),
      }),
    )
    expect(() => parseEnvironment({})).toThrow(/MINIO_ENDPOINT/)
    expect(() => parseEnvironment({})).toThrow(/ALLOWED_ORIGINS/)
  })
})
