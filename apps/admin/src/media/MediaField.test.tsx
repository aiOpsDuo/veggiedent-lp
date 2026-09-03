import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { arquivoDe } from '../../test/arquivo'
import { FakeMediaService } from '../../test/fake-media-service'
import { MediaField } from './MediaField'
import { MediaServiceProvider } from './media-context'

/**
 * O campo de mídia sozinho: o limite exibido antes do envio, a recusa antes de
 * qualquer chamada, o progresso durante o envio e a prévia depois dele
 * (SDD § C-06, C-07).
 *
 * `applyAccept: false` no envio simulado é proposital: o atributo `accept` do
 * seletor de arquivo é conveniência, não barreira — quem arrasta um arquivo
 * para a janela, ou escolhe "todos os arquivos" no diálogo do sistema,
 * atravessa o `accept`. O que precisa recusar é o painel, e é ele que está sob
 * teste aqui.
 */

const MIDIA_GUARDADA = {
  id: '11111111-2222-3333-4444-555555555555',
  kind: 'image' as const,
  publicUrl: 'https://armazenamento.test/veggiedent/cachorro.png',
  mimeType: 'image/png',
  sizeBytes: 2048,
  originalFilename: 'cachorro.png',
}

interface Montagem {
  readonly service: FakeMediaService
  readonly alterado: ReturnType<typeof vi.fn>
}

function montar(
  fieldType: 'imagem' | 'video' | 'legenda' = 'imagem',
  value = '',
  service = new FakeMediaService(),
): Montagem {
  const alterado = vi.fn()
  render(
    <MediaServiceProvider service={service}>
      <label htmlFor="campo">Imagem da abertura</label>
      <MediaField
        id="campo"
        describedBy={undefined}
        invalid={false}
        required
        fieldType={fieldType}
        label="Imagem da abertura"
        value={value}
        onChange={alterado}
      />
    </MediaServiceProvider>,
  )
  return { service, alterado }
}

const seletor = (): HTMLElement => screen.getByLabelText('Imagem da abertura')

describe('o limite chega ao operador antes do envio', () => {
  it('mostra os formatos e o teto de 50 MB no campo de vídeo', () => {
    montar('video')

    expect(screen.getByText('MP4 ou WebM, até 50 MB.')).toBeInTheDocument()
  })

  it('mostra o limite do bucket de imagens, que é menor que o teto do projeto', () => {
    montar('imagem')

    expect(
      screen.getByText('JPG, PNG, WebP, AVIF, GIF ou SVG, até 10 MB.'),
    ).toBeInTheDocument()
  })

  it('restringe o seletor de arquivo aos tipos aceitos', () => {
    montar('video')

    expect(seletor()).toHaveAttribute('accept', 'video/mp4,video/webm')
  })
})

describe('recusa antes de qualquer chamada', () => {
  it('recusa tipo não suportado sem transferir nada', async () => {
    const { service, alterado } = montar('video')

    await userEvent.upload(seletor(), arquivoDe('planilha.pdf', 'application/pdf', 1000), {
      applyAccept: false,
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tipo de arquivo não suportado para vídeo. Envie MP4 ou WebM.',
    )
    expect(service.transferidos).toEqual([])
    expect(alterado).not.toHaveBeenCalled()
  })

  it('recusa arquivo acima do limite dizendo o tamanho e o teto', async () => {
    const { service, alterado } = montar('video')

    await userEvent.upload(
      seletor(),
      arquivoDe('longo.mp4', 'video/mp4', 60 * 1024 * 1024),
      { applyAccept: false },
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O arquivo tem 60 MB e o limite para vídeo é 50 MB.',
    )
    expect(service.transferidos).toEqual([])
    expect(alterado).not.toHaveBeenCalled()
  })
})

describe('envio concluído', () => {
  it('mostra o progresso e depois a prévia do arquivo enviado', async () => {
    const progressos: number[] = []
    const service = new FakeMediaService()
    const original = service.send.bind(service)
    vi.spyOn(service, 'send').mockImplementation((fieldType, file, onProgress) =>
      original(fieldType, file, (fracao) => {
        progressos.push(fracao)
        onProgress(fracao)
      }),
    )
    const { alterado } = montar('imagem', '', service)

    await userEvent.upload(seletor(), arquivoDe('cachorro.png', 'image/png', 2048))

    expect(progressos).toEqual([0.5, 1])
    await waitFor(() => expect(alterado).toHaveBeenCalledTimes(1))
    const enviada = alterado.mock.calls[0][0] as string
    expect(enviada).toMatch(/^[0-9a-f-]{36}$/)
    expect(await screen.findByAltText('Prévia de cachorro.png')).toHaveAttribute(
      'src',
      'https://armazenamento.test/veggiedent/cachorro.png',
    )
  })
})

describe('prévia do que já estava guardado', () => {
  /**
   * O painel roda dentro de `StrictMode`, que monta cada efeito duas vezes em
   * desenvolvimento. Uma primeira versão deste campo guardava "já pedi esta
   * mídia" antes da resposta chegar: a segunda montagem via a marca, não pedia
   * de novo, e a resposta da primeira era descartada pela limpeza — a prévia
   * ficava presa em "carregando" no navegador, com todos os testes verdes.
   * Este teste monta como o painel monta.
   */
  it('carrega a prévia mesmo com o efeito montado duas vezes', async () => {
    const service = new FakeMediaService()
    service.guardar(MIDIA_GUARDADA)

    render(
      <StrictMode>
        <MediaServiceProvider service={service}>
          <label htmlFor="campo">Imagem da abertura</label>
          <MediaField
            id="campo"
            describedBy={undefined}
            invalid={false}
            required
            fieldType="imagem"
            label="Imagem da abertura"
            value={MIDIA_GUARDADA.id}
            onChange={vi.fn()}
          />
        </MediaServiceProvider>
      </StrictMode>,
    )

    expect(await screen.findByAltText('Prévia de cachorro.png')).toBeInTheDocument()
  })

  it('busca a mídia do identificador e a exibe', async () => {
    const service = new FakeMediaService()
    service.guardar(MIDIA_GUARDADA)

    montar('imagem', MIDIA_GUARDADA.id, service)

    expect(await screen.findByAltText('Prévia de cachorro.png')).toBeInTheDocument()
    expect(screen.getByText('cachorro.png')).toBeInTheDocument()
  })

  it('avisa quando a mídia guardada não existe mais', async () => {
    montar('imagem', '99999999-9999-4999-8999-999999999999')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O arquivo deste campo não está mais no armazenamento.',
    )
  })

  it('não deixa o operador digitar o identificador da mídia', async () => {
    const service = new FakeMediaService()
    service.guardar(MIDIA_GUARDADA)
    montar('imagem', MIDIA_GUARDADA.id, service)
    await screen.findByAltText('Prévia de cachorro.png')

    expect(seletor()).toHaveAttribute('type', 'file')
    expect(screen.queryByDisplayValue(MIDIA_GUARDADA.id)).not.toBeInTheDocument()
  })

  it('remove a referência sem apagar nada no armazenamento', async () => {
    const service = new FakeMediaService()
    service.guardar(MIDIA_GUARDADA)
    const { alterado } = montar('imagem', MIDIA_GUARDADA.id, service)
    await screen.findByAltText('Prévia de cachorro.png')

    await userEvent.click(screen.getByRole('button', { name: 'Remover a imagem' }))

    expect(alterado).toHaveBeenCalledWith('')
    expect(await service.describe(MIDIA_GUARDADA.id)).not.toBeNull()
  })
})
