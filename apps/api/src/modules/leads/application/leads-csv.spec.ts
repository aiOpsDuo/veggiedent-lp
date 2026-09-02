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
  aceiteLgpd: true,
  aceiteComunicacoes: false,
  origem: 'lp-veggiedent',
  rdstationStatus: 'nao_enviado',
  rdstationError: 'Credencial ausente.',
  createdAt: '2026-09-02T13:45:07.123Z',
}

const BOM = '﻿'

function linhas(conteudo: string): string[] {
  return conteudo.split('\r\n')
}

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

  it('escreve a data no formato de quem lê, em UTC', () => {
    expect(toCsv([LEAD]).content).toContain('02/09/2026 13:45:07')
  })

  it('diz sim e não em vez de true e false', () => {
    const linha = linhas(toCsv([LEAD]).content)[1] as string
    expect(linha).toContain('"sim"')
    expect(linha).toContain('"não"')
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
