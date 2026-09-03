import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { downloadInBrowser, type FileDownload } from './file-download'
import { LEAD_COLUMNS, mostRecentFirst } from './lead-columns'
import type { LeadPeriod, LeadView, LeadsGateway, LeadsPage, LeadsQuery } from './leads-gateway'

/**
 * A tela de leads (SDD § C-12): listagem do mais recente ao mais antigo, filtro
 * por período, exportação em CSV e exclusão definitiva a pedido do titular.
 *
 * O filtro tem dois estados de propósito — o que está digitado e o que está
 * aplicado. A exportação usa o **aplicado**, que é o mesmo recorte que a tabela
 * está mostrando; usar o digitado exportaria um período que o operador ainda
 * não viu.
 *
 * O recorte do dia é feito pela API, em horário de Brasília. O painel manda o
 * dia escolhido e não converte nada: fuso resolvido em dois lugares vira dois
 * resultados diferentes na primeira vez que um deles mudar.
 */

interface LeadsScreenProps {
  readonly gateway: LeadsGateway
  /** Como o arquivo chega ao operador. Injetado para a tela rodar sem navegador. */
  readonly download?: FileDownload
}

type Listing =
  | { readonly status: 'carregando' }
  | { readonly status: 'pronto'; readonly page: LeadsPage }
  | { readonly status: 'indisponivel'; readonly message: string }

/** Aviso de uma ação pontual — exportar ou excluir —, não do carregamento. */
type Notice =
  | { readonly tone: 'sucesso'; readonly message: string }
  | { readonly tone: 'falha'; readonly message: string }

const EMPTY_PERIOD: LeadPeriod = { from: '', to: '' }

const FIRST_PAGE = 1

const EXPORTED_MESSAGE = 'Exportação concluída. O arquivo foi baixado.'
const DELETED_MESSAGE = 'Lead excluído definitivamente.'

