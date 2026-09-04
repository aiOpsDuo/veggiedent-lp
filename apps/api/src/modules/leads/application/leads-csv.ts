import { formatBrasiliaDateTime } from '../domain/brasilia-time'
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
 * A data de envio sai em **horário de Brasília**, o mesmo fuso do filtro de
 * período e o mesmo que a tela do painel mostra (SDD § C-12). Em UTC o lead
 * recebido às 23h de 2 de setembro apareceria como 3 de setembro na planilha e
 * como 2 de setembro na tela — duas datas para o mesmo lead.
 *
 * As colunas são as da regra de negócio RN-01: uma por campo que o visitante
 * preenche, mais as operacionais que acompanham o registro. **Não existe coluna
 * de aceite da Política de Privacidade** — sem consentimento nenhum lead é
 * gravado, então ela só poderia dizer "sim" e não prova nada que a existência
 * da linha já não prove (ver `agent_context/CHANGELOG.md`, 2026-09-02). A
 * validação que exige o consentimento continua onde estava; o que sai é apenas
 * a coluna.
 *
 * Desde que o repasse a sistema externo foi descontinuado (2026-09-03) este
 * arquivo é o **mecanismo de saída** do lead, não uma conveniência: o banco do
 * CMS é o único lugar onde o dado existe, e o CSV é a única forma de tirá-lo
 * de lá.
 */

const BOM = '\uFEFF'
const SEPARATOR = ';'
const LINE_BREAK = '\r\n'

/** Caracteres com que uma célula vira fórmula ao ser aberta na planilha. */
const FORMULA_STARTERS = ['=', '+', '-', '@', '\t', '\r']

const COLUMNS: readonly { readonly header: string; readonly value: (lead: Lead) => string }[] = [
  { header: 'Data de envio (Brasília)', value: (lead) => formatInstant(lead.createdAt) },
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
]

export interface CsvFile {
  readonly filename: string
  readonly content: string
}

function simOuNao(value: boolean): string {
  return value ? 'sim' : 'não'
}

/**
 * Um instante que o banco não soube devolver como data vai para a planilha como
 * veio: perder a linha inteira por causa de uma célula seria pior do que
 * entregar o texto cru para quem precisa investigá-lo.
 */
function formatInstant(iso: string): string {
  return formatBrasiliaDateTime(iso) ?? iso
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
