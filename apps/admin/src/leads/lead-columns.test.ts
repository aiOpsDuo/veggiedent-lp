import {
  LEAD_COLUMNS,
  formatLgpdConsent,
  formatReceivedAt,
  mostRecentFirst,
} from './lead-columns'
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
      'Consentimento LGPD',
    ])
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

/**
 * O registro do consentimento LGPD, pedido pelo cliente em 2026-10-02 para o
 * Marketing gerir a base e atender a revogação.
 */
describe('Consentimento LGPD', () => {
  const coluna = LEAD_COLUMNS.find((cada) => cada.header === 'Consentimento LGPD')
  const detalhes = (lead: ReturnType<typeof leadDeTeste>) => coluna?.details?.(lead) ?? []

  it('diz Sim e quando, no fuso de Brasília', () => {
    expect(
      formatLgpdConsent(leadDeTeste({ id: 'x', aceiteLgpdEm: '2026-10-02T17:30:00.000Z' })),
    ).toBe('Sim — 02/10/2026, 14:30')
  })

  it('sem instante registrado, diz só Sim, sem inventar data', () => {
    expect(formatLgpdConsent(leadDeTeste({ id: 'x', aceiteLgpdEm: null }))).toBe('Sim')
  })

  it('diz Não quando o lead não tem aceite', () => {
    expect(formatLgpdConsent(leadDeTeste({ id: 'x', aceiteLgpd: false }))).toBe('Não')
  })

  it('os detalhes trazem o texto aceito e a política, como link', () => {
    expect(detalhes(leadDeTeste({ id: 'x' }))).toEqual([
      { label: 'Texto aceito', value: 'Li e aceito a Política de Privacidade.' },
      {
        label: 'Política aceita',
        value: 'https://br.virbac.com/home/legal-notice.html',
        href: 'https://br.virbac.com/home/legal-notice.html',
      },
    ])
  })

  it('no lead novo sem texto enviado, não o confunde com um lead antigo', () => {
    expect(detalhes(leadDeTeste({ id: 'x', aceiteLgpdTexto: null }))[0]).toEqual({
      label: 'Texto aceito',
      value: 'Não enviado no formulário',
    })
  })

  it('no lead antigo, diz que o texto e a política não foram registrados', () => {
    const antigo = leadDeTeste({ id: 'x', aceiteLgpdTexto: null, aceiteLgpdPoliticaUrl: null })

    expect(detalhes(antigo)).toEqual([
      { label: 'Texto aceito', value: 'Não registrado (lead anterior a 02/10/2026)' },
      { label: 'Política aceita', value: 'Não registrado (lead anterior a 02/10/2026)' },
    ])
  })
})

/**
 * T30-e: a tela mostrava o código bruto (`medio`) em vez do rótulo em
 * português ("Médio") — tanto no porte do cão quanto nas respostas de sim/não
 * que também chegam como código.
 */
describe('Tradução de código para rótulo (T30-e)', () => {
  const valorDe = (header: string, lead: ReturnType<typeof leadDeTeste>): string =>
    LEAD_COLUMNS.find((coluna) => coluna.header === header)?.value(lead) ?? ''

  it('traduz os três portes conhecidos', () => {
    expect(valorDe('Porte do cachorro', leadDeTeste({ id: 'p', porteCachorro: 'pequeno' }))).toBe(
      'Pequeno',
    )
    expect(valorDe('Porte do cachorro', leadDeTeste({ id: 'm', porteCachorro: 'medio' }))).toBe(
      'Médio',
    )
    expect(valorDe('Porte do cachorro', leadDeTeste({ id: 'g', porteCachorro: 'grande' }))).toBe(
      'Grande',
    )
  })

  it('traduz sim e não nos campos que vêm como código', () => {
    expect(valorDe('Conhece a Virbac', leadDeTeste({ id: 'a', conheceVirbac: 'sim' }))).toBe(
      'Sim',
    )
    expect(valorDe('Usa produto Virbac', leadDeTeste({ id: 'b', usaProdutoVirbac: 'nao' }))).toBe(
      'Não',
    )
  })

  it('mostra o valor cru quando o código não é nenhum dos conhecidos', () => {
    expect(
      valorDe('Porte do cachorro', leadDeTeste({ id: 'x', porteCachorro: 'gigante' })),
    ).toBe('gigante')
  })

  it('não troca o traço do campo vazio por um rótulo', () => {
    expect(valorDe('Porte do cachorro', leadDeTeste({ id: 'x', porteCachorro: null }))).toBe('—')
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
