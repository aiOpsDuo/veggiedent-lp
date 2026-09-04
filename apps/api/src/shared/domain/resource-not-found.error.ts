/**
 * Recurso inexistente, dito no vocabulário do domínio.
 *
 * Vive no domínio e não importa framework nenhum: é o que permite a uma regra
 * — "a chave não é uma das 10 seções conhecidas" — recusar sem saber que existe
 * HTTP. A tradução para `404` acontece uma única vez, em
 * `presentation/error-response.factory.ts`, junto da de `FieldValidationError`.
 *
 * O `recurso` existe para o log do servidor. O cliente nunca o vê: a resposta
 * é sempre a mensagem fixa de `404`, para não transformar a API em um oráculo
 * que diferencia "chave inválida" de "chave válida sem registro".
 */
export class ResourceNotFoundError extends Error {
  readonly recurso: string

  constructor(recurso: string) {
    super(`Recurso inexistente: ${recurso}.`)
    this.name = 'ResourceNotFoundError'
    this.recurso = recurso
  }
}
