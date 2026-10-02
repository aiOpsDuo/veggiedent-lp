import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PORTE_OPTIONS, PRIVACY_POLICY_URL, SIM_NAO_OPTIONS } from '@veggiedent/content-schema'
import { LeadCaptureForm } from './LeadCaptureForm'
import { contentSnapshot } from '../../../content/content-snapshot'
import type { SectionContent } from '../../../content/published-content'

/**
 * As opções do formulário têm duas metades desde a T25: o **código** gravado no
 * lead, fechado em `PORTE_OPTIONS`/`SIM_NAO_OPTIONS`, e o **rótulo** lido pelo
 * visitante, que continua vindo do CMS.
 *
 * O que este teste protege é justamente a junção das duas. Nenhuma suíte antes
 * dela exercitava o formulário montado: o esquema podia passar verde, a API
 * podia responder o documento certo, e ainda assim a página oferecer uma opção
 * escrita "undefined" ou gravar um porte vazio no banco. O conteúdo usado é o
 * instantâneo real, o mesmo que a página renderiza antes de a API responder.
 */
const conteudo = contentSnapshot.sections.captura_lead as SectionContent<'captura_lead'>

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Opções do formulário: código em código, rótulo no CMS (T25)', () => {
  it('oferece os três portes com o código que a API grava e o texto do CMS', () => {
    render(<LeadCaptureForm content={conteudo} />)

    const porte = screen.getByLabelText(conteudo.formPorteCachorroLabel)
    const opcoes = within(porte).getAllByRole('option')

    expect(opcoes.slice(1).map((opcao) => opcao.getAttribute('value'))).toEqual([
      'pequeno',
      'medio',
      'grande',
    ])
    expect(opcoes.slice(1).map((opcao) => opcao.textContent)).toEqual([
      conteudo.portePequenoLabel,
      conteudo.porteMedioLabel,
      conteudo.porteGrandeLabel,
    ])
  })

  it('oferece sim e não com o código que a API grava e o texto do CMS', () => {
    render(<LeadCaptureForm content={conteudo} />)

    const pergunta = screen.getByRole('group', { name: conteudo.formConheceVirbacLabel })
    const radios = within(pergunta).getAllByRole('radio')

    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['sim', 'nao'])
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual([
      conteudo.opcaoSimLabel,
      conteudo.opcaoNaoLabel,
    ])
  })

  it('nenhum rótulo de opção sai vazio ou como "undefined"', () => {
    render(<LeadCaptureForm content={conteudo} />)

    for (const { labelField } of [...PORTE_OPTIONS, ...SIM_NAO_OPTIONS]) {
      const rotulo = conteudo[labelField]
      expect(rotulo).toBeTypeOf('string')
      expect(rotulo.trim()).not.toBe('')
      expect(screen.getAllByText(rotulo).length).toBeGreaterThan(0)
    }
  })
})

/**
 * O aceite da Política de Privacidade tem link para a política (2026-10-02).
 * O texto é do CMS e o endereço é `PRIVACY_POLICY_URL`, o mesmo que a API grava
 * junto do lead — ver `utils/consent-label.ts`.
 */
describe('Aceite da Política de Privacidade', () => {
  const caixaDoAceite = (): HTMLInputElement =>
    screen.getByRole('checkbox', { name: /Li e aceito a Política de Privacidade/ })

  const linkDaPolitica = (): HTMLElement =>
    screen.getByRole('link', { name: /Política de Privacidade/i })

  it('o texto publicado leva à política, em nova aba', () => {
    render(<LeadCaptureForm content={conteudo} />)

    const link = linkDaPolitica()
    expect(link).toHaveTextContent('Política de Privacidade')
    expect(link).toHaveAttribute('href', PRIVACY_POLICY_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('o link continua sendo parte do nome acessível da caixa', () => {
    render(<LeadCaptureForm content={conteudo} />)

    expect(caixaDoAceite()).toHaveAccessibleName(
      expect.stringContaining('e autorizo o uso dos meus dados'),
    )
  })

  it('clicar no link não marca a caixa', () => {
    render(<LeadCaptureForm content={conteudo} />)

    fireEvent.click(linkDaPolitica())

    expect(caixaDoAceite()).not.toBeChecked()
  })

  it('clicar no resto do texto continua marcando a caixa', () => {
    render(<LeadCaptureForm content={conteudo} />)

    fireEvent.click(caixaDoAceite().closest('div')!.querySelector('label')!)

    expect(caixaDoAceite()).toBeChecked()
  })

  it('o texto do aceite de comunicações não ganha link', () => {
    render(<LeadCaptureForm content={conteudo} />)

    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('texto do CMS que não cita a política ganha um link próprio no fim', () => {
    render(
      <LeadCaptureForm content={{ ...conteudo, lgpdLabel: 'Autorizo o uso dos meus dados.' }} />,
    )

    const link = screen.getByRole('link', { name: /ler a Política de Privacidade/ })
    expect(link).toHaveAttribute('href', PRIVACY_POLICY_URL)
    expect(link).toHaveAttribute('target', '_blank')
  })

  /**
   * O texto gravado no lead é a prova do que o visitante aceitou: tem de ser
   * o que ele leu na tela, incluindo o link acrescentado quando o CMS não cita
   * a política — e nunca o aviso "abre em nova aba", que só o leitor de tela lê.
   */
  it.each([
    ['citado no texto', conteudo.lgpdLabel, conteudo.lgpdLabel],
    [
      'acrescentado no fim',
      'Autorizo o uso dos meus dados.',
      'Autorizo o uso dos meus dados. (ler a Política de Privacidade)',
    ],
  ])('envia à API o texto do aceite como aparece na tela, com o link %s', async (_caso, rotulo, esperado) => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    vi.stubGlobal('fetch', mockFetch)
    render(<LeadCaptureForm content={{ ...conteudo, lgpdLabel: rotulo }} />)

    fireEvent.change(screen.getByRole('textbox', { name: conteudo.formNomeLabel }), {
      target: { value: 'Ana Souza' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: conteudo.formEmailLabel }), {
      target: { value: 'ana@exemplo.com' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(rotulo.slice(0, 20)) }))
    fireEvent.click(screen.getByRole('button', { name: conteudo.submitLabel }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const corpo = JSON.parse((mockFetch.mock.calls[0]?.[1] as RequestInit).body as string)
    expect(corpo).toMatchObject({ aceite_lgpd: true, aceite_lgpd_texto: esperado })
  })
})
