import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SECTION_KEYS } from '@veggiedent/content-schema'
import { fakeDashboardGateway } from '../../test/fake-dashboard-gateway'
import { leadDeTeste, NOME_DO_ARQUIVO } from '../../test/fake-leads-gateway'
import { montarTela } from '../../test/painel-autenticado'
import { DashboardScreen } from './DashboardScreen'

const DOIS_DIAS_ATRAS = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
const TRINTA_DIAS_ATRAS = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

describe('Painel de início (T35, item 10)', () => {
  it('conta só os leads dos últimos 7 dias, não o histórico inteiro', async () => {
    const gateway = fakeDashboardGateway({
      leads: {
        leads: [
          leadDeTeste({ id: '1', createdAt: DOIS_DIAS_ATRAS }),
          leadDeTeste({ id: '2', createdAt: DOIS_DIAS_ATRAS }),
          leadDeTeste({ id: '3', createdAt: TRINTA_DIAS_ATRAS }),
        ],
      },
    })

    montarTela(<DashboardScreen gateway={gateway} />)

    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  it('lista as seções despublicadas, com link para a edição de cada uma', async () => {
    const gateway = fakeDashboardGateway({
      sections: { documents: { hero: { headline: 'Olá' } } },
    })

    montarTela(<DashboardScreen gateway={gateway} />)

    const link = await screen.findByRole('link', { name: /Perguntas frequentes/ })
    expect(link).toHaveAttribute('href', '/secoes/faq')
  })

  it('confirma que está tudo publicado quando não há seção fora do ar', async () => {
    const documentos = Object.fromEntries(SECTION_KEYS.map((key) => [key, { ok: true }]))
    const gateway = fakeDashboardGateway({ sections: { documents: documentos } })

    montarTela(<DashboardScreen gateway={gateway} />)

    expect(await screen.findByText('Todas as seções estão publicadas.')).toBeInTheDocument()
  })

  it('exporta o período recente em CSV pelo atalho do painel', async () => {
    const gateway = fakeDashboardGateway({ leads: { leads: [] } })
    const download = vi.fn()

    montarTela(<DashboardScreen gateway={gateway} download={download} />)

    await userEvent.click(await screen.findByRole('button', { name: /Exportar os 7 dias/ }))

    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ filename: NOME_DO_ARQUIVO }),
    )
  })

  it('mostra alerta quando a listagem de leads falha, sem travar o widget de seções', async () => {
    const gateway = fakeDashboardGateway({ leads: { failListWith: 'API fora do ar.' } })

    montarTela(<DashboardScreen gateway={gateway} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar agora.')
  })
})
