import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { orderedSectionSchemas, type SectionKey } from '@veggiedent/content-schema'
import { useAuth } from '../auth/auth-context'
import { sectionPath } from '../routing/paths'
import { Card } from '../shared/Card'
import type { SectionSummary, SectionsGateway } from './sections-gateway'
import { formatUpdatedAt } from './updated-at'

/**
 * A lista das 9 seções (SDD § C-03).
 *
 * As linhas saem do **esquema**, na ordem em que as seções aparecem na página;
 * a API preenche o que só ela sabe — se está publicada e quando foi editada. O
 * conjunto é fechado e conhecido pelo painel, então uma resposta incompleta da
 * API faz uma seção aparecer sem estado, nunca desaparecer da lista.
 */

interface SectionsScreenProps {
  readonly gateway: SectionsGateway
}

type Loading =
  | { readonly status: 'carregando' }
  | { readonly status: 'pronto'; readonly summaries: ReadonlyMap<SectionKey, SectionSummary> }
  | { readonly status: 'indisponivel'; readonly message: string }

const UNKNOWN_STATE = 'Sem informação'

function publicationLabel(summary: SectionSummary | undefined): string {
  if (summary === undefined) {
    return UNKNOWN_STATE
  }
  return summary.isPublished ? 'Aparece na página' : 'Fora da página'
}

export function SectionsScreen({ gateway }: SectionsScreenProps): JSX.Element {
  const { state: authState } = useAuth()
  const accessToken = authState.status === 'ativa' ? authState.session.accessToken : null
  const [loading, setLoading] = useState<Loading>({ status: 'carregando' })

  useEffect(() => {
    if (accessToken === null) {
      return
    }
    let current = true
    void gateway.listSections(accessToken).then((result) => {
      if (!current) {
        return
      }
      setLoading(
        result.status === 'ok'
          ? {
              status: 'pronto',
              summaries: new Map(result.value.map((summary) => [summary.key, summary])),
            }
          : { status: 'indisponivel', message: result.message },
      )
    })
    return () => {
      current = false
    }
  }, [gateway, accessToken])

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Seções da página
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Na ordem em que aparecem na página. Escolha uma para editar.
        </p>
      </header>

      {loading.status === 'carregando' && (
        <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
          Carregando as seções…
        </p>
      )}

      {loading.status === 'indisponivel' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {loading.message}
        </p>
      )}

      <Card className="!p-0">
        <ol className="divide-y divide-slate-200 dark:divide-slate-700">
          {orderedSectionSchemas.map((schema, position) => {
            const summary =
              loading.status === 'pronto' ? loading.summaries.get(schema.key) : undefined
            return (
              <li
                key={schema.key}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <Link
                    to={sectionPath(schema.key)}
                    className="font-medium text-slate-900 underline hover:text-brand-primary-hover dark:text-slate-100"
                  >
                    {`${position + 1}. ${schema.label}`}
                  </Link>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {`Última edição: ${
                      summary === undefined ? UNKNOWN_STATE : formatUpdatedAt(summary.updatedAt)
                    }`}
                  </p>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {publicationLabel(summary)}
                </span>
              </li>
            )
          })}
        </ol>
      </Card>
    </section>
  )
}
