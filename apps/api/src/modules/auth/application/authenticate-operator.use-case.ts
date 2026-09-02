import { Inject, Injectable } from '@nestjs/common'
import type { AuthenticatedOperator } from '../domain/authenticated-operator'
import {
  InvalidTokenError,
  TOKEN_REJECTION_REASONS,
} from '../domain/invalid-token.error'
import {
  TOKEN_VERIFIER,
  type TokenVerifier,
} from '../domain/token-verifier.port'

/**
 * Caso de uso "autenticar o operador de uma requisição".
 *
 * É a fronteira que a apresentação enxerga: a guarda entrega um token e recebe
 * um operador ou um `InvalidTokenError` — nunca um erro de biblioteca. É também
 * onde entram as regras de autorização quando o CMS ganhar papéis; hoje não há
 * papéis (SDD § D-03), então autenticar é a regra inteira.
 */
@Injectable()
export class AuthenticateOperatorUseCase {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier,
  ) {}

  async execute(token: string): Promise<AuthenticatedOperator> {
    if (token.length === 0) {
      throw new InvalidTokenError(TOKEN_REJECTION_REASONS.ausente)
    }
    return this.tokenVerifier.verify(token)
  }
}
