import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { arquivoDe } from '../../test/arquivo'
import { FakeMediaService } from '../../test/fake-media-service'
import { FakeMetadataGateway } from '../../test/fake-metadata-gateway'
import { montarTela } from '../../test/painel-autenticado'
import type { MediaService } from '../media/media-service'
import { MetadataScreen } from './MetadataScreen'
import { SAVED_MESSAGE } from './metadata-editor-state'

/**
 * A tela de metadados da página (SDD § C-09).
 *
 * Os rótulos usados aqui vêm do esquema em
 * `packages/content-schema/src/site-metadata.ts` — se um deles mudar lá, é este
 * teste que avisa, e não o operador descobrindo a tela errada.
 */

const METADADOS = {
  title: 'Veggiedent Fresh — Virbac',
  description: 'Petisco mastigável que ajuda na higiene bucal do cachorro.',
  canonicalUrl: 'https://veggiedent.com.br/',
}

function montarMetadados(
  gateway: FakeMetadataGateway,
  mediaService?: MediaService,
): void {
  montarTela(<MetadataScreen gateway={gateway} />, { mediaService })
}

async function esperarFormulario(): Promise<HTMLElement> {
  return screen.findByLabelText('Título da página')
}

describe('Tela de metadados', () => {
  it('desenha os campos declarados no esquema, com o que está guardado', async () => {
    montarMetadados(new FakeMetadataGateway({ metadata: METADADOS }))

    expect(await esperarFormulario()).toHaveValue(METADADOS.title)
    expect(screen.getByLabelText('Descrição da página')).toHaveValue(METADADOS.description)
    expect(screen.getByLabelText('Endereço oficial da página')).toHaveValue(
      METADADOS.canonicalUrl,
    )
    expect(screen.getByLabelText('Imagem de compartilhamento')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Texto alternativo da imagem de compartilhamento'),
    ).toBeInTheDocument()
  })

  it('grava o que foi editado e confirma o sucesso', async () => {
    const gateway = new FakeMetadataGateway({ metadata: METADADOS })
    montarMetadados(gateway)
    await esperarFormulario()

    await userEvent.clear(screen.getByLabelText('Título da página'))
    await userEvent.type(screen.getByLabelText('Título da página'), 'Título revisado')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }))

    expect(await screen.findByText(SAVED_MESSAGE)).toBeInTheDocument()
    expect(gateway.lastDocument).toMatchObject({
      title: 'Título revisado',
      description: METADADOS.description,
      canonicalUrl: METADADOS.canonicalUrl,
    })
  })

  it('preserva a acentuação na ida e na volta', async () => {
    const gateway = new FakeMetadataGateway({ metadata: METADADOS })
    montarMetadados(gateway)
    await esperarFormulario()

    await userEvent.clear(screen.getByLabelText('Descrição da página'))
    await userEvent.type(
      screen.getByLabelText('Descrição da página'),
      'Higiene bucal com ação mecânica e sabor de manjericão.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }))
    await screen.findByText(SAVED_MESSAGE)

    expect(gateway.lastDocument?.description).toBe(
      'Higiene bucal com ação mecânica e sabor de manjericão.',
    )
    expect(screen.getByLabelText('Descrição da página')).toHaveValue(
      'Higiene bucal com ação mecânica e sabor de manjericão.',
    )
  })

  it('mostra a recusa da API no campo que a causou', async () => {
    montarMetadados(
      new FakeMetadataGateway({
        metadata: METADADOS,
        rejectSaveWith: { 'metadata.title': 'Campo obrigatório.' },
      }),
    )
    await esperarFormulario()

    await userEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }))

    const titulo = await screen.findByLabelText('Título da página')
    expect(titulo).toHaveAccessibleDescription(/Campo obrigatório\./)
    expect(titulo).toHaveAttribute('aria-invalid', 'true')
  })

  it('não descarta o que o operador escreveu quando a API recusa', async () => {
    montarMetadados(
      new FakeMetadataGateway({
        metadata: METADADOS,
        rejectSaveWith: { 'metadata.title': 'Campo obrigatório.' },
      }),
    )
    await esperarFormulario()
    await userEvent.type(screen.getByLabelText('Título da página'), ' revisado')

    await userEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }))

    expect(await screen.findByLabelText('Título da página')).toHaveValue(
      `${METADADOS.title} revisado`,
    )
  })

  it('mostra um erro que não pertence a nenhum campo, em vez de engoli-lo', async () => {
    montarMetadados(
      new FakeMetadataGateway({
        metadata: METADADOS,
        rejectSaveWith: { metadata: 'Documento inválido.' },
      }),
    )
    await esperarFormulario()

    await userEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }))

    expect(await screen.findByText('Documento inválido.')).toBeInTheDocument()
  })

  it('avisa quando a API não responde, sem desenhar formulário vazio', async () => {
    montarMetadados(new FakeMetadataGateway({ failWith: 'A API do CMS não respondeu.' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A API do CMS não respondeu.')
    expect(screen.queryByLabelText('Título da página')).toBeNull()
  })
})

describe('Imagem de compartilhamento', () => {
  it('envia o arquivo pelo campo de mídia e guarda o identificador devolvido', async () => {
    const gateway = new FakeMetadataGateway({ metadata: METADADOS })
    const media = new FakeMediaService()
    montarMetadados(gateway, media)
    await esperarFormulario()

    await userEvent.upload(
      screen.getByLabelText('Imagem de compartilhamento'),
      arquivoDe('compartilhamento.png', 'image/png', 200_000),
    )
    await userEvent.type(
      screen.getByLabelText('Texto alternativo da imagem de compartilhamento'),
      'Sachê de Veggiedent Fresh ao lado de um cachorro.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }))
    await screen.findByText(SAVED_MESSAGE)

    expect(media.transferidos).toEqual(['compartilhamento.png'])
    expect(gateway.lastDocument?.ogImage).toBe('00000000-0000-4000-8000-000000000001')
    expect(gateway.lastDocument?.ogImageAlt).toBe(
      'Sachê de Veggiedent Fresh ao lado de um cachorro.',
    )
  })

  /**
   * A única regra que o painel decide sozinho: imagem informativa preenchida
   * exige a descrição ao lado dela (SDD § C-06). A recusa acontece no painel
   * porque ela precisa alcançar o operador no momento em que ele escolheu a
   * imagem, não depois de uma ida à rede.
   */
  it('recusa no painel a imagem sem texto alternativo, sem chamar a API', async () => {
    const gateway = new FakeMetadataGateway({ metadata: METADADOS })
    const media = new FakeMediaService()
    montarMetadados(gateway, media)
    await esperarFormulario()

    await userEvent.upload(
      screen.getByLabelText('Imagem de compartilhamento'),
      arquivoDe('compartilhamento.png', 'image/png', 200_000),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }))

    expect(gateway.savedDocuments).toEqual([])
    expect(
      await screen.findByLabelText('Texto alternativo da imagem de compartilhamento'),
    ).toHaveAccessibleDescription(/[Tt]exto alternativo/)
  })

  it('deixa salvar sem imagem nenhuma: ela é opcional enquanto não for aprovada', async () => {
    const gateway = new FakeMetadataGateway({ metadata: METADADOS })
    montarMetadados(gateway)
    await esperarFormulario()

    await userEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }))

    await screen.findByText(SAVED_MESSAGE)
    expect(gateway.lastDocument).not.toHaveProperty('ogImage')
  })
})

