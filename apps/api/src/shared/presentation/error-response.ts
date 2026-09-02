/**
 * Formato único de erro da API (SDD § "Contratos de dados/API/interfaces").
 * Nenhuma rota responde erro em outro formato.
 */
export interface ErrorResponse {
  statusCode: number
  error: string
  fields?: Record<string, string>
}
