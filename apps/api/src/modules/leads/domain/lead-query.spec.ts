import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import { toLeadPeriod } from './lead-period'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, toLeadQuery } from './lead-query'

/**
 * As bordas do filtro por período e da paginação (SDD § C-12). São as duas
 * entradas que vêm da tela e que ninguém digita com cuidado.
 */

describe('período da consulta de leads', () => {
  it('sem filtro, não recorta nada', () => {
    expect(toLeadPeriod(undefined, undefined)).toEqual({ from: null, to: null })
  })

  it('inclui o dia inteiro de Brasília nos dois extremos', () => {
    expect(toLeadPeriod('2026-09-01', '2026-09-05')).toEqual({
      from: '2026-09-01T03:00:00.000Z',
      to: '2026-09-06T02:59:59.999Z',
    })
  })

  it('aceita um único dia como início e fim', () => {
    const period = toLeadPeriod('2026-09-02', '2026-09-02')
    expect(period.from).toBe('2026-09-02T03:00:00.000Z')
    expect(period.to).toBe('2026-09-03T02:59:59.999Z')
  })

  /**
   * A borda que o recorte em UTC perdia: quem envia o formulário às 23h de um
   * dia em Brasília aparece no banco como 02h do dia seguinte em UTC. Para o
   * operador, é um lead do dia em que ele o recebeu.
   */
  it('um lead das 23h de Brasília cai no dia de Brasília, não no seguinte', () => {
    const vinteETresHoras = new Date('2026-09-02T23:00:00.000-03:00').toISOString()
    const diaDoLead = toLeadPeriod('2026-09-02', '2026-09-02')
    const diaSeguinte = toLeadPeriod('2026-09-03', '2026-09-03')

    expect(vinteETresHoras >= (diaDoLead.from as string)).toBe(true)
    expect(vinteETresHoras <= (diaDoLead.to as string)).toBe(true)
    expect(vinteETresHoras < (diaSeguinte.from as string)).toBe(true)
  })

  it('o primeiro instante do dia em Brasília não escapa para o dia anterior', () => {
    const meiaNoite = new Date('2026-09-02T00:00:00.000-03:00').toISOString()

    expect(meiaNoite).toBe(toLeadPeriod('2026-09-02').from)
    expect(meiaNoite > (toLeadPeriod(undefined, '2026-09-01').to as string)).toBe(true)
  })

  it('recusa data fora do formato', () => {
    expect(() => toLeadPeriod('02/09/2026')).toThrow(FieldValidationError)
  })

  it('recusa dia que não existe no calendário', () => {
    expect(() => toLeadPeriod('2026-02-31')).toThrow(FieldValidationError)
  })

  it('recusa período invertido', () => {
    expect(() => toLeadPeriod('2026-09-10', '2026-09-01')).toThrow(FieldValidationError)
  })
})

describe('paginação da consulta de leads', () => {
  it('sem parâmetro, começa na primeira página com o tamanho padrão', () => {
    expect(toLeadQuery({})).toEqual({
      period: { from: null, to: null },
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
  })

  it('recusa página zero', () => {
    expect(() => toLeadQuery({ page: 0 })).toThrow(FieldValidationError)
  })

  it('recusa página fracionária', () => {
    expect(() => toLeadQuery({ page: 1.5 })).toThrow(FieldValidationError)
  })

  it('aceita o tamanho máximo de página', () => {
    expect(toLeadQuery({ pageSize: MAX_PAGE_SIZE }).pageSize).toBe(MAX_PAGE_SIZE)
  })

  it('recusa tamanho de página acima do máximo', () => {
    expect(() => toLeadQuery({ pageSize: MAX_PAGE_SIZE + 1 })).toThrow(FieldValidationError)
  })
})
