import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { AuthenticatedOperator } from '../domain/authenticated-operator'
import type { AuthenticatedRequest } from './authenticated-request'

/**
 * Entrega ao handler o operador que a guarda já autenticou.
 *
 * Só é declarável em endpoint protegido: em um endpoint `@Public()` a guarda não
 * autentica ninguém e o valor é `undefined`, o que o tipo deixa explícito.
 */
export const CurrentOperator = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedOperator | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().operator,
)
