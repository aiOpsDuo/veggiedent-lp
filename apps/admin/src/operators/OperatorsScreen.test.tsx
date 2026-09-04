import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FakeOperatorsGateway, operadorDeTeste } from '../../test/fake-operators-gateway'
import { montarTela } from '../../test/painel-autenticado'
import { OperatorsScreen } from './OperatorsScreen'

/**
 * A tela de operadores (SDD § D-09, § C-13, § R-10).
 *
 * `EU` é o id fixo que `test/painel-autenticado.tsx` usa para a sessão ativa
 * de todo teste de tela do painel — é assim que esta suíte consegue simular
 * "o operador logado está olhando a própria linha".
 */
const EU = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const OUTRO = 'bbbbbbbb-0000-4000-8000-000000000002'

function montarOperadores(gateway: FakeOperatorsGateway): void {
  montarTela(<OperatorsScreen gateway={gateway} />)
}

describe('OperatorsScreen', () => {
  it('lista os operadores com e-mail, criação e último login', async () => {
    const gateway = new FakeOperatorsGateway({
      operators: [
        operadorDeTeste({
          id: EU,
          email: 'eu@veggiedent.test',
          createdAt: '2026-08-01T12:00:00.000Z',
          lastSignInAt: '2026-09-04T09:00:00.000Z',
        }),
        operadorDeTeste({ id: OUTRO, email: 'outro@veggiedent.test' }),
      ],
    })

    montarOperadores(gateway)

    const linha = (await screen.findByText('eu@veggiedent.test')).closest('tr') as HTMLElement
    expect(within(linha).getByText(/01\/08\/2026/)).toBeInTheDocument()
    expect(within(linha).getByText(/04\/09\/2026/)).toBeInTheDocument()
    expect(screen.getByText('outro@veggiedent.test')).toBeInTheDocument()
  })

  it('mostra "Nunca acessou" para operador que nunca fez login', async () => {
    const gateway = new FakeOperatorsGateway({
      operators: [
        operadorDeTeste({ id: EU, email: 'eu@veggiedent.test' }),
        operadorDeTeste({ id: OUTRO, email: 'outro@veggiedent.test', lastSignInAt: null }),
      ],
    })

    montarOperadores(gateway)

    await screen.findByText('outro@veggiedent.test')
    expect(screen.getAllByText('Nunca acessou').length).toBeGreaterThan(0)
  })

  describe('convite', () => {
    it('convida por e-mail e mostra o link de ativação uma única vez', async () => {
      const gateway = new FakeOperatorsGateway({ operators: [operadorDeTeste({ id: EU })] })
      montarOperadores(gateway)
      await screen.findByText(operadorDeTeste({ id: EU }).email)

      await userEvent.type(
        screen.getByLabelText('E-mail do novo operador'),
        'nova.operadora@veggiedent.test',
      )
      await userEvent.click(screen.getByRole('button', { name: 'Convidar operador' }))

      expect(gateway.convites).toEqual(['nova.operadora@veggiedent.test'])
      const link = await screen.findByLabelText('Link de ativação de uso único')
      expect((link as HTMLInputElement).value).toContain('token=')
      expect(await screen.findByText('nova.operadora@veggiedent.test')).toBeInTheDocument()
    })

    it('esconde o link ao clicar em "já copiei" e não o reexibe sozinho', async () => {
      const gateway = new FakeOperatorsGateway({ operators: [operadorDeTeste({ id: EU })] })
      montarOperadores(gateway)
      await screen.findByText(operadorDeTeste({ id: EU }).email)

      await userEvent.type(
        screen.getByLabelText('E-mail do novo operador'),
        'nova.operadora@veggiedent.test',
      )
      await userEvent.click(screen.getByRole('button', { name: 'Convidar operador' }))
      await screen.findByLabelText('Link de ativação de uso único')

      await userEvent.click(screen.getByRole('button', { name: 'Já copiei, esconder o link' }))

      expect(screen.queryByLabelText('Link de ativação de uso único')).not.toBeInTheDocument()
    })

    it('recusa e-mail malformado com a mensagem que a API devolveu', async () => {
      const gateway = new FakeOperatorsGateway({ operators: [operadorDeTeste({ id: EU })] })
      montarOperadores(gateway)
      await screen.findByText(operadorDeTeste({ id: EU }).email)

      await userEvent.type(screen.getByLabelText('E-mail do novo operador'), 'nao-e-email')
      await userEvent.click(screen.getByRole('button', { name: 'Convidar operador' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Informe um e-mail válido.')
    })
  })

  describe('remoção', () => {
    it('remove um operador que não é o autenticado, com confirmação em dois passos', async () => {
      const gateway = new FakeOperatorsGateway({
        operators: [
          operadorDeTeste({ id: EU, email: 'eu@veggiedent.test' }),
          operadorDeTeste({ id: OUTRO, email: 'outro@veggiedent.test' }),
        ],
      })
      montarOperadores(gateway)
      await screen.findByText('outro@veggiedent.test')

      await userEvent.click(screen.getByRole('button', { name: 'Remover outro@veggiedent.test' }))
      await userEvent.click(
        screen.getByRole('button', { name: 'Confirmar a remoção de outro@veggiedent.test' }),
      )

      expect(gateway.remocoes).toEqual([OUTRO])
      await screen.findByText('Operador removido.')
      expect(screen.queryByText('outro@veggiedent.test')).not.toBeInTheDocument()
    })

    it('cancelar a confirmação não remove ninguém', async () => {
      const gateway = new FakeOperatorsGateway({
        operators: [
          operadorDeTeste({ id: EU, email: 'eu@veggiedent.test' }),
          operadorDeTeste({ id: OUTRO, email: 'outro@veggiedent.test' }),
        ],
      })
      montarOperadores(gateway)
      await screen.findByText('outro@veggiedent.test')

      await userEvent.click(screen.getByRole('button', { name: 'Remover outro@veggiedent.test' }))
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(gateway.remocoes).toEqual([])
      expect(screen.getByText('outro@veggiedent.test')).toBeInTheDocument()
    })

    /** R-10 antecipado na tela: nenhum clique consegue pedir a própria remoção. */
    it('desabilita a remoção da própria conta, com o motivo visível', async () => {
      const gateway = new FakeOperatorsGateway({
        operators: [
          operadorDeTeste({ id: EU, email: 'eu@veggiedent.test' }),
          operadorDeTeste({ id: OUTRO, email: 'outro@veggiedent.test' }),
        ],
      })
      montarOperadores(gateway)
      await screen.findByText('eu@veggiedent.test')

      expect(
        screen.queryByRole('button', { name: 'Remover eu@veggiedent.test' }),
      ).not.toBeInTheDocument()
      const linhaPropria = screen.getByText('eu@veggiedent.test').closest('tr') as HTMLElement
      expect(within(linhaPropria).getByText('Você não pode remover a própria conta.')).toBeInTheDocument()
    })

    /** R-10 antecipado na tela: o único operador restante não pode ser removido. */
    it('desabilita a remoção do único operador restante, com o motivo visível', async () => {
      const gateway = new FakeOperatorsGateway({
        operators: [operadorDeTeste({ id: OUTRO, email: 'unico@veggiedent.test' })],
      })
      montarOperadores(gateway)
      await screen.findByText('unico@veggiedent.test')

      expect(
        screen.queryByRole('button', { name: 'Remover unico@veggiedent.test' }),
      ).not.toBeInTheDocument()
      expect(screen.getByText('Não é possível remover o único operador restante.')).toBeInTheDocument()
    })
  })
})
