import type { AuthenticatedOperator } from '../domain/authenticated-operator'
import { InvalidTokenError } from '../domain/invalid-token.error'
import type { TokenVerifier } from '../domain/token-verifier.port'
import { AuthenticateOperatorUseCase } from './authenticate-operator.use-case'

const OPERATOR: AuthenticatedOperator = { id: 'operadora-1' }

describe('AuthenticateOperatorUseCase', () => {
  it('devolve o operador que o verificador reconheceu', async () => {
    const verifier: TokenVerifier = { verify: jest.fn().mockResolvedValue(OPERATOR) }

    await expect(
      new AuthenticateOperatorUseCase(verifier).execute('token'),
    ).resolves.toEqual(OPERATOR)
    expect(verifier.verify).toHaveBeenCalledWith('token')
  })

  it('recusa token vazio sem consultar a infraestrutura', async () => {
    const verifier: TokenVerifier = { verify: jest.fn() }

    await expect(
      new AuthenticateOperatorUseCase(verifier).execute(''),
    ).rejects.toBeInstanceOf(InvalidTokenError)
    expect(verifier.verify).not.toHaveBeenCalled()
  })
})
