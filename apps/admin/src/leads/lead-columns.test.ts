import { LEAD_COLUMNS, formatReceivedAt, mostRecentFirst } from './lead-columns'
import { leadDeTeste } from '../../test/fake-leads-gateway'

/**
 * As colunas e a ordem da tela de leads, como funções puras — o que se verifica
 * aqui é a regra, não o desenho.
 */

describe('Colunas da tela (regra de negócio RN-01)', () => {
  const cabecalhos = LEAD_COLUMNS.map((coluna) => coluna.header)

  it('tem uma coluna por campo que o visitante preenche', () => {
    expect(cabecalhos).toEqual([
      'Recebido em',
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
      'Status RD Station',
      'Erro RD Station',
    ])
  })

  it('não tem coluna de aceite da Política de Privacidade', () => {
    expect(cabecalhos.some((cabecalho) => /LGPD|Política de Privacidade/i.test(cabecalho))).toBe(
      false,
    )
  })

  it('escreve um traço no lugar do campo que o visitante não preencheu', () => {
    const lead = leadDeTeste({ id: 'x', telefone: null, qualProdutoVirbac: '  ' })
    const valorDe = (header: string): string =>
      LEAD_COLUMNS.find((coluna) => coluna.header === header)?.value(lead) ?? ''

    expect(valorDe('Telefone')).toBe('—')
    expect(valorDe('Qual produto Virbac')).toBe('—')
  })

  it('diz Sim e Não no opt-in, em vez de true e false', () => {
    const coluna = LEAD_COLUMNS.find((cada) => cada.header === 'Aceite de comunicações')
    expect(coluna?.value(leadDeTeste({ id: 'x', aceiteComunicacoes: true }))).toBe('Sim')
    expect(coluna?.value(leadDeTeste({ id: 'x', aceiteComunicacoes: false }))).toBe('Não')
  })
})

describe('Data de recebimento', () => {
  it('escreve o instante no fuso de Brasília, não em UTC', () => {
    expect(formatReceivedAt('2026-09-03T02:00:00.000Z')).toBe('02/09/2026, 23:00')
  })

  it('não deixa uma data ilegível virar célula em branco', () => {
    expect(formatReceivedAt('nem-data-é')).toBe('Data ilegível')
  })
})

describe('Ordem da listagem (SDD § C-12)', () => {
  const antigo = leadDeTeste({ id: 'a', createdAt: '2026-09-01T15:00:00.000Z' })
  const recente = leadDeTeste({ id: 'b', createdAt: '2026-09-03T02:00:00.000Z' })

  it('põe o mais recente primeiro', () => {
    expect(mostRecentFirst([antigo, recente]).map((lead) => lead.id)).toEqual(['b', 'a'])
  })

  it('reconhece o mesmo instante escrito de formas diferentes', () => {
    const mesmoInstanteComFuso = leadDeTeste({ id: 'c', createdAt: '2026-09-02T12:00:00+00:00' })
    const emZulu = leadDeTeste({ id: 'd', createdAt: '2026-09-02T13:00:00.000Z' })

    expect(mostRecentFirst([mesmoInstanteComFuso, emZulu]).map((lead) => lead.id)).toEqual([
      'd',
      'c',
    ])
  })

  it('manda o instante ilegível para o fim, sem deslocar os legíveis', () => {
    const ilegivel = leadDeTeste({ id: 'z', createdAt: 'nem-data-é' })

    expect(mostRecentFirst([ilegivel, antigo, recente]).map((lead) => lead.id)).toEqual([
      'b',
      'a',
      'z',
    ])
  })

  it('não altera a lista recebida', () => {
    const original = [antigo, recente]
    mostRecentFirst(original)
    expect(original.map((lead) => lead.id)).toEqual(['a', 'b'])
  })

  it('aguenta lista vazia e lista de um', () => {
    expect(mostRecentFirst([])).toEqual([])
    expect(mostRecentFirst([antigo]).map((lead) => lead.id)).toEqual(['a'])
  })
})
