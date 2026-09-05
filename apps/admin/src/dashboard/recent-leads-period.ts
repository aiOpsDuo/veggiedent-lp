import type { LeadPeriod } from '../leads/leads-gateway'

/**
 * O recorte "últimos 7 dias" do painel de início (T35, item 10), em dias
 * `AAAA-MM-DD` de Brasília — o mesmo formato que `LeadsGateway.listLeads` já
 * espera (SDD § C-12).
 *
 * Só uma aproximação de fuso é aceitável aqui: o corte exato de meia-noite em
 * Brasília é responsabilidade da API na consulta de verdade (o dia que ela
 * aplica no filtro), não deste resumo de painel — uma diferença de um dia na
 * borda não muda a leitura de "quantos leads chegaram esta semana".
 */
const BRASILIA_TIME_ZONE = 'America/Sao_Paulo'
const ISO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: BRASILIA_TIME_ZONE })
const RECENT_WINDOW_IN_DAYS = 7

function toBrasiliaIsoDate(date: Date): string {
  return ISO_DATE_FORMATTER.format(date)
}

export function recentLeadsPeriod(now: Date = new Date()): LeadPeriod {
  const from = new Date(now)
  from.setUTCDate(from.getUTCDate() - (RECENT_WINDOW_IN_DAYS - 1))
  return { from: toBrasiliaIsoDate(from), to: toBrasiliaIsoDate(now) }
}
