import { Inject, Injectable } from '@nestjs/common'
import {
  CREDENTIALS_REJECTION_REASONS,
  InvalidCredentialsError,
} from '../domain/invalid-credentials.error'
import {
  OPERATOR_CREDENTIALS_READER,
  type OperatorCredentialsReader,
} from '../domain/operator-credentials-reader.port'
import { TOKEN_ISSUER, type IssuedToken, type TokenIssuer } from '../domain/token-issuer.port'
import { verifyPassword } from '../infrastructure/password-hasher'

export interface LoginInput {
  readonly email: string
  readonly password: string
}

/**
 * Caso de uso "login de operador" (SDD § D-03, § C-02).
 *
 * Busca o operador por e-mail e verifica a senha com argon2id; se qualquer
 * uma das duas etapas falhar, lança o **mesmo** `InvalidCredentialsError` —
 * nunca revela ao chamador (nem, por extensão, à resposta HTTP) qual das duas
 * foi a causa. `presentation/auth.controller.ts` traduz o erro para `401`
 * genérico, sem inspecionar `reason` (que existe só para o log).
 */
@Injectable()
export class LoginOperatorUseCase {
  constructor(
    @Inject(OPERATOR_CREDENTIALS_READER)
    private readonly credentialsReader: OperatorCredentialsReader,
    @Inject(TOKEN_ISSUER) private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<IssuedToken> {
    const operator = await this.credentialsReader.findByEmail(input.email)
    if (operator === null) {
      throw new InvalidCredentialsError(CREDENTIALS_REJECTION_REASONS.emailNaoEncontrado)
    }

    const senhaValida = await verifyPassword(operator.passwordHash, input.password)
    if (!senhaValida) {
      throw new InvalidCredentialsError(CREDENTIALS_REJECTION_REASONS.senhaIncorreta)
    }

    return this.tokenIssuer.issue({ id: operator.id, email: operator.email })
  }
}
