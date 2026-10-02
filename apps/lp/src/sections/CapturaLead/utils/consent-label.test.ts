import { describe, expect, it } from 'vitest'
import {
  FALLBACK_POLICY_LINK_TEXT,
  consentLabelText,
  splitConsentLabel,
} from './consent-label'

/**
 * O texto do aceite é do CMS e pode ser reescrito a qualquer momento; o link
 * para a política não pode depender de o operador lembrar de citá-la.
 */

const PUBLICADO =
  'Li e aceito a Política de Privacidade e autorizo o uso dos meus dados para receber o guia e comunicações relacionadas.'

describe('splitConsentLabel', () => {
  it('transforma em link a expressão "Política de Privacidade" do texto publicado', () => {
    expect(splitConsentLabel(PUBLICADO)).toEqual({
      before: 'Li e aceito a ',
      linkText: 'Política de Privacidade',
      after:
        ' e autorizo o uso dos meus dados para receber o guia e comunicações relacionadas.',
    })
  })

  it.each([
    ['caixa baixa', 'Aceito a política de privacidade.', 'política de privacidade'],
    ['caixa alta', 'ACEITO A POLÍTICA DE PRIVACIDADE.', 'POLÍTICA DE PRIVACIDADE'],
    ['sem acento', 'Aceito a politica de privacidade.', 'politica de privacidade'],
  ])('reconhece a expressão em %s, preservando a grafia do CMS', (_caso, texto, link) => {
    expect(splitConsentLabel(texto).linkText).toBe(link)
  })

  it('só a primeira menção vira link', () => {
    const partes = splitConsentLabel('Política de Privacidade: li a Política de Privacidade.')
    expect(partes.before).toBe('')
    expect(partes.after).toBe(': li a Política de Privacidade.')
  })

  it('sem menção à política no texto, acrescenta um link próprio no fim', () => {
    expect(splitConsentLabel('Autorizo o uso dos meus dados.')).toEqual({
      before: 'Autorizo o uso dos meus dados. (',
      linkText: FALLBACK_POLICY_LINK_TEXT,
      after: ')',
    })
  })
})

describe('consentLabelText', () => {
  it('com a política citada, é o próprio texto do CMS', () => {
    expect(consentLabelText(PUBLICADO)).toBe(PUBLICADO)
  })

  it('com o link acrescentado, inclui o link, como o visitante o lê', () => {
    expect(consentLabelText('Autorizo o uso dos meus dados.')).toBe(
      'Autorizo o uso dos meus dados. (ler a Política de Privacidade)',
    )
  })
})
