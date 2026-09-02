import type { ZodIssue } from 'zod'
import { environmentSchema, type Environment } from './environment.schema'

/** Token de injeção do ambiente já validado. */
export const ENVIRONMENT = Symbol('Environment')

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvironmentValidationError'
  }
}

const HEADLINE =
  'Configuração de ambiente inválida — a API não vai subir. Corrija as variáveis abaixo em apps/api/.env (modelo em apps/api/.env.example):'

const MISSING_REASON = 'variável obrigatória ausente.'
const FALLBACK_REASON = 'valor inválido.'

const REASON_BY_ISSUE_CODE: Readonly<Record<string, string>> = {
  invalid_type: 'valor de tipo inesperado.',
  invalid_format: 'valor fora do formato esperado.',
  invalid_value: 'valor fora do conjunto aceito.',
  too_small: 'valor abaixo do mínimo aceito.',
  too_big: 'valor acima do máximo aceito.',
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

/** Descreve o problema sem nunca imprimir o valor — pode ser uma credencial. */
function describeIssue(issue: ZodIssue, source: Record<string, unknown>): string {
  const name = String(issue.path[0] ?? 'variável desconhecida')
  const reason = isAbsent(source[name])
    ? MISSING_REASON
    : (REASON_BY_ISSUE_CODE[issue.code] ?? FALLBACK_REASON)
  return `  - ${name}: ${reason}`
}

/**
 * Valida o ambiente na inicialização. Lançar aqui impede a aplicação de subir,
 * em vez de deixar a falta de uma variável explodir em tempo de requisição.
 */
export function parseEnvironment(source: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(source)
  if (result.success) {
    return result.data
  }

  const details = result.error.issues
    .map((issue) => describeIssue(issue, source))
    .join('\n')
  throw new EnvironmentValidationError(`${HEADLINE}\n${details}`)
}
