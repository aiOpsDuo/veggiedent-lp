import { ValidationPipe, type ValidationError } from '@nestjs/common'
import { FieldValidationError } from '../domain/field-validation.error'

function firstConstraintMessage(error: ValidationError): string | undefined {
  return error.constraints ? Object.values(error.constraints)[0] : undefined
}

/**
 * Achata os erros do class-validator em `caminho.do.campo -> mensagem`, que é a
 * forma do campo `fields` do formato único de erro.
 */
export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath = '',
): Record<string, string> {
  const fields: Record<string, string> = {}

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property
    const message = firstConstraintMessage(error)
    if (message) {
      fields[path] = message
    }
    if (error.children?.length) {
      Object.assign(fields, flattenValidationErrors(error.children, path))
    }
  }

  return fields
}

/**
 * Pipe global de validação. Responde `422`, e não o `400` padrão do NestJS,
 * porque é o status que o SDD atribui a dados inválidos.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new FieldValidationError(flattenValidationErrors(errors)),
  })
}
