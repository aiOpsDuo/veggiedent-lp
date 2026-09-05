import {
  EnvironmentValidationError,
  parseEnvironment,
} from './environment'
import { DEFAULT_PORT } from './environment.schema'

const validEnvironment = {
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_ficticia',
  SUPABASE_JWKS_URL: 'https://projeto.supabase.co/auth/v1/.well-known/jwks.json',
  ALLOWED_ORIGINS: 'http://localhost:5173',
}

describe('parseEnvironment', () => {
  it('devolve o ambiente tipado, com os valores opcionais em seus padrões', () => {
    const environment = parseEnvironment({ ...validEnvironment })

    expect(environment.NODE_ENV).toBe('development')
    expect(environment.PORT).toBe(DEFAULT_PORT)
    expect(environment.SUPABASE_URL).toBe(validEnvironment.SUPABASE_URL)
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
    const { SUPABASE_SECRET_KEY, ...semSegredo } = validEnvironment

    expect(() => parseEnvironment(semSegredo)).toThrow(EnvironmentValidationError)
    expect(() => parseEnvironment(semSegredo)).toThrow(
      /SUPABASE_SECRET_KEY: variável obrigatória ausente\./,
    )
  })

  it('trata variável obrigatória vazia como ausente', () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, ALLOWED_ORIGINS: '' }),
    ).toThrow(/ALLOWED_ORIGINS: variável obrigatória ausente\./)
  })

  it('acusa formato inválido sem imprimir o valor recebido', () => {
    const segredoDoUsuario = 'sb_secret_valor_que_nao_pode_vazar'

    try {
      parseEnvironment({
        ...validEnvironment,
        SUPABASE_SECRET_KEY: segredoDoUsuario,
        SUPABASE_URL: 'nao-e-uma-url',
      })
      throw new Error('parseEnvironment deveria ter recusado o ambiente.')
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError)
      const message = (error as Error).message
      expect(message).toMatch(/SUPABASE_URL: valor fora do formato esperado\./)
      expect(message).not.toContain('nao-e-uma-url')
      expect(message).not.toContain(segredoDoUsuario)
    }
  })

  it('lista todas as variáveis com problema, não só a primeira', () => {
    expect(() => parseEnvironment({})).toThrow(
      expect.objectContaining({
        message: expect.stringContaining('SUPABASE_URL'),
      }),
    )
    expect(() => parseEnvironment({})).toThrow(/SUPABASE_JWKS_URL/)
    expect(() => parseEnvironment({})).toThrow(/ALLOWED_ORIGINS/)
  })
})
