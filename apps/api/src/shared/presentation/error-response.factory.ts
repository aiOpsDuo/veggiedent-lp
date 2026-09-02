import { HttpException, HttpStatus } from '@nestjs/common'
import { FieldValidationError } from '../domain/field-validation.error'
import type { ErrorResponse } from './error-response'
import { INTERNAL_ERROR_MESSAGE, messageForStatus } from './error-messages'

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

  if (exception instanceof HttpException) {
    const status = exception.getStatus()
    return { statusCode: status, error: messageForStatus(status) }
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: INTERNAL_ERROR_MESSAGE,
  }
}
