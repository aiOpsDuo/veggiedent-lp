import type { Request } from 'express'
import type { AuthenticatedOperator } from '../domain/authenticated-operator'

/**
 * Requisição depois da guarda. `operator` só existe quando a guarda deixou
 * passar por token válido — em endpoint marcado com `@Public()` ele é ausente.
 */
export interface AuthenticatedRequest extends Request {
  operator?: AuthenticatedOperator
}
