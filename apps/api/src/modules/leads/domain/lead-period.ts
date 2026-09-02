import { FieldValidationError } from '../../../shared/domain/field-validation.error'

/**
 * O recorte por data da consulta administrativa de leads
 * (SDD § "Endpoints administrativos" — filtros `from` e `to`).
 *
 * Os dois filtros são dias no calendário (`AAAA-MM-DD`), não instantes: quem
 * usa o painel pensa em "de 1º a 5 de setembro", e um dia é um intervalo. `from`
 * vira o começo do dia e `to` o fim dele, para que o lead enviado às 23h50 do
 * dia final entre no resultado — a condição de contorno que um filtro ingênuo
 * (`created_at <= '2026-09-05'`) perderia em silêncio.
 *
 * **Limite conhecido:** os dois extremos são calculados em UTC, e o operador
 * está em UTC−3. Um lead enviado depois das 21h de Brasília cai no dia seguinte
 * em UTC. Está documentado no README; corrigir exige decidir o fuso do produto,
 * que o SDD não fixa.
 */
const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/

const INVALID_DATE_MESSAGE = 'Informe a data no formato AAAA-MM-DD.'
const REVERSED_PERIOD_MESSAGE = 'A data inicial não pode ser depois da data final.'

export interface LeadPeriod {
  /** Instante inicial, inclusivo, em ISO 8601. */
  readonly from: string | null
  /** Instante final, inclusivo, em ISO 8601. */
  readonly to: string | null
}

/** Rejeita 2026-02-31 e afins: forma certa não é o mesmo que data existente. */
function isRealDay(day: string): boolean {
  const parsed = new Date(`${day}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day)
}

function toInstant(day: string | undefined, field: string, endOfDay: boolean): string | null {
  if (day === undefined || day.trim().length === 0) {
    return null
  }
  const trimmed = day.trim()
  if (!DAY_FORMAT.test(trimmed) || !isRealDay(trimmed)) {
    throw new FieldValidationError({ [field]: INVALID_DATE_MESSAGE })
  }
  return `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
}

export function toLeadPeriod(from?: string, to?: string): LeadPeriod {
  const period: LeadPeriod = {
    from: toInstant(from, 'from', false),
    to: toInstant(to, 'to', true),
  }

  if (period.from !== null && period.to !== null && period.from > period.to) {
    throw new FieldValidationError({ from: REVERSED_PERIOD_MESSAGE })
  }

  return period
}
