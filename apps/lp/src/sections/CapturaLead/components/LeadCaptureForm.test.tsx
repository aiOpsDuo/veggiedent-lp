import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { PORTE_OPTIONS, SIM_NAO_OPTIONS } from '@veggiedent/content-schema'
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

afterEach(cleanup)

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
