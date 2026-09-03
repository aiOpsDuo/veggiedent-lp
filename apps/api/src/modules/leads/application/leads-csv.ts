import type { Lead } from '../domain/lead'

/**
 * O CSV de leads que o Excel em português abre certo (SDD § C-12).
 *
 * Três decisões, e cada uma resolve um jeito específico de o arquivo chegar
 * errado na mão de quem trabalha com ele:
 *
 * - **BOM UTF-8 no início.** Sem ele o Excel no Windows lê o arquivo como
 *   ANSI e "Comunicações" vira "ComunicaÃ§Ãµes". É o que faz a acentuação
 *   sobreviver ao duplo clique, sem ninguém precisar usar o assistente de
 *   importação.
 * - **Ponto e vírgula como separador.** Na configuração regional pt-BR a
 *   vírgula é separador decimal, e o Excel espera `;` entre as colunas. Com
 *   vírgula, a planilha inteira cai numa coluna só.
 * - **Fim de linha CRLF**, como manda o RFC 4180 e como as planilhas esperam.
 *
 * As colunas são as da regra de negócio RN-01: uma por campo que o visitante
 * preenche, mais as operacionais que acompanham o registro. **Não existe coluna
 * de aceite da Política de Privacidade** — sem consentimento nenhum lead é
 * gravado, então ela só poderia dizer "sim" e não prova nada que a existência
 * da linha já não prove (ver `agent_context/CHANGELOG.md`, 2026-09-02). A
 * validação que exige o consentimento continua onde estava; o que sai é apenas
 * a coluna.
 */

const BOM = '\uFEFF'
const SEPARATOR = ';'
const LINE_BREAK = '\r\n'

/** Caracteres com que uma célula vira fórmula ao ser aberta na planilha. */
const FORMULA_STARTERS = ['=', '+', '-', '@', '\t', '\r']

const COLUMNS: readonly { readonly header: string; readonly value: (lead: Lead) => string }[] = [
  { header: 'Data de envio (UTC)', value: (lead) => formatInstant(lead.createdAt) },
  { header: 'Nome', value: (lead) => lead.nome },
  { header: 'E-mail', value: (lead) => lead.email },
  { header: 'Telefone', value: (lead) => lead.telefone ?? '' },
  { header: 'Nome do cachorro', value: (lead) => lead.nomeCachorro ?? '' },
  { header: 'Porte do cachorro', value: (lead) => lead.porteCachorro ?? '' },
  { header: 'Cidade e estado', value: (lead) => lead.cidadeEstado ?? '' },
  { header: 'Conhece a Virbac', value: (lead) => lead.conheceVirbac ?? '' },
  { header: 'Usa produto Virbac', value: (lead) => lead.usaProdutoVirbac ?? '' },
  { header: 'Qual produto Virbac', value: (lead) => lead.qualProdutoVirbac ?? '' },
  { header: 'Aceite de comunicações', value: (lead) => simOuNao(lead.aceiteComunicacoes) },
  { header: 'Origem', value: (lead) => lead.origem ?? '' },
  { header: 'Status RD Station', value: (lead) => lead.rdstationStatus },
  { header: 'Erro RD Station', value: (lead) => lead.rdstationError ?? '' },
]

export interface CsvFile {
  readonly filename: string
  readonly content: string
}

function simOuNao(value: boolean): string {
  return value ? 'sim' : 'não'
}

/** `2026-09-02T13:45:07.123Z` vira `02/09/2026 13:45:07`, como se lê aqui. */
function formatInstant(iso: string): string {
  const instant = new Date(iso)
  if (Number.isNaN(instant.getTime())) {
    return iso
  }
  const pad = (value: number): string => String(value).padStart(2, '0')
  const dia = `${pad(instant.getUTCDate())}/${pad(instant.getUTCMonth() + 1)}/${instant.getUTCFullYear()}`
  const hora = `${pad(instant.getUTCHours())}:${pad(instant.getUTCMinutes())}:${pad(instant.getUTCSeconds())}`
  return `${dia} ${hora}`
}

/**
 * O conteúdo do lead é texto que um desconhecido digitou num formulário
 * público. Uma célula começando por `=` é executada pela planilha ao abrir o
 * arquivo — é a injeção de fórmula em CSV. O apóstrofo à frente faz a planilha
 * tratar a célula como texto, e é visível para quem lê, em vez de rodar.
 */
function neutralizeFormula(value: string): string {
  return FORMULA_STARTERS.some((starter) => value.startsWith(starter)) ? `'${value}` : value
}

function escapeCell(value: string): string {
  return `"${neutralizeFormula(value).replace(/"/g, '""')}"`
}

function toRow(cells: readonly string[]): string {
  return cells.map(escapeCell).join(SEPARATOR)
}

export function toCsv(leads: readonly Lead[]): CsvFile {
  const header = toRow(COLUMNS.map((column) => column.header))
  const rows = leads.map((lead) => toRow(COLUMNS.map((column) => column.value(lead))))
  return {
    filename: `leads-${new Date().toISOString().slice(0, 10)}.csv`,
    content: `${BOM}${[header, ...rows].join(LINE_BREAK)}${LINE_BREAK}`,
  }
}
