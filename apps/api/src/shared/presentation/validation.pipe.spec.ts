import type { ValidationError } from '@nestjs/common'
import { flattenValidationErrors } from './validation.pipe'

function validationError(
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError {
  return { property, constraints, children } as ValidationError
}

describe('flattenValidationErrors', () => {
  it('usa o nome do campo como caminho no primeiro nível', () => {
    const fields = flattenValidationErrors([
      validationError('email', { isEmail: 'Informe um e-mail válido.' }),
    ])

    expect(fields).toEqual({ email: 'Informe um e-mail válido.' })
  })

  it('compõe o caminho de campos aninhados', () => {
    const fields = flattenValidationErrors([
      validationError('hero', undefined, [
        validationError('headline', { isNotEmpty: 'Campo obrigatório.' }),
      ]),
    ])

    expect(fields).toEqual({ 'hero.headline': 'Campo obrigatório.' })
  })

  it('usa a posição como caminho dentro de uma lista', () => {
    const fields = flattenValidationErrors([
      validationError('items', undefined, [
        validationError('0', undefined, [
          validationError('title', { isNotEmpty: 'Campo obrigatório.' }),
        ]),
      ]),
    ])

    expect(fields).toEqual({ 'items.0.title': 'Campo obrigatório.' })
  })

  it('devolve mapa vazio quando não há erro', () => {
    expect(flattenValidationErrors([])).toEqual({})
  })
})
