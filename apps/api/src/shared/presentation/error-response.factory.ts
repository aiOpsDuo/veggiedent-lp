import { HttpException, HttpStatus } from '@nestjs/common'
import { FieldValidationError } from '../domain/field-validation.error'
import { ResourceInUseError } from '../domain/resource-in-use.error'
import { ResourceNotFoundError } from '../domain/resource-not-found.error'
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

  if (exception instanceof ResourceNotFoundError) {
    const status = HttpStatus.NOT_FOUND
    return { statusCode: status, error: messageForStatus(status) }
  }

  if (exception instanceof ResourceInUseError) {
    const status = HttpStatus.CONFLICT
    return { statusCode: status, error: messageForStatus(status) }
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
