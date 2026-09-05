import type { OperatorAccount } from '../domain/operator-account'
import { fallbackName, toOperatorView } from './operator-view'

/**
 * O fallback de nome (SDD § D-09, revista na T34): um operador criado antes
 * de `user_metadata.name` existir (ex.: o operador original) precisa de um
 * nome exibível mesmo sem ter um cadastrado.
 */

function account(overrides: Partial<OperatorAccount> = {}): OperatorAccount {
  return {
    id: 'id-qualquer',
    email: 'rodrigo.oliveira@veggiedent.test',
    name: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    lastSignInAt: null,
    ...overrides,
  }
}

describe('fallbackName', () => {
  it('separa a parte local do e-mail em palavras e capitaliza cada uma', () => {
    expect(fallbackName('rodrigo.oliveira@veggiedent.test')).toBe('Rodrigo Oliveira')
  })

  it('trata "_" e "-" como o mesmo separador que "."', () => {
    expect(fallbackName('ana_paula-souza@veggiedent.test')).toBe('Ana Paula Souza')
  })

  it('devolve o próprio e-mail quando não há parte local reconhecível', () => {
    expect(fallbackName('@veggiedent.test')).toBe('@veggiedent.test')
  })
})

describe('toOperatorView', () => {
  it('usa o nome cadastrado quando presente', () => {
    const view = toOperatorView(account({ name: 'Rodrigo Xavier' }))

    expect(view.name).toBe('Rodrigo Xavier')
  })

  it('usa o nome derivado do e-mail quando o cadastrado é nulo (operador anterior à T34)', () => {
    const view = toOperatorView(account({ name: null }))

    expect(view.name).toBe('Rodrigo Oliveira')
  })

  it('usa o nome derivado do e-mail quando o cadastrado é uma string vazia', () => {
    const view = toOperatorView(account({ name: '   ' }))

    expect(view.name).toBe('Rodrigo Oliveira')
  })
})