describe('Bloqueio de navegação sem edição salva (T30-d)', () => {
  const OUTRA_TELA = '/outra-tela'

  function montarMetadadosComNavegacao(gateway: FakeMetadataGateway): void {
    montarTela(
      <>
        <Link to={OUTRA_TELA}>Ir para outra tela</Link>
        <MetadataScreen gateway={gateway} />
      </>,
      { extraRoutes: [{ path: OUTRA_TELA, element: <p>Outra tela</p> }] },
    )
  }

  const sair = (): Promise<void> =>
    userEvent.click(screen.getByRole('link', { name: 'Ir para outra tela' }))

  it('não pede confirmação para sair sem ter editado nada', async () => {
    montarMetadadosComNavegacao(new FakeMetadataGateway({ metadata: METADADOS }))
    await esperarFormulario()

    await sair()

    expect(await screen.findByText('Outra tela')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('pede confirmação em português ao tentar sair com edição não salva', async () => {
    montarMetadadosComNavegacao(new FakeMetadataGateway({ metadata: METADADOS }))
    await esperarFormulario()
    await userEvent.type(screen.getByLabelText('Título da página'), ' revisado')

    await sair()

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Você tem alterações não salvas. Sair mesmo assim?',
    )
    expect(screen.queryByText('Outra tela')).not.toBeInTheDocument()
  })

  it('mantém o rascunho na tela ao escolher continuar editando', async () => {
    montarMetadadosComNavegacao(new FakeMetadataGateway({ metadata: METADADOS }))
    await esperarFormulario()
    await userEvent.type(screen.getByLabelText('Título da página'), ' revisado')
    await sair()

    await userEvent.click(screen.getByRole('button', { name: 'Continuar editando' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Título da página')).toHaveValue(`${METADADOS.title} revisado`)
  })

  it('descarta a edição e navega ao escolher sair sem salvar', async () => {
    const gateway = new FakeMetadataGateway({ metadata: METADADOS })
    montarMetadadosComNavegacao(gateway)
    await esperarFormulario()
    await userEvent.type(screen.getByLabelText('Título da página'), ' revisado')
    await sair()

    await userEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }))

    expect(await screen.findByText('Outra tela')).toBeInTheDocument()
    expect(gateway.savedDocuments).toEqual([])
  })

  it('não pede confirmação depois de salvar', async () => {
    montarMetadadosComNavegacao(new FakeMetadataGateway({ metadata: METADADOS }))
    await esperarFormulario()
    await userEvent.type(screen.getByLabelText('Título da página'), ' revisado')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar metadados' }))
    await screen.findByText(SAVED_MESSAGE)

    await sair()

    expect(await screen.findByText('Outra tela')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
