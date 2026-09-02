import { ValidationPipe, type ValidationError } from '@nestjs/common'
import { FieldValidationError } from '../domain/field-validation.error'
import { INVALID_DATA_MESSAGE } from './error-messages'

/**
 * Mensagens que o class-validator produz sozinho, sem passar por decorador —
 * e portanto em inglês, por mais que todo decorador do projeto declare a sua.
 * `whitelistValidation` é a de `forbidNonWhitelisted`. Traduzi-las aqui é o que
 * garante que **nenhuma** mensagem em inglês chegue ao operador; o teste de
 * guarda em `test/mensagens-em-portugues.spec.ts` impede a regressão.
 */
const BUILT_IN_CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
  whitelistValidation: 'Campo desconhecido nesta requisição.',
  unknownValue: 'Não foi possível ler o corpo da requisição.',
  nestedValidation: INVALID_DATA_MESSAGE,
}

function firstConstraintMessage(error: ValidationError): string | undefined {
  if (!error.constraints) {
    return undefined
  }
  const [name, message] = Object.entries(error.constraints)[0] as [string, string]
  return BUILT_IN_CONSTRAINT_MESSAGES[name] ?? message
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
