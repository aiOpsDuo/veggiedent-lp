/**
 * Rótulos em português para os campos que a Landing Page grava como código
 * (achado T30-e): o operador via só `medio` ou `sim` em vez de "Médio" ou
 * "Sim". As opções em si são conteúdo editável da seção `captura_lead`
 * (`packages/content-schema`) — os códigos abaixo são os que o conteúdo
 * publicado usa hoje (`porteOptions` e `simNaoOptions`).
 *
 * Um valor que não bate com nenhum código conhecido — dado legado, ou o
 * operador que digitou a opção de um jeito diferente no CMS — aparece como
 * veio. Esconder ou quebrar a tela por causa disso seria pior do que mostrar
 * o valor cru.
 */

const PORTE_LABELS: Readonly<Record<string, string>> = {
  pequeno: 'Pequeno',
  medio: 'Médio',
  grande: 'Grande',
}

const SIM_NAO_LABELS: Readonly<Record<string, string>> = {
  sim: 'Sim',
  nao: 'Não',
}

function labelFor(code: string, labels: Readonly<Record<string, string>>): string {
  return labels[code.trim().toLowerCase()] ?? code
}

export function porteLabel(code: string): string {
  return labelFor(code, PORTE_LABELS)
}

export function simNaoLabel(code: string): string {
  return labelFor(code, SIM_NAO_LABELS)
}
