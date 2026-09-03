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
 * **O dia é o de Brasília, não o de UTC.** Quem opera o painel está em UTC−3 e
 * pensa no dia que viveu: um lead enviado às 23h de 2 de setembro é, para essa
 * pessoa, um lead do dia 2 — ainda que o banco o guarde como 3 de setembro às
 * 02h em UTC. Recortar em UTC empurraria para o dia seguinte tudo o que chega
 * depois das 21h de Brasília, silenciosamente. Os extremos são calculados no
 * fuso do operador e convertidos para o instante em UTC que o banco compara.
 *
 * O deslocamento é fixo em −03:00: o Brasil não observa horário de verão desde
 * 2019, e um fuso nomeado traria uma tabela de regras que muda com o tempo para
 * resolver um problema que hoje não existe. Se o horário de verão voltar, é
 * aqui que a mudança acontece — em um lugar só.
 */
const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/

/** Deslocamento do horário de Brasília em relação a UTC (SDD § C-12). */
const BRASILIA_UTC_OFFSET = '-03:00'

const INVALID_DATE_MESSAGE = 'Informe a data no formato AAAA-MM-DD.'
const REVERSED_PERIOD_MESSAGE = 'A data inicial não pode ser depois da data final.'

export interface LeadPeriod {
  /** Instante inicial, inclusivo, em UTC. */
  readonly from: string | null
  /** Instante final, inclusivo, em UTC. */
  readonly to: string | null
}

/** Rejeita 2026-02-31 e afins: forma certa não é o mesmo que data existente. */
function isRealDay(day: string): boolean {
  const parsed = new Date(`${day}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day)
}

/** O instante em UTC de um horário de Brasília escrito como `HH:MM:SS.mmm`. */
function brasiliaInstant(day: string, timeOfDay: string): string {
  return new Date(`${day}T${timeOfDay}${BRASILIA_UTC_OFFSET}`).toISOString()
}

function toDay(day: string | undefined, field: string): string | null {
  if (day === undefined || day.trim().length === 0) {
    return null
  }
  const trimmed = day.trim()
  if (!DAY_FORMAT.test(trimmed) || !isRealDay(trimmed)) {
    throw new FieldValidationError({ [field]: INVALID_DATE_MESSAGE })
  }
  return trimmed
}

export function toLeadPeriod(from?: string, to?: string): LeadPeriod {
  const firstDay = toDay(from, 'from')
  const lastDay = toDay(to, 'to')

  const period: LeadPeriod = {
    from: firstDay === null ? null : brasiliaInstant(firstDay, '00:00:00.000'),
    to: lastDay === null ? null : brasiliaInstant(lastDay, '23:59:59.999'),
  }

  if (period.from !== null && period.to !== null && period.from > period.to) {
    throw new FieldValidationError({ from: REVERSED_PERIOD_MESSAGE })
  }

  return period
}
