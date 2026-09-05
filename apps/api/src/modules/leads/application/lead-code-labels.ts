/**
 * Rótulos em português para os campos que a Landing Page grava como código
 * (achado T30-e): o CSV exportado mostrava `medio` ou `sim` em vez de "Médio"
 * ou "Sim". As opções em si são conteúdo editável da seção `captura_lead`
 * (`packages/content-schema`) — os códigos abaixo são os que o conteúdo
 * publicado usa hoje (`porteOptions` e `simNaoOptions`).
 *
 * Irmã de `apps/admin/src/leads/lead-code-labels.ts`: a mesma tradução, dos
 * dois lados que mostram o lead a um ser humano (SDD § C-12 — a tela e o CSV
 * não devem contar histórias diferentes). Não fica em `packages/content-schema`
 * porque não é parte do esquema do conteúdo, é como a API e o painel
 * apresentam um valor que o esquema já validou.
 *
 * Um valor que não bate com nenhum código conhecido — dado legado, ou o
 * operador que digitou a opção de um jeito diferente no CMS — sai no CSV como
 * veio. Esconder ou quebrar a exportação por causa disso seria pior do que
 * entregar o valor cru.
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
