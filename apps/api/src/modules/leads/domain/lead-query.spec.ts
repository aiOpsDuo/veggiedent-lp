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

  it('inclui o dia inteiro nos dois extremos', () => {
    expect(toLeadPeriod('2026-09-01', '2026-09-05')).toEqual({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-05T23:59:59.999Z',
    })
  })

  it('aceita um único dia como início e fim', () => {
    const period = toLeadPeriod('2026-09-02', '2026-09-02')
    expect(period.from).toBe('2026-09-02T00:00:00.000Z')
    expect(period.to).toBe('2026-09-02T23:59:59.999Z')
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
