import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import type { ErrorResponse } from './error-response'
import { toErrorResponse } from './error-response.factory'

/**
 * Único ponto de saída de erro da API. O detalhe da falha fica no log do
 * servidor; o cliente recebe apenas `{ statusCode, error, fields? }`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorResponse(exception)
    this.logUnexpectedFailure(exception, body)
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body)
  }

  private logUnexpectedFailure(exception: unknown, body: ErrorResponse): void {
    if (body.statusCode < HttpStatus.INTERNAL_SERVER_ERROR) {
      return
    }
    this.logger.error(
      'Falha não tratada ao responder a requisição.',
      exception instanceof Error ? exception.stack : String(exception),
    )
  }
}
