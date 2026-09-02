/**
 * Remoção recusada porque o recurso está em uso por outro registro.
 *
 * Vive no domínio, ao lado de `ResourceNotFoundError` e `FieldValidationError`,
 * e não importa framework nenhum: a regra "não se apaga o que ainda está sendo
 * usado" é de negócio, e a tradução para `409` acontece uma única vez, em
 * `presentation/error-response.factory.ts`. Fica em `shared/` porque a
 * pergunta se repete além da mídia — a exclusão de lead da T8 e do conteúdo
 * respondem ao mesmo formato de erro.
 *
 * `recurso` e `usedBy` viajam na exceção para o log do servidor. O cliente
 * recebe apenas a mensagem fixa do `409`: a API não descreve o conteúdo
 * publicado a quem apenas tentou apagar um arquivo.
 */
export class ResourceInUseError extends Error {
  readonly recurso: string
  readonly usedBy: readonly string[]

  constructor(recurso: string, usedBy: readonly string[]) {
    super(`Recurso em uso: ${recurso} — referenciado por ${usedBy.join(', ')}.`)
    this.name = 'ResourceInUseError'
    this.recurso = recurso
    this.usedBy = usedBy
  }
}
