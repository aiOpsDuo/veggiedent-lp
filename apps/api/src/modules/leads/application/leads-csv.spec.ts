import type { Lead } from '../domain/lead'
import { toCsv } from './leads-csv'

/**
 * O arquivo que a equipe de marketing abre no Excel (SDD § C-12).
 *
 * O que está preso aqui é o que faz o arquivo chegar legível: o BOM, o ponto e
 * vírgula, a acentuação e o escape das células. E o que impede o arquivo de
 * fazer estrago: uma célula não pode virar fórmula por causa do que um
 * desconhecido digitou no formulário.
 */

const LEAD: Lead = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Ana Conceição',
  email: 'ana@exemplo.com',
  telefone: '11999999999',
  nomeCachorro: 'Bidu',
  porteCachorro: 'medio',
  cidadeEstado: 'São Paulo/SP',
  conheceVirbac: 'sim',
  usaProdutoVirbac: 'não',
  qualProdutoVirbac: null,
  aceiteComunicacoes: false,
  origem: 'lp-veggiedent',
  createdAt: '2026-09-02T13:45:07.123Z',
}

const BOM = '﻿'

function linhas(conteudo: string): string[] {
  return conteudo.split('\r\n')
}

/** Uma célula do cabeçalho vem escapada: `"Nome"`. */
function colunas(): string[] {
  const cabecalho = linhas(toCsv([]).content)[0] as string
  return cabecalho.split(';').map((celula) => celula.replace(/^\uFEFF/, '').replace(/^"|"$/g, ''))
}

describe('Colunas do CSV (regra de negócio RN-01)', () => {
  it('traz uma coluna por campo do formulário, com cabeçalho em português', () => {
    expect(colunas()).toEqual([
      'Data de envio (Brasília)',
      'Nome',
      'E-mail',
      'Telefone',
      'Nome do cachorro',
      'Porte do cachorro',
      'Cidade e estado',
      'Conhece a Virbac',
      'Usa produto Virbac',
      'Qual produto Virbac',
      'Aceite de comunicações',
      'Origem',
    ])
  })

  /**
   * O aceite da Política de Privacidade é condição de envio, não dado variável:
   * sem ele nenhum lead é gravado, então a coluna só poderia dizer "sim" (ver
   * `agent_context/CHANGELOG.md`, 2026-09-02).
   */
  it('não tem coluna de aceite da Política de Privacidade', () => {
    expect(colunas().some((coluna) => /LGPD|Política de Privacidade/i.test(coluna))).toBe(false)
    expect(toCsv([LEAD]).content).not.toMatch(/LGPD/)
  })
})

describe('CSV de leads', () => {
  it('começa com o BOM UTF-8, que é o que faz o Excel ler os acentos', () => {
    expect(toCsv([LEAD]).content.startsWith(BOM)).toBe(true)
  })

  it('separa as colunas por ponto e vírgula', () => {
    const cabecalho = linhas(toCsv([]).content)[0] as string
    expect(cabecalho.split(';').length).toBeGreaterThan(10)
    expect(cabecalho).toContain('"Nome";"E-mail"')
  })

  it('preserva a acentuação do conteúdo e dos títulos', () => {
    const conteudo = toCsv([LEAD]).content
    expect(conteudo).toContain('Ana Conceição')
    expect(conteudo).toContain('São Paulo/SP')
    expect(conteudo).toContain('Aceite de comunicações')
  })

  it('traz os três campos que o relay antigo descartava', () => {
    const cabecalho = linhas(toCsv([]).content)[0] as string
    expect(cabecalho).toContain('Conhece a Virbac')
    expect(cabecalho).toContain('Usa produto Virbac')
    expect(cabecalho).toContain('Qual produto Virbac')
  })

  it('escreve a data no fuso de quem lê, Brasília e não UTC', () => {
    expect(toCsv([LEAD]).content).toContain('02/09/2026 10:45:07')
  })

  /**
   * A borda que fazia o mesmo lead ter duas datas: às 23h de 2 de setembro em
   * Brasília o banco já registrou 3 de setembro em UTC. A planilha precisa
   * dizer o que a tela do painel diz.
   */
  it('o lead das 23h de 2 de setembro sai como dia 2, não como dia 3', () => {
    const conteudo = toCsv([{ ...LEAD, createdAt: '2026-09-03T02:00:00.000Z' }]).content

    expect(conteudo).toContain('02/09/2026 23:00:00')
    expect(conteudo).not.toContain('03/09/2026')
  })

  it('instante ilegível vai para a planilha como veio, sem derrubar a linha', () => {
    expect(toCsv([{ ...LEAD, createdAt: 'sem data' }]).content).toContain('"sem data"')
  })

  it('diz Sim e Não no aceite de comunicações, em vez de true e false', () => {
    const semAceite = linhas(toCsv([{ ...LEAD, aceiteComunicacoes: false }]).content)[1] as string
    const comAceite = linhas(toCsv([{ ...LEAD, aceiteComunicacoes: true }]).content)[1] as string
    expect(semAceite).toContain('"não"')
    expect(comAceite).toContain('"sim"')
  })

  /**
   * T30-e: o CSV mostrava o código bruto (`medio`) em vez do rótulo em
   * português ("Médio") — tanto no porte do cão quanto nas respostas de
   * sim/não que também chegam como código, não como booleano.
   */
  it('traduz o porte do cão e as respostas de sim/não para o rótulo em português', () => {
    const linha = linhas(
      toCsv([{ ...LEAD, porteCachorro: 'medio', conheceVirbac: 'sim', usaProdutoVirbac: 'nao' }])
        .content,
    )[1] as string
    expect(linha).toContain('"Médio"')
    expect(linha).toContain('"Sim"')
    expect(linha).toContain('"Não"')
  })

  it('mantém o valor cru quando o código não é nenhum dos conhecidos', () => {
    // O envio novo é validado contra `PorteDeCachorro` (lead-submission.ts), mas
    // um lead já gravado antes dessa validação existir não tem essa garantia —
    // daí o cast, simulando o dado legado que o CSV ainda precisa exportar.
    const porteLegado = 'gigante' as Lead['porteCachorro']
    const linha = linhas(toCsv([{ ...LEAD, porteCachorro: porteLegado }]).content)[1] as string
    expect(linha).toContain('"gigante"')
  })

  it('escapa aspas dentro de uma célula', () => {
    const conteudo = toCsv([{ ...LEAD, nomeCachorro: 'Rex "o bravo"' }]).content
    expect(conteudo).toContain('"Rex ""o bravo"""')
  })

  it('não quebra a linha quando o ponto e vírgula está dentro do texto', () => {
    const conteudo = toCsv([{ ...LEAD, cidadeEstado: 'Rio; RJ' }]).content
    expect(linhas(conteudo)).toHaveLength(3)
    expect(conteudo).toContain('"Rio; RJ"')
  })

  it('neutraliza célula que a planilha executaria como fórmula', () => {
    const conteudo = toCsv([{ ...LEAD, nome: '=HYPERLINK("http://mau.exemplo")' }]).content
    expect(conteudo).toContain('"\'=HYPERLINK')
  })

  it('sem nenhum lead, entrega só o cabeçalho', () => {
    expect(linhas(toCsv([]).content).filter((linha) => linha.length > 0)).toHaveLength(1)
  })

  it('nomeia o arquivo com a data da exportação', () => {
    expect(toCsv([]).filename).toMatch(/^leads-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
