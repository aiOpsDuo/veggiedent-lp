// O texto do aceite da Politica de Privacidade, com o link para a politica.
//
// O texto e do CMS (`lgpdLabel`) e o link nao: o endereco e PRIVACY_POLICY_URL
// (`@veggiedent/content-schema`), o mesmo que a API grava junto do lead. Como o
// operador pode reescrever o texto livremente, o link nao depende de marcacao
// nenhuma no conteudo: se o texto cita "Politica de Privacidade" (com ou sem
// acento, em qualquer caixa), e essa expressao que vira o link; se nao cita, um
// link proprio entra no fim — o aceite nunca fica sem ter onde ler a politica.
//
// O mesmo recorte serve a tela e ao envio (`consentLabelText`): o texto gravado
// no lead e o que o visitante leu, letra por letra, nao o rotulo cru do CMS.

const POLICY_PHRASE = /pol[ií]tica de privacidade/i

/** Link acrescentado quando o texto do CMS nao cita a politica. */
export const FALLBACK_POLICY_LINK_TEXT = 'ler a Política de Privacidade'

export interface ConsentLabelParts {
  readonly before: string
  readonly linkText: string
  readonly after: string
}

export function splitConsentLabel(label: string): ConsentLabelParts {
  const match = POLICY_PHRASE.exec(label)
  if (match === null) {
    return { before: `${label} (`, linkText: FALLBACK_POLICY_LINK_TEXT, after: ')' }
  }
  return {
    before: label.slice(0, match.index),
    linkText: match[0],
    after: label.slice(match.index + match[0].length),
  }
}

/** O texto do aceite exatamente como aparece na tela, em texto puro. */
export function consentLabelText(label: string): string {
  const { before, linkText, after } = splitConsentLabel(label)
  return `${before}${linkText}${after}`
}
