import { formatBrasiliaDateTime } from '../shared/brasilia-time'
import { porteLabel, simNaoLabel } from './lead-code-labels'
import type { LeadView } from './leads-gateway'

/**
 * As colunas da tabela de leads: **uma por campo que o visitante preenche**,
 * mais as operacionais que acompanham cada registro — a mesma cobertura que a
 * regra de negócio RN-01 exige do CSV, para que a tela e o arquivo exportado
 * não contem histórias diferentes.
 *
 * A última coluna é o **registro do consentimento LGPD** (pedido do cliente de
 * 2026-10-02, ver `agent_context/CHANGELOG.md`): o aceite e quando ele
 * aconteceu, na célula, e o texto aceito e a política, nos detalhes que a
 * célula abre — texto longo demais para caber numa linha da tabela.
 */

/** Um par rótulo e valor dos detalhes de uma célula; `href` faz do valor um link. */
export interface LeadDetail {
  readonly label: string
  readonly value: string
  readonly href?: string
}

export interface LeadColumn {
  readonly header: string
  readonly value: (lead: LeadView) => string
  /** O que a célula mostra ao ser aberta, quando o valor resumido não basta. */
  readonly details?: (lead: LeadView) => readonly LeadDetail[]
}

/** O que a tela escreve onde o visitante não preencheu nada. */
const EMPTY = '—'

/** Instante que o navegador não soube ler — não deve virar célula em branco. */
const UNREADABLE_DATE = 'Data ilegível'

function text(value: string | null): string {
  return value === null || value.trim().length === 0 ? EMPTY : value
}

/** Traduz um código fixo (`medio`, `sim`) para o rótulo em português, sem esconder um valor desconhecido. */
function label(value: string | null, translate: (code: string) => string): string {
  return value === null || value.trim().length === 0 ? EMPTY : translate(value)
}

function simOuNao(value: boolean): string {
  return value ? 'Sim' : 'Não'
}

export function formatReceivedAt(instant: string): string {
  return formatBrasiliaDateTime(instant) ?? UNREADABLE_DATE
}

/**
 * Leads anteriores a 2026-10-02 aceitaram a política — sem aceite a API nunca
 * gravou lead nenhum —, mas o texto e o endereço não eram guardados. O
 * endereço é o sinal: a API o grava em todo lead novo, sem depender do
 * navegador. Já o texto vem do formulário e pode faltar num lead novo (envio
 * que não passou pela LP) — e aí a tela não pode culpar a data.
 */
const NOT_RECORDED = 'Não registrado (lead anterior a 02/10/2026)'
const TEXT_NOT_SENT = 'Não enviado no formulário'

/** "Sim — 02/09/2026, 12:00": o aceite e o instante dele, no fuso de Brasília. */
export function formatLgpdConsent(lead: LeadView): string {
  if (!lead.aceiteLgpd) {
    return 'Não'
  }
  return lead.aceiteLgpdEm === null ? 'Sim' : `Sim — ${formatReceivedAt(lead.aceiteLgpdEm)}`
}

function lgpdConsentDetails(lead: LeadView): readonly LeadDetail[] {
  const url = lead.aceiteLgpdPoliticaUrl
  const missingText = url === null ? NOT_RECORDED : TEXT_NOT_SENT
  return [
    { label: 'Texto aceito', value: lead.aceiteLgpdTexto ?? missingText },
    url === null
      ? { label: 'Política aceita', value: NOT_RECORDED }
      : { label: 'Política aceita', value: url, href: url },
  ]
}

export const LEAD_COLUMNS: readonly LeadColumn[] = [
  { header: 'Recebido em', value: (lead) => formatReceivedAt(lead.createdAt) },
  { header: 'Nome', value: (lead) => lead.nome },
  { header: 'E-mail', value: (lead) => lead.email },
  { header: 'Telefone', value: (lead) => text(lead.telefone) },
  { header: 'Nome do cachorro', value: (lead) => text(lead.nomeCachorro) },
  { header: 'Porte do cachorro', value: (lead) => label(lead.porteCachorro, porteLabel) },
  { header: 'Cidade e estado', value: (lead) => text(lead.cidadeEstado) },
  { header: 'Conhece a Virbac', value: (lead) => label(lead.conheceVirbac, simNaoLabel) },
  { header: 'Usa produto Virbac', value: (lead) => label(lead.usaProdutoVirbac, simNaoLabel) },
  { header: 'Qual produto Virbac', value: (lead) => text(lead.qualProdutoVirbac) },
  { header: 'Aceite de comunicações', value: (lead) => simOuNao(lead.aceiteComunicacoes) },
  { header: 'Origem', value: (lead) => text(lead.origem) },
  { header: 'Consentimento LGPD', value: formatLgpdConsent, details: lgpdConsentDetails },
]

/**
 * Do mais recente ao mais antigo (SDD § C-12).
 *
 * A API já responde nessa ordem, e mesmo assim a tela ordena — pela mesma razão
 * que a lista de seções tira a ordem do esquema em vez da resposta: a ordem que
 * o operador vê é promessa do painel, e não deve depender de uma resposta chegar
 * ordenada.
 *
 * A comparação é pelo instante, não pelo texto: o mesmo momento pode chegar
 * escrito de mais de uma forma (`Z` ou `+00:00`, com mais ou menos casas de
 * milissegundo), e ordenar texto colocaria as duas grafias em ordens
 * diferentes. Um instante ilegível vai para o fim, onde não desloca os
 * legíveis.
 */
const UNKNOWN_INSTANT = Number.NEGATIVE_INFINITY

function instantOf(lead: LeadView): number {
  const parsed = Date.parse(lead.createdAt)
  return Number.isNaN(parsed) ? UNKNOWN_INSTANT : parsed
}

export function mostRecentFirst(leads: readonly LeadView[]): readonly LeadView[] {
  return leads.slice().sort((left, right) => instantOf(right) - instantOf(left))
}
