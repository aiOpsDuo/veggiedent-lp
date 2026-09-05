import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Download, FileText, Inbox, Tags, UserPlus } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import type { SectionSummary } from '../content/sections-gateway'
import { downloadInBrowser, type FileDownload } from '../leads/file-download'
import { LEADS_PATH, METADATA_PATH, OPERATORS_PATH, SECTIONS_PATH, sectionPath } from '../routing/paths'
import { Card } from '../shared/Card'
import type { DashboardGateway } from './dashboard-gateway'
import { recentLeadsPeriod } from './recent-leads-period'

/**
 * O painel de início (T35, item 10): o que muda de dia para dia, num relance,
 * no lugar da lista de seções que o login abria direto (T33-c removeu a tela
 * "Início" antiga por ela só repetir os links do menu — esta é outra coisa,
 * dados de verdade, não uma segunda navegação).
 *
 * As duas informações vêm de endpoints que já existem: `listLeads` (para a
 * janela recente) e `listSections` (para achar seção despublicada, o mesmo
 * risco que a T28 registrou — página vazia publicada sem aviso). Nenhum dos
 * dois widgets bloqueia o outro: a API de leads fora do ar não impede ver
 * quais seções estão fora da página, e vice-versa.
 */

interface DashboardScreenProps {
  readonly gateway: DashboardGateway
  /** Como o CSV chega ao operador. Injetado para a tela rodar sem navegador. */
  readonly download?: FileDownload
}

type LeadsWidget =
  | { readonly status: 'carregando' }
  | { readonly status: 'pronto'; readonly total: number }
  | { readonly status: 'indisponivel'; readonly message: string }

type SectionsWidget =
  | { readonly status: 'carregando' }
  | { readonly status: 'pronto'; readonly unpublished: readonly SectionSummary[] }
  | { readonly status: 'indisponivel'; readonly message: string }

const UNREACHABLE_MESSAGE = 'Não foi possível carregar agora.'

export function DashboardScreen({
  gateway,
  download = downloadInBrowser,
}: DashboardScreenProps): JSX.Element {
  const { state: authState } = useAuth()
  const accessToken = authState.status === 'ativa' ? authState.session.accessToken : null

  const [leads, setLeads] = useState<LeadsWidget>({ status: 'carregando' })
  const [sections, setSections] = useState<SectionsWidget>({ status: 'carregando' })
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    if (accessToken === null) {
      return
    }
    let current = true
    const period = recentLeadsPeriod()
    void gateway.listLeads(accessToken, { ...period, page: 1 }).then((result) => {
      if (!current) {
        return
      }
      setLeads(
        result.status === 'ok'
          ? { status: 'pronto', total: result.value.total }
          : { status: 'indisponivel', message: UNREACHABLE_MESSAGE },
      )
    })
    return () => {
      current = false
    }
  }, [gateway, accessToken])

  useEffect(() => {
    if (accessToken === null) {
      return
    }
    let current = true
    void gateway.listSections(accessToken).then((result) => {
      if (!current) {
        return
      }
      setSections(
        result.status === 'ok'
          ? { status: 'pronto', unpublished: result.value.filter((s) => !s.isPublished) }
          : { status: 'indisponivel', message: UNREACHABLE_MESSAGE },
      )
    })
    return () => {
      current = false
    }
  }, [gateway, accessToken])

  const exportRecentLeads = async (): Promise<void> => {
    if (accessToken === null) {
      return
    }
    setExportError(null)
    setExporting(true)
    const result = await gateway.exportLeads(accessToken, recentLeadsPeriod())
    setExporting(false)
    if (result.status === 'ok') {
      download(result.value)
      return
    }
    setExportError(result.message)
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Painel</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Inbox aria-hidden="true" className="h-5 w-5" />
            <h2 className="text-sm font-medium">Leads dos últimos 7 dias</h2>
          </div>

          {leads.status === 'carregando' && (
            <p role="status" className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Carregando…
            </p>
          )}
          {leads.status === 'indisponivel' && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {leads.message}
            </p>
          )}
          {leads.status === 'pronto' && (
            <p className="mt-1 text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {leads.total}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              to={LEADS_PATH}
              className="font-medium text-brand-primary-hover underline hover:text-brand-primary"
            >
              Ver leads recebidos
            </Link>
            <button
              type="button"
              disabled={exporting || accessToken === null}
              onClick={() => void exportRecentLeads()}
              className="inline-flex items-center gap-1 text-slate-600 underline hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              {exporting ? 'Exportando…' : 'Exportar os 7 dias em CSV'}
            </button>
          </div>
          {exportError !== null && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {exportError}
            </p>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <FileText aria-hidden="true" className="h-5 w-5" />
            <h2 className="text-sm font-medium">Seções fora do ar</h2>
          </div>

          {sections.status === 'carregando' && (
            <p role="status" className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Carregando…
            </p>
          )}
          {sections.status === 'indisponivel' && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {sections.message}
            </p>
          )}
          {sections.status === 'pronto' && sections.unpublished.length === 0 && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              Todas as seções estão publicadas.
            </p>
          )}
          {sections.status === 'pronto' && sections.unpublished.length > 0 && (
            <ul className="mt-3 space-y-2">
              {sections.unpublished.map((summary) => (
                <li key={summary.key}>
                  <Link
                    to={sectionPath(summary.key)}
                    className="flex items-center gap-2 text-sm text-amber-700 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {summary.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Atalhos</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            to={SECTIONS_PATH}
            className="inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FileText aria-hidden="true" className="h-4 w-4" />
            Editar seções
          </Link>
          <Link
            to={METADATA_PATH}
            className="inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Tags aria-hidden="true" className="h-4 w-4" />
            Editar metadados
          </Link>
          <Link
            to={OPERATORS_PATH}
            className="inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            Criar operador
          </Link>
        </div>
      </Card>
    </section>
  )
}
