import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { orderedSectionSchemas, type SectionKey } from '@veggiedent/content-schema'
import { useAuth } from '../auth/auth-context'
import { sectionPath } from '../routing/paths'
import type { SectionSummary, SectionsGateway } from './sections-gateway'
import { formatUpdatedAt } from './updated-at'

/**
 * A lista das 10 seções (SDD § C-03).
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
      <h1 className="text-2xl font-semibold text-slate-900">Seções da página</h1>

      {loading.status === 'carregando' && (
        <p role="status" className="text-sm text-slate-500">
          Carregando as seções…
        </p>
      )}

      {loading.status === 'indisponivel' && (
        <p role="alert" className="text-sm text-red-600">
          {loading.message}
        </p>
      )}

      <ol className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
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
                  className="font-medium text-slate-900 underline"
                >
                  {`${position + 1}. ${schema.label}`}
                </Link>
                <p className="text-xs text-slate-500">
                  {`Última edição: ${
                    summary === undefined ? UNKNOWN_STATE : formatUpdatedAt(summary.updatedAt)
                  }`}
                </p>
              </div>
              <span className="text-xs text-slate-600">{publicationLabel(summary)}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
