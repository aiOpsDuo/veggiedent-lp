import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FakeOperatorsGateway, operadorDeTeste } from '../../test/fake-operators-gateway'
import { montarTela } from '../../test/painel-autenticado'
import { OperatorsScreen } from './OperatorsScreen'

/**
 * A tela de operadores (SDD § D-09, § C-13, § R-10, revista na T34).
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

async function preencherFormulario(nome: string, email: string, senha: string): Promise<void> {
  await userEvent.type(screen.getByLabelText('Nome'), nome)
  await userEvent.type(screen.getByLabelText('E-mail'), email)
  await userEvent.type(screen.getByLabelText('Senha inicial'), senha)
}

describe('OperatorsScreen', () => {
  it('lista os operadores com nome, e-mail, criação e último login', async () => {
    const gateway = new FakeOperatorsGateway({
      operators: [
        operadorDeTeste({
          id: EU,
          email: 'eu@veggiedent.test',
          name: 'Eu Mesma',
          createdAt: '2026-08-01T12:00:00.000Z',
          lastSignInAt: '2026-09-04T09:00:00.000Z',
        }),
        operadorDeTeste({ id: OUTRO, email: 'outro@veggiedent.test', name: 'Outro Operador' }),
      ],
    })

    montarOperadores(gateway)

    const linha = (await screen.findByText('eu@veggiedent.test')).closest('tr') as HTMLElement
    expect(within(linha).getByText('Eu Mesma')).toBeInTheDocument()
    expect(within(linha).getByText(/01\/08\/2026/)).toBeInTheDocument()
    expect(within(linha).getByText(/04\/09\/2026/)).toBeInTheDocument()
    expect(screen.getByText('Outro Operador')).toBeInTheDocument()
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

  describe('criação', () => {
    it('cria com e-mail, senha e nome, e mostra que a conta já está pronta para logar', async () => {
      const gateway = new FakeOperatorsGateway({ operators: [operadorDeTeste({ id: EU })] })
      montarOperadores(gateway)
      await screen.findByText(operadorDeTeste({ id: EU }).email)

      await preencherFormulario('Nova Operadora', 'nova.operadora@veggiedent.test', 'senha-forte')
      await userEvent.click(screen.getByRole('button', { name: 'Criar operador' }))

      expect(gateway.criacoes).toEqual([
        { email: 'nova.operadora@veggiedent.test', password: 'senha-forte', name: 'Nova Operadora' },
      ])
      expect(
        await screen.findByText(
          'Operador criado. Já pode entrar no painel com o e-mail e a senha definidos.',
        ),
      ).toBeInTheDocument()
      expect(await screen.findByText('nova.operadora@veggiedent.test')).toBeInTheDocument()
      expect(await screen.findByText('Nova Operadora')).toBeInTheDocument()
    })

    it('limpa o formulário depois de criar', async () => {
      const gateway = new FakeOperatorsGateway({ operators: [operadorDeTeste({ id: EU })] })
      montarOperadores(gateway)
      await screen.findByText(operadorDeTeste({ id: EU }).email)

      await preencherFormulario('Nova Operadora', 'nova.operadora@veggiedent.test', 'senha-forte')
      await userEvent.click(screen.getByRole('button', { name: 'Criar operador' }))
      await screen.findByText('nova.operadora@veggiedent.test')

      expect(screen.getByLabelText('Nome')).toHaveValue('')
      expect(screen.getByLabelText('E-mail')).toHaveValue('')
      expect(screen.getByLabelText('Senha inicial')).toHaveValue('')
    })

    /** SDD § D-09 revista na T34: mínimo de 6 caracteres, checado sem round-trip. */
    it('recusa senha curta antes de chamar a API', async () => {
      const gateway = new FakeOperatorsGateway({ operators: [operadorDeTeste({ id: EU })] })
      montarOperadores(gateway)
      await screen.findByText(operadorDeTeste({ id: EU }).email)

      await preencherFormulario('Nova Operadora', 'nova.operadora@veggiedent.test', '12345')
      await userEvent.click(screen.getByRole('button', { name: 'Criar operador' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'A senha precisa ter pelo menos 6 caracteres.',
      )
      expect(gateway.criacoes).toEqual([])
    })

    it('recusa e-mail malformado com a mensagem que a API devolveu', async () => {
      const gateway = new FakeOperatorsGateway({ operators: [operadorDeTeste({ id: EU })] })
      montarOperadores(gateway)
      await screen.findByText(operadorDeTeste({ id: EU }).email)

      await preencherFormulario('Nova Operadora', 'nao-e-email', 'senha-forte')
      await userEvent.click(screen.getByRole('button', { name: 'Criar operador' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Informe um e-mail válido.')
    })

    it('mantém o botão desabilitado até nome, e-mail e senha estarem preenchidos', async () => {
      const gateway = new FakeOperatorsGateway({ operators: [operadorDeTeste({ id: EU })] })
      montarOperadores(gateway)
      await screen.findByText(operadorDeTeste({ id: EU }).email)

      expect(screen.getByRole('button', { name: 'Criar operador' })).toBeDisabled()

      await preencherFormulario('Nova Operadora', 'nova.operadora@veggiedent.test', 'senha-forte')

      expect(screen.getByRole('button', { name: 'Criar operador' })).toBeEnabled()
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
