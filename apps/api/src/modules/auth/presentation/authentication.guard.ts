import {
  Injectable,
  Logger,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthenticateOperatorUseCase } from '../application/authenticate-operator.use-case'
import {
  InvalidTokenError,
  TOKEN_REJECTION_REASONS,
  type TokenRejectionReason,
} from '../domain/invalid-token.error'
import type { AuthenticatedRequest } from './authenticated-request'
import { extractBearerToken } from './bearer-token'
import { IS_PUBLIC_KEY } from './public.decorator'

/**
 * Guarda de autenticação, registrada globalmente pelo `AuthModule` (SDD § D-03).
 *
 * Nega por padrão: só passa quem apresenta um token válido ou quem chega a um
 * endpoint marcado com `@Public()`. Toda recusa sai como `401` sem detalhe —
 * distinguir "token expirado" de "assinatura inválida" na resposta entregaria
 * ao atacante um oráculo. O motivo fica no log do servidor, em texto fixo.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticationGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly authenticateOperator: AuthenticateOperatorUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = extractBearerToken(request.headers.authorization)
    if (token === undefined) {
      throw this.reject(TOKEN_REJECTION_REASONS.ausente)
    }

    try {
      request.operator = await this.authenticateOperator.execute(token)
    } catch (error) {
      throw this.reject(
        error instanceof InvalidTokenError
          ? error.reason
          : TOKEN_REJECTION_REASONS.desconhecido,
      )
    }

    return true
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    )
  }

  /** Loga o motivo — nunca o token, nunca um claim — e recusa. */
  private reject(reason: TokenRejectionReason): UnauthorizedException {
    this.logger.warn(`Requisição recusada pela guarda: ${reason}.`)
    return new UnauthorizedException()
  }
}
