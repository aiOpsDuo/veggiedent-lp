/**
 * O horário de Brasília, único lugar da API que sabe converter entre ele e UTC
 * (SDD § C-12).
 *
 * Quem opera o painel está em UTC−3 e pensa no dia que viveu: um lead enviado às
 * 23h de 2 de setembro é, para essa pessoa, um lead do dia 2 — ainda que o banco
 * o guarde como 3 de setembro às 02h em UTC. Por isso tanto o recorte por
 * período quanto a data escrita na exportação usam este fuso, e não o do
 * servidor: se divergissem, o mesmo lead apareceria com datas diferentes na tela
 * e na planilha.
 *
 * O deslocamento é fixo em −03:00: o Brasil não observa horário de verão desde
 * 2019, e um fuso nomeado traria uma tabela de regras que muda com o tempo para
 * resolver um problema que hoje não existe. Se o horário de verão voltar, é aqui
 * que a mudança acontece — em um lugar só.
 */

/** Deslocamento do horário de Brasília em relação a UTC, em milissegundos. */
const BRASILIA_UTC_OFFSET_MS = -3 * 60 * 60 * 1000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * O instante em UTC de um horário de Brasília, a partir do dia (`AAAA-MM-DD`) e
 * do horário escrito como `HH:MM:SS.mmm`.
 */
export function brasiliaInstant(day: string, timeOfDay: string): string {
  const asIfUtc = new Date(`${day}T${timeOfDay}Z`)
  return new Date(asIfUtc.getTime() - BRASILIA_UTC_OFFSET_MS).toISOString()
}

/**
 * O instante escrito como quem lê aqui o escreveria: `2026-09-03T01:45:07.123Z`
 * vira `02/09/2026 22:45:07`. Devolve `null` quando o texto recebido não é uma
 * data — o que mostrar no lugar é decisão de quem chama.
 */
export function formatBrasiliaDateTime(iso: string): string | null {
  const instant = new Date(iso)
  if (Number.isNaN(instant.getTime())) {
    return null
  }

  const local = new Date(instant.getTime() + BRASILIA_UTC_OFFSET_MS)
  const dia = `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`
  const hora = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`
  return `${dia} ${hora}`
}
