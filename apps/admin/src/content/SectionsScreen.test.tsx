import { screen } from '@testing-library/react'
import { SECTION_KEYS, orderedSectionSchemas } from '@veggiedent/content-schema'
import { FakeSectionsGateway } from '../../test/fake-sections-gateway'
import { montarTela } from '../../test/painel-autenticado'
import { SectionsScreen } from './SectionsScreen'

const ROTULOS_NA_ORDEM_DA_PAGINA = orderedSectionSchemas.map(
  (schema, posicao) => `${posicao + 1}. ${schema.label}`,
)

describe('Lista de seções (SDD § C-03)', () => {
  it('mostra as 9 seções na ordem da página', async () => {
    montarTela(<SectionsScreen gateway={new FakeSectionsGateway()} />)

    const links = await screen.findAllByRole('link')

    expect(links).toHaveLength(SECTION_KEYS.length)
    expect(links.map((link) => link.textContent)).toEqual(ROTULOS_NA_ORDEM_DA_PAGINA)
  })

  it('leva cada seção à sua tela de edição', async () => {
    montarTela(<SectionsScreen gateway={new FakeSectionsGateway()} />)

    const links = await screen.findAllByRole('link')

    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      SECTION_KEYS.map((key) => `/secoes/${key}`),
    )
  })

  it('mostra a data da última edição e o estado de publicação', async () => {
    montarTela(
      <SectionsScreen
        gateway={new FakeSectionsGateway({ documents: { hero: { headline: 'Olá' } } })}
      />,
    )

    expect(await screen.findByText('Última edição: 03/09/2026, 09:00')).toBeInTheDocument()
    expect(screen.getAllByText('Aparece na página')).toHaveLength(1)
    expect(screen.getAllByText('Fora da página')).toHaveLength(SECTION_KEYS.length - 1)
  })

  it('mostra a falha da API sem esconder a lista de seções', async () => {
    montarTela(
      <SectionsScreen gateway={new FakeSectionsGateway({ failWith: 'API fora do ar.' })} />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('API fora do ar.')
    expect(screen.getAllByRole('link')).toHaveLength(SECTION_KEYS.length)
  })
})
