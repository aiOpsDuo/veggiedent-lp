import { HttpException, HttpStatus } from '@nestjs/common'
import { FieldValidationError } from '../domain/field-validation.error'
import {
  type OperatorRemovalReason,
  OperatorRemovalRefusedError,
} from '../domain/operator-removal-refused.error'
import { ResourceInUseError } from '../domain/resource-in-use.error'
import { ResourceNotFoundError } from '../domain/resource-not-found.error'
import type { ErrorResponse } from './error-response'
import { INTERNAL_ERROR_MESSAGE, messageForStatus } from './error-messages'

/**
 * Mensagens seguras para as duas recusas de R-10. Diferente do `409` genérico
 * de `ResourceInUseError` (que nunca diz o quê, para não descrever conteúdo
 * publicado), aqui não há nada sensível a esconder — "não pode remover a si
 * mesmo" e "não pode remover o último operador" são a própria explicação, e o
 * SDD (§ C-13) pede um erro claro. Fixas por `reason`, nunca a partir da
 * mensagem da exceção: a mesma disciplina de nunca deixar o texto do domínio
 * atravessar a resposta sem passar por este dicionário controlado.
 */
const OPERATOR_REMOVAL_MESSAGE_BY_REASON: Readonly<Record<OperatorRemovalReason, string>> = {
  self: 'Um operador não pode remover a própria conta.',
  'last-operator': 'Não é possível remover o último operador restante.',
}

/**
 * Traduz qualquer exceção para o formato único de erro. É pura de propósito:
 * a garantia de que nenhum detalhe interno vaza é verificável sem subir HTTP.
 */
export function toErrorResponse(exception: unknown): ErrorResponse {
  if (exception instanceof FieldValidationError) {
    return {
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: messageForStatus(HttpStatus.UNPROCESSABLE_ENTITY),
      fields: { ...exception.fields },
    }
  }

  if (exception instanceof ResourceNotFoundError) {
    const status = HttpStatus.NOT_FOUND
    return { statusCode: status, error: messageForStatus(status) }
  }

  if (exception instanceof ResourceInUseError) {
    const status = HttpStatus.CONFLICT
    return { statusCode: status, error: messageForStatus(status) }
  }

  if (exception instanceof OperatorRemovalRefusedError) {
    return {
      statusCode: HttpStatus.CONFLICT,
      error: OPERATOR_REMOVAL_MESSAGE_BY_REASON[exception.reason],
    }
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus()
    return { statusCode: status, error: messageForStatus(status) }
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: INTERNAL_ERROR_MESSAGE,
  }
}
