/**
 * Falha vinda do armazenamento, embrulhada antes de subir.
 *
 * Mesma regra do resto da infraestrutura: a mensagem original — que pode
 * citar bucket, caminho ou detalhe interno da API de armazenamento — fica
 * nesta exceção, registrada no log do servidor e respondida como `500` com
 * mensagem fixa. Nada dela atravessa a resposta.
 */
export class StorageOperationError extends Error {
  constructor(operation: string, cause: { message: string }) {
    super(`Falha do armazenamento em "${operation}": ${cause.message}`)
    this.name = 'StorageOperationError'
  }
}
