import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { arquivoDe } from '../../test/arquivo'
import { FakeMediaService } from '../../test/fake-media-service'
import { MediaServiceProvider } from './media-context'
import { MultiImageMediaField } from './MultiImageMediaField'

/**
 * A variante de múltiplas imagens (T36, item 3): mesma mecânica do campo de
 * imagem único, mas guardando mais de uma no mesmo campo — cada uma com seu
 * próprio quadro e seu próprio botão de excluir.
 *
 * O valor é controlado por um envoltório com estado de verdade (`useState`),
 * não por uma prop fixa: diferente do campo único, este componente não guarda
 * a mídia recém-enviada em estado próprio — cada quadro busca a sua a partir
 * do identificador que está em `value`. Um teste com valor fixo nunca veria a
 * imagem aparecer depois do envio, porque não existiria outro identificador
 * novo em lugar nenhum — o mesmo formato de teste que o app de verdade usa
 * (a tela edita um rascunho e devolve o valor atualizado por `onChange`).
 */

function Envoltorio({ inicial = [] as readonly string[] }: { readonly inicial?: readonly string[] }) {
  const [value, setValue] = useState<readonly string[]>(inicial)
  return (
    <MultiImageMediaField
      id="mosaico-teste"
      describedBy={undefined}
      invalid={false}
      required={false}
      value={value}
      onChange={setValue}
    />
  )
}

function montar(service = new FakeMediaService(), inicial: readonly string[] = []) {
  render(
    <MediaServiceProvider service={service}>
      <label htmlFor="mosaico-teste">Fotos do mosaico</label>
      <Envoltorio inicial={inicial} />
    </MediaServiceProvider>,
  )
  return { service }
}

const seletor = (): HTMLElement => screen.getByLabelText('Fotos do mosaico')

describe('campo vazio', () => {
  it('mostra o ícone de envio e nenhum botão de excluir', () => {
    montar()

    expect(screen.getByText('Clique para enviar uma imagem')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remover a imagem/ })).not.toBeInTheDocument()
  })

  it('mostra o limite do campo de imagem', () => {
    montar()

    expect(screen.getByText('JPG, PNG, WebP, AVIF, GIF ou SVG, até 10 MB.')).toBeInTheDocument()
  })
})

describe('envio de mais de uma imagem', () => {
  it('acrescenta cada envio ao campo, mantendo as anteriores', async () => {
    const { service } = montar()

    await userEvent.upload(seletor(), arquivoDe('um.png', 'image/png', 1024))
    expect(await screen.findByAltText('Prévia de um.png')).toBeInTheDocument()

    await userEvent.upload(seletor(), arquivoDe('dois.png', 'image/png', 1024))
    expect(await screen.findByAltText('Prévia de dois.png')).toBeInTheDocument()

    // a primeira continua na tela — o campo acumula, não substitui.
    expect(screen.getByAltText('Prévia de um.png')).toBeInTheDocument()
    expect(service.transferidos).toEqual(['um.png', 'dois.png'])
  })

  it('mostra a animação de carregamento dentro do campo enquanto envia', async () => {
    const service = new FakeMediaService()
    const media = {
      id: '22222222-3333-4444-5555-666666666666',
      kind: 'image' as const,
      publicUrl: 'https://armazenamento.test/veggiedent/tres.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
      originalFilename: 'tres.png',
    }
    let concluirEnvio: () => void = () => {}
    vi.spyOn(service, 'send').mockImplementation((_fieldType, _file, onProgress) => {
      onProgress(0.3)
      return new Promise((resolve) => {
        // Registra a mídia como a API de verdade faria ao confirmar o envio
        // (`register`), só então resolve — o quadro busca por identificador
        // depois disso, exatamente como buscaria da API de verdade.
        concluirEnvio = () => resolve({ status: 'enviada', media: service.guardar(media) })
      })
    })
    montar(service)

    await userEvent.upload(seletor(), arquivoDe('tres.png', 'image/png', 1024))

    expect(await screen.findByRole('status')).toHaveTextContent('Enviando… 30%')

    concluirEnvio()

    expect(await screen.findByAltText('Prévia de tres.png')).toBeInTheDocument()
  })

  it('recusa um arquivo de tipo não suportado sem transferir nada', async () => {
    const { service } = montar()

    await userEvent.upload(seletor(), arquivoDe('planilha.pdf', 'application/pdf', 1000), {
      applyAccept: false,
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tipo de arquivo não suportado para imagem.',
    )
    expect(service.transferidos).toEqual([])
  })
})

describe('exclusão individual', () => {
  it('remove só a imagem clicada, mantendo as outras', async () => {
    montar()

    await userEvent.upload(seletor(), arquivoDe('um.png', 'image/png', 1024))
    await screen.findByAltText('Prévia de um.png')
    await userEvent.upload(seletor(), arquivoDe('dois.png', 'image/png', 1024))
    await screen.findByAltText('Prévia de dois.png')

    await userEvent.click(screen.getByRole('button', { name: 'Remover a imagem um.png' }))

    await waitFor(() =>
      expect(screen.queryByAltText('Prévia de um.png')).not.toBeInTheDocument(),
    )
    expect(screen.getByAltText('Prévia de dois.png')).toBeInTheDocument()
  })

  it('cada imagem guardada tem o próprio botão de excluir', async () => {
    const service = new FakeMediaService()
    service.guardar({
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'image',
      publicUrl: 'https://armazenamento.test/veggiedent/a.png',
      mimeType: 'image/png',
      sizeBytes: 10,
      originalFilename: 'a.png',
    })
    service.guardar({
      id: '22222222-2222-4222-8222-222222222222',
      kind: 'image',
      publicUrl: 'https://armazenamento.test/veggiedent/b.png',
      mimeType: 'image/png',
      sizeBytes: 10,
      originalFilename: 'b.png',
    })
    montar(service, [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ])

    expect(await screen.findByRole('button', { name: 'Remover a imagem a.png' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover a imagem b.png' })).toBeInTheDocument()
  })
})
