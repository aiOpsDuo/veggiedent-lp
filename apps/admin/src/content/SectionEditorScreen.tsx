import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSectionSchema, isSectionKey, type SectionKey } from '@veggiedent/content-schema'
import { useAuth } from '../auth/auth-context'
import { SECTIONS_PATH } from '../routing/paths'
import { altTextErrors } from './alt-text-rule'
import {
  INITIAL_EDITOR_STATE,
  createEditorReducer,
  type SaveState,
} from './editor-state'
import { SectionForm } from './SectionForm'
import { toDocument, type DraftListItem } from './section-draft'
import type { SectionsGateway } from './sections-gateway'
import { formatUpdatedAt } from './updated-at'

/**
 * A tela de edição de uma seção.
 *
 * Ela não conhece nenhuma seção em particular: recebe a chave pela rota, pede o
 * esquema ao pacote e entrega tudo ao formulário. Salvar publica — não há
 * rascunho (SDD § "Linguagem ubíqua"), e é por isso que a confirmação de
 * sucesso diz que a seção foi publicada, não que foi guardada.
 */

interface SectionEditorScreenProps {
  readonly gateway: SectionsGateway
}

export function SectionEditorScreen({ gateway }: SectionEditorScreenProps): JSX.Element {
  const { key } = useParams()

  if (!isSectionKey(key)) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Seção desconhecida</h1>
        <p className="text-slate-700">
          Este endereço não corresponde a nenhuma das seções da página.
        </p>
        <Link to={SECTIONS_PATH} className="text-sm text-slate-700 underline">
          Voltar para a lista de seções
        </Link>
      </section>
    )
  }

  return <SectionEditor gateway={gateway} sectionKey={key} />
}

interface SectionEditorProps {
  readonly gateway: SectionsGateway
  readonly sectionKey: SectionKey
}

function SectionEditor({ gateway, sectionKey }: SectionEditorProps): JSX.Element {
  const { state: authState } = useAuth()
  const accessToken = authState.status === 'ativa' ? authState.session.accessToken : null
  const schema = useMemo(() => getSectionSchema(sectionKey), [sectionKey])
  const reducer = useMemo(() => createEditorReducer(schema), [schema])
  const [state, dispatch] = useReducer(reducer, INITIAL_EDITOR_STATE)

  useEffect(() => {
    if (accessToken === null) {
      return
    }
    let current = true
    void gateway.getSection(accessToken, sectionKey).then((result) => {
      if (!current) {
        return
      }
      dispatch(
        result.status === 'ok'
          ? { type: 'carregado', section: result.value }
          : { type: 'falhou-ao-carregar', message: result.message },
      )
    })
    return () => {
      current = false
    }
  }, [gateway, accessToken, sectionKey])

  const onFieldChange = useCallback(
    (name: string, value: unknown) => dispatch({ type: 'campo-alterado', name, value }),
    [],
  )
  const onListChange = useCallback(
    (listName: string, items: readonly DraftListItem[]) =>
      dispatch({ type: 'lista-alterada', listName, items }),
    [],
  )

  if (state.status === 'carregando') {
    return (
      <p role="status" className="text-sm text-slate-500">
        Carregando a seção…
      </p>
    )
  }

  if (state.status === 'indisponivel') {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
        <Link to={SECTIONS_PATH} className="text-sm text-slate-700 underline">
          Voltar para a lista de seções
        </Link>
      </div>
    )
  }

  const save = async (): Promise<void> => {
    if (accessToken === null) {
      return
    }
    const missingAltText = altTextErrors(schema, state.draft)
    if (Object.keys(missingAltText).length > 0) {
      dispatch({ type: 'recusado-no-painel', fields: missingAltText })
      return
    }

    dispatch({ type: 'gravando' })
    const result = await gateway.saveSection(
      accessToken,
      sectionKey,
      toDocument(schema, state.draft),
    )
    if (result.status === 'salvo') {
      dispatch({ type: 'gravado', section: result.section })
      return
    }
    dispatch(
      result.status === 'invalido'
        ? { type: 'recusado', fields: result.fields }
        : { type: 'falhou-ao-gravar', message: result.message },
    )
  }

  const changeVisibility = async (isPublished: boolean): Promise<void> => {
    if (accessToken === null) {
      return
    }
    const result = await gateway.setSectionVisibility(accessToken, sectionKey, isPublished)
    dispatch(
      result.status === 'alterada'
        ? { type: 'visibilidade-alterada', section: result.section }
        : { type: 'falhou-ao-gravar', message: result.message },
    )
  }

  const saving = state.save.kind === 'salvando'

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link to={SECTIONS_PATH} className="text-sm text-slate-600 underline">
          Voltar para a lista de seções
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{schema.label}</h1>
        <p className="text-sm text-slate-500">
          {`Última edição: ${formatUpdatedAt(state.section.updatedAt)}`}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={state.section.isPublished}
            onChange={(event) => void changeVisibility(event.target.checked)}
          />
          Seção aparece na página
        </label>
      </header>

      <SaveFeedback save={state.save} />

      {state.errors.semCampo.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-red-600">
          {state.errors.semCampo.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        className="space-y-6"
      >
        <SectionForm
          schema={schema}
          draft={state.draft}
          errors={state.errors}
          onFieldChange={onFieldChange}
          onListChange={onListChange}
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar e publicar'}
        </button>
      </form>
    </section>
  )
}

/**
 * A confirmação e a recusa moram em papéis diferentes de propósito: `status`
 * para o que deu certo, `alert` para o que exige atenção imediata.
 */
function SaveFeedback({ save }: { readonly save: SaveState }): JSX.Element | null {
  if (save.kind === 'confirmado') {
    return (
      <p role="status" className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
        {save.message}
      </p>
    )
  }
  if (save.kind === 'falha') {
    return (
      <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
        {save.message}
      </p>
    )
  }
  return null
}
