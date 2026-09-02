import { UnauthorizedException } from '@nestjs/common'
import type { AuthenticatedOperator } from '../domain/authenticated-operator'

/**
 * Afirma, no tipo, que a requisição passou pela guarda autenticada.
 *
 * `@CurrentOperator()` é `undefined` em endpoint `@Public()`, e o tipo diz isso
 * de propósito (T5). Em endpoint administrativo o valor sempre existe — mas a
 * alternativa a esta função seria mentir no tipo do parâmetro, e aí o dia em
 * que alguém marcasse um controller administrativo com `@Public()` a gravação
 * aconteceria com `operator.id` valendo `undefined`, sem nenhum aviso.
 */
export function requireOperator(
  operator: AuthenticatedOperator | undefined,
): AuthenticatedOperator {
  if (operator === undefined) {
    throw new UnauthorizedException()
  }
  return operator
}
