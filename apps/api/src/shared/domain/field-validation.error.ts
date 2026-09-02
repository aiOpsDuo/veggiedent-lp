/**
 * Erro de validação por campo. Vive no domínio e não importa framework nenhum:
 * é o que permite que a validação de conteúdo (T6) e o pipe de validação HTTP
 * produzam a mesma resposta sem que o domínio conheça HTTP.
 *
 * A chave de `fields` é o caminho do campo (ex.: `hero.headline`).
 */
export type FieldErrors = Readonly<Record<string, string>>

export class FieldValidationError extends Error {
  readonly fields: FieldErrors

  constructor(fields: FieldErrors) {
    super('Dados inválidos.')
    this.name = 'FieldValidationError'
    this.fields = fields
  }
}
