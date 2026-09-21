import type { OperatorAccount } from '../domain/operator-account'
import { toOperatorView } from './operator-view'

/**
 * `toOperatorView` é hoje uma tradução direta (SDD § C-13): a tabela
 * `operators` garante `name` não vazio (`NOT NULL` + `CreateOperatorDto`
 * exigindo uma string não vazia na criação), então não há mais um caso de
 * nome ausente a resolver aqui — ao contrário da versão sobre o Supabase Auth
 * que este módulo substituiu, onde um operador podia não ter
 * `user_metadata.name` e precisava de um nome derivado do e-mail
 * (`fallbackName`, removido nesta migração).
 */

function account(overrides: Partial<OperatorAccount> = {}): OperatorAccount {
  return {
    id: 'id-qualquer',
    email: 'rodrigo.oliveira@veggiedent.test',
    name: 'Rodrigo Xavier',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('toOperatorView', () => {
  it('traduz a conta para a view, campo a campo, sem expor nada além disso', () => {
    const view = toOperatorView(account())

    expect(view).toEqual({
      id: 'id-qualquer',
      email: 'rodrigo.oliveira@veggiedent.test',
      name: 'Rodrigo Xavier',
      createdAt: '2026-09-01T00:00:00.000Z',
    })
  })
})
