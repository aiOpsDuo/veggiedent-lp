import { useEffect, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { Card } from '../shared/Card'
import { Notice } from '../shared/Notice'
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

/**
 * A tabela tem 13 colunas, e "Ações" (excluir) ficava fora da área visível em
 * telas normais, sem nenhum indício de que havia mais conteúdo à direita
 * (T30-f). Fixá-la com `sticky` resolve os dois problemas de uma vez: o botão
 * de excluir está sempre alcançável, e a sombra à esquerda é o próprio indício
 * visual de que a rolagem continua por baixo dela.
 */
const ACTIONS_CELL_CLASS =
  'sticky right-0 z-10 whitespace-nowrap bg-slate-100 px-3 py-2 shadow-[-8px_0_8px_-6px_rgba(15,23,42,0.35)] dark:bg-slate-800'
const ACTIONS_BODY_CELL_CLASS =
  'sticky right-0 z-10 whitespace-nowrap bg-white px-3 py-2 shadow-[-8px_0_8px_-6px_rgba(15,23,42,0.35)] dark:bg-slate-900'

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
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Leads recebidos
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          O dia do filtro é o de Brasília (UTC−3).
        </p>
      </header>

      <PeriodFilter
        period={typedPeriod}
        onChange={setTypedPeriod}
        onApply={applyFilter}
        onClear={clearFilter}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          {summaryOf(listing)}
        </p>
        <button
          type="button"
          disabled={busy || accessToken === null}
          onClick={() => void exportLeads()}
          className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          Exportar CSV do período
        </button>
      </div>

      {notice !== null && <Notice tone={notice.tone} message={notice.message} />}

      {listing.status === 'indisponivel' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {listing.message}
        </p>
      )}

      {listing.status === 'pronto' && leads.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Nenhum lead recebido no período.
        </p>
      )}

      {leads.length > 0 && (
        <Card className="!p-0 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Leads recebidos, do mais recente ao mais antigo
            </caption>
            <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                {LEAD_COLUMNS.map((column) => (
                  <th key={column.header} scope="col" className="whitespace-nowrap px-3 py-2">
                    {column.header}
                  </th>
                ))}
                <th scope="col" className={ACTIONS_CELL_CLASS}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
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
        </Card>
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
      className="animate-fade-in-up flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="space-y-1">
        <label
          htmlFor="leads-de"
          className="block text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          De
        </label>
        <input
          id="leads-de"
          type="date"
          value={period.from}
          onChange={(event) => onChange({ ...period, from: event.target.value })}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="leads-ate"
          className="block text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          Até
        </label>
        <input
          id="leads-ate"
          type="date"
          value={period.to}
          onChange={(event) => onChange({ ...period, to: event.target.value })}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <button
        type="submit"
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
      >
        Filtrar
      </button>
      <button
        type="button"
        onClick={onClear}
        className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
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
        <td
          key={column.header}
          className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300"
        >
          {column.value(lead)}
        </td>
      ))}
      <td className={ACTIONS_BODY_CELL_CLASS}>
        {confirming ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-red-700 dark:text-red-400">
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
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
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
            className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
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
        className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Página anterior
      </button>
      <span className="text-slate-600 dark:text-slate-400">{`Página ${page.page} de ${lastPage}`}</span>
      <button
        type="button"
        disabled={busy || page.page >= lastPage}
        onClick={() => onGoTo(page.page + 1)}
        className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Próxima página
      </button>
    </nav>
  )
}
