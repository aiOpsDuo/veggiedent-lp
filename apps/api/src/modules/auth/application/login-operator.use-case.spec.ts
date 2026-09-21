import { InvalidCredentialsError } from '../domain/invalid-credentials.error'
import type {
  OperatorCredentials,
  OperatorCredentialsReader,
} from '../domain/operator-credentials-reader.port'
import type { IssuedToken, OperatorClaims, TokenIssuer } from '../domain/token-issuer.port'
import { hashPassword } from '../infrastructure/password-hasher'
import { LoginOperatorUseCase } from './login-operator.use-case'

const OPERATOR: OperatorCredentials = {
  id: 'operadora-1',
  email: 'operadora@veggiedent.test',
  passwordHash: '',
}
const SENHA_CORRETA = 'senha-correta-do-operador'
const TOKEN: IssuedToken = { accessToken: 'token-assinado', expiresInSeconds: 3600 }

async function operatorWithRealHash(): Promise<OperatorCredentials> {
  return { ...OPERATOR, passwordHash: await hashPassword(SENHA_CORRETA) }
}

function fakeReader(operator: OperatorCredentials | null): OperatorCredentialsReader {
  return { findByEmail: jest.fn().mockResolvedValue(operator) }
}

function fakeIssuer(): TokenIssuer {
  return { issue: jest.fn().mockResolvedValue(TOKEN) }
}

describe('LoginOperatorUseCase', () => {
  it('devolve o token quando e-mail e senha conferem', async () => {
    const operator = await operatorWithRealHash()
    const reader = fakeReader(operator)
    const issuer = fakeIssuer()

    const result = await new LoginOperatorUseCase(reader, issuer).execute({
      email: operator.email,
      password: SENHA_CORRETA,
    })

    expect(result).toEqual(TOKEN)
    expect(reader.findByEmail).toHaveBeenCalledWith(operator.email)
    expect(issuer.issue).toHaveBeenCalledWith({
      id: operator.id,
      email: operator.email,
    } satisfies OperatorClaims)
  })

  it('recusa e-mail inexistente sem consultar senha nenhuma', async () => {
    const reader = fakeReader(null)
    const issuer = fakeIssuer()

    await expect(
      new LoginOperatorUseCase(reader, issuer).execute({
        email: 'ninguem@veggiedent.test',
        password: 'qualquer-coisa',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(issuer.issue).not.toHaveBeenCalled()
  })

  it('recusa senha incorreta', async () => {
    const operator = await operatorWithRealHash()
    const reader = fakeReader(operator)
    const issuer = fakeIssuer()

    await expect(
      new LoginOperatorUseCase(reader, issuer).execute({
        email: operator.email,
        password: 'senha-errada',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
    expect(issuer.issue).not.toHaveBeenCalled()
  })

  /**
   * SDD § C-02: "com inválidas, recusa sem revelar se o e-mail existe". A
   * garantia observável é o mesmo *tipo* de erro (o controller o traduz para o
   * mesmo 401 nos dois casos) — não basta comparar a mensagem, já que
   * `Error.message` aqui é só o `reason` interno, nunca exposto ao cliente.
   */
  it('e-mail inexistente e senha incorreta lançam o mesmo tipo de erro', async () => {
    const operator = await operatorWithRealHash()
    const issuer = fakeIssuer()

    const porEmail = new LoginOperatorUseCase(fakeReader(null), issuer).execute({
      email: 'ninguem@veggiedent.test',
      password: 'qualquer-coisa',
    })
    const porSenha = new LoginOperatorUseCase(fakeReader(operator), issuer).execute({
      email: operator.email,
      password: 'senha-errada',
    })

    const [erroEmail, erroSenha] = await Promise.allSettled([porEmail, porSenha])
    expect(erroEmail.status).toBe('rejected')
    expect(erroSenha.status).toBe('rejected')
    expect((erroEmail as PromiseRejectedResult).reason).toBeInstanceOf(InvalidCredentialsError)
    expect((erroSenha as PromiseRejectedResult).reason).toBeInstanceOf(InvalidCredentialsError)
  })
})