export function LeadsScreen({
  gateway,
  download = downloadInBrowser,
}: LeadsScreenProps): JSX.Element {
  const { state: authState } = useAuth()
  const accessToken = authState.status === 'ativa' ? authState.session.accessToken : null

  const [typedPeriod, setTypedPeriod] = useState<LeadPeriod>(EMPTY_PERIOD)
  const [query, setQuery] = useState<LeadsQuery>({ ...EMPTY_PERIOD, page: FIRST_PAGE })
  const [listing, setListing] = useState<Listing>({ status: 'carregando' })
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Sobe a cada exclusão: é o pedido de releitura da mesma consulta. */
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (accessToken === null) {
      return
    }
    let current = true
    setListing({ status: 'carregando' })
    void gateway.listLeads(accessToken, query).then((result) => {
      if (!current) {
        return
      }
      setListing(
        result.status === 'ok'
          ? { status: 'pronto', page: result.value }
          : { status: 'indisponivel', message: result.message },
      )
    })
    return () => {
      current = false
    }
  }, [gateway, accessToken, query, revision])

  const applyFilter = (): void => {
    setNotice(null)
    setConfirmingId(null)
    setQuery({ ...typedPeriod, page: FIRST_PAGE })
  }

  const clearFilter = (): void => {
    setTypedPeriod(EMPTY_PERIOD)
    setNotice(null)
    setConfirmingId(null)
    setQuery({ ...EMPTY_PERIOD, page: FIRST_PAGE })
  }

  const goToPage = (page: number): void => {
    setConfirmingId(null)
    setQuery((current) => ({ ...current, page }))
  }

  const exportLeads = async (): Promise<void> => {
    if (accessToken === null) {
      return
    }
    setBusy(true)
    const result = await gateway.exportLeads(accessToken, { from: query.from, to: query.to })
    setBusy(false)
    if (result.status === 'ok') {
      download(result.value)
      setNotice({ tone: 'sucesso', message: EXPORTED_MESSAGE })
      return
    }
    setNotice({ tone: 'falha', message: result.message })
  }

  const deleteLead = async (id: string): Promise<void> => {
    if (accessToken === null) {
      return
    }
    setBusy(true)
    const result = await gateway.deleteLead(accessToken, id)
    setBusy(false)
    setConfirmingId(null)
    if (result.status === 'excluido') {
      setNotice({ tone: 'sucesso', message: DELETED_MESSAGE })
      setRevision((current) => current + 1)
      return
    }
    setNotice({ tone: 'falha', message: result.message })
  }

  const leads = listing.status === 'pronto' ? mostRecentFirst(listing.page.leads) : []

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Leads recebidos</h1>
        <p className="text-sm text-slate-600">
          Do mais recente ao mais antigo. O dia do filtro é o de Brasília (UTC−3).
        </p>
      </header>

      <PeriodFilter
        period={typedPeriod}
        onChange={setTypedPeriod}
        onApply={applyFilter}
        onClear={clearFilter}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-slate-600">
          {summaryOf(listing)}
        </p>
        <button
          type="button"
          disabled={busy || accessToken === null}
          onClick={() => void exportLeads()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Exportar CSV do período
        </button>
      </div>

      {notice !== null && (
        <p
          role={notice.tone === 'falha' ? 'alert' : 'status'}
          className={
            notice.tone === 'falha'
              ? 'rounded bg-red-50 px-3 py-2 text-sm text-red-700'
              : 'rounded bg-green-50 px-3 py-2 text-sm text-green-800'
          }
        >
          {notice.message}
        </p>
      )}

      {listing.status === 'indisponivel' && (
        <p role="alert" className="text-sm text-red-600">
          {listing.message}
        </p>
      )}

      {listing.status === 'pronto' && leads.length === 0 && (
        <p className="text-sm text-slate-600">Nenhum lead recebido no período.</p>
      )}

      {leads.length > 0 && (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Leads recebidos, do mais recente ao mais antigo
            </caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                {LEAD_COLUMNS.map((column) => (
                  <th key={column.header} scope="col" className="whitespace-nowrap px-3 py-2">
                    {column.header}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  confirming={confirmingId === lead.id}
                  busy={busy}
                  onAskConfirmation={() => {
                    setNotice(null)
                    setConfirmingId(lead.id)
                  }}
                  onCancel={() => setConfirmingId(null)}
                  onConfirm={() => void deleteLead(lead.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {listing.status === 'pronto' && (
        <Pagination page={listing.page} busy={busy} onGoTo={goToPage} />
      )}
    </section>
  )
}

function summaryOf(listing: Listing): string {
  if (listing.status === 'carregando') {
    return 'Carregando os leads…'
  }
  if (listing.status === 'indisponivel') {
    return 'Não foi possível listar os leads.'
  }
  const { total } = listing.page
  return total === 1 ? '1 lead no período.' : `${total} leads no período.`
}

interface PeriodFilterProps {
  readonly period: LeadPeriod
  readonly onChange: (period: LeadPeriod) => void
  readonly onApply: () => void
  readonly onClear: () => void
}

function PeriodFilter({ period, onChange, onApply, onClear }: PeriodFilterProps): JSX.Element {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onApply()
      }}
      className="flex flex-wrap items-end gap-3 rounded border border-slate-200 bg-white p-4"
    >
      <div className="space-y-1">
        <label htmlFor="leads-de" className="block text-sm font-medium text-slate-800">
          De
        </label>
        <input
          id="leads-de"
          type="date"
          value={period.from}
          onChange={(event) => onChange({ ...period, from: event.target.value })}
          className="rounded border border-slate-300 px-3 py-2 text-slate-900"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="leads-ate" className="block text-sm font-medium text-slate-800">
          Até
        </label>
        <input
          id="leads-ate"
          type="date"
          value={period.to}
          onChange={(event) => onChange({ ...period, to: event.target.value })}
          className="rounded border border-slate-300 px-3 py-2 text-slate-900"
        />
      </div>
      <button
        type="submit"
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Filtrar
      </button>
      <button
        type="button"
        onClick={onClear}
        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
      >
        Limpar filtro
      </button>
    </form>
  )
}

interface LeadRowProps {
  readonly lead: LeadView
  readonly confirming: boolean
  readonly busy: boolean
  readonly onAskConfirmation: () => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

/**
 * A exclusão é em dois passos, e o segundo diz o que vai acontecer: o pedido do
 * titular apaga o registro para sempre e não tem desfazer (LGPD, PRD). Um
 * clique único numa lista larga seria fácil demais de dar por engano.
 */
function LeadRow({
  lead,
  confirming,
  busy,
  onAskConfirmation,
  onCancel,
  onConfirm,
}: LeadRowProps): JSX.Element {
  return (
    <tr>
      {LEAD_COLUMNS.map((column) => (
        <td key={column.header} className="whitespace-nowrap px-3 py-2 text-slate-700">
          {column.value(lead)}
        </td>
      ))}
      <td className="px-3 py-2">
        {confirming ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-red-700">
              Excluir para sempre? Não há desfazer.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {`Confirmar a exclusão do lead de ${lead.nome}`}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onAskConfirmation}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {`Excluir o lead de ${lead.nome}`}
          </button>
        )}
      </td>
    </tr>
  )
}

interface PaginationProps {
  readonly page: LeadsPage
  readonly busy: boolean
  readonly onGoTo: (page: number) => void
}

function Pagination({ page, busy, onGoTo }: PaginationProps): JSX.Element | null {
  const lastPage = Math.max(FIRST_PAGE, Math.ceil(page.total / page.pageSize))
  if (lastPage === FIRST_PAGE) {
    return null
  }

  return (
    <nav aria-label="Páginas de leads" className="flex items-center gap-3 text-sm">
      <button
        type="button"
        disabled={busy || page.page <= FIRST_PAGE}
        onClick={() => onGoTo(page.page - 1)}
        className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        Página anterior
      </button>
      <span className="text-slate-600">{`Página ${page.page} de ${lastPage}`}</span>
      <button
        type="button"
        disabled={busy || page.page >= lastPage}
        onClick={() => onGoTo(page.page + 1)}
        className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        Próxima página
      </button>
    </nav>
  )
}
