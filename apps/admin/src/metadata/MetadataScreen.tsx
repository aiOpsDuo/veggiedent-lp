import { useCallback, useEffect, useReducer } from 'react'
import { siteMetadataSchema } from '@veggiedent/content-schema'
import { useAuth } from '../auth/auth-context'
import { altTextErrors } from '../content/alt-text-rule'
import { fieldPath } from '../content/field-errors'
import { FieldControl } from '../content/fields/FieldControl'
import { isDraftDirty, toDocument } from '../content/section-draft'
import { UnsavedChangesGuard } from '../content/UnsavedChangesGuard'
import { formatUpdatedAt } from '../content/updated-at'
import type { MetadataGateway } from './metadata-gateway'
import {
  INITIAL_METADATA_STATE,
  metadataEditorReducer,
  type MetadataSaveState,
} from './metadata-editor-state'

/**
 * A tela de metadados da página: título, descrição, endereço oficial e a imagem
 * de compartilhamento com seu texto alternativo (SDD § C-09).
 *
 * Nenhum desses nomes aparece aqui. O formulário é um percurso pelos campos que
 * `siteMetadataSchema` declara, exatamente como a tela de seção percorre os
 * campos da seção (SDD § D-02): um campo novo nos metadados aparece nesta tela
 * sem que uma linha daqui mude. A imagem usa o mesmo campo de mídia das seções,
 * com envio direto ao armazenamento — o operador não digita identificador.
 *
 * Não há visibilidade: os metadados sempre valem. Salvar publica.
 */

interface MetadataScreenProps {
  readonly gateway: MetadataGateway
}

export function MetadataScreen({ gateway }: MetadataScreenProps): JSX.Element {
  const { state: authState } = useAuth()
  const accessToken = authState.status === 'ativa' ? authState.session.accessToken : null
  const [state, dispatch] = useReducer(metadataEditorReducer, INITIAL_METADATA_STATE)

  useEffect(() => {
    if (accessToken === null) {
      return
    }
    let current = true
    void gateway.getMetadata(accessToken).then((result) => {
      if (!current) {
        return
      }
      dispatch(
        result.status === 'ok'
          ? { type: 'carregado', metadata: result.value }
          : { type: 'falhou-ao-carregar', message: result.message },
      )
    })
    return () => {
      current = false
    }
  }, [gateway, accessToken])

  const onFieldChange = useCallback(
    (name: string, value: unknown) => dispatch({ type: 'campo-alterado', name, value }),
    [],
  )

  if (state.status === 'carregando') {
    return (
      <p role="status" className="text-sm text-slate-500">
        Carregando os metadados…
      </p>
    )
  }

  if (state.status === 'indisponivel') {
    return (
      <p role="alert" className="text-sm text-red-600">
        {state.message}
      </p>
    )
  }

  const save = async (): Promise<void> => {
    if (accessToken === null) {
      return
    }
    const missingAltText = altTextErrors(siteMetadataSchema, state.draft)
    if (Object.keys(missingAltText).length > 0) {
      dispatch({ type: 'recusado-no-painel', fields: missingAltText })
      return
    }

    dispatch({ type: 'gravando' })
    const result = await gateway.saveMetadata(
      accessToken,
      toDocument(siteMetadataSchema, state.draft),
    )
    if (result.status === 'salvo') {
      dispatch({ type: 'gravado', metadata: result.value })
      return
    }
    dispatch(
      result.status === 'invalido'
        ? { type: 'recusado', fields: result.fields }
        : { type: 'falhou-ao-gravar', message: result.message },
    )
  }

  const saving = state.save.kind === 'salvando'
  const dirty = isDraftDirty(state.draft, state.savedDraft)

  return (
    <section className="space-y-6">
      <UnsavedChangesGuard when={dirty} />
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{siteMetadataSchema.label}</h1>
        <p className="text-sm text-slate-600">
          O que buscadores e redes sociais mostram sobre a página.
        </p>
        <p className="text-sm text-slate-500">
          {`Última edição: ${formatUpdatedAt(state.updatedAt)}`}
        </p>
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
        <div className="space-y-4 rounded border border-slate-200 bg-white p-4">
          {siteMetadataSchema.fields.map((spec) => (
            <FieldControl
              key={spec.name}
              spec={spec}
              value={state.draft.fields[spec.name]}
              error={state.errors.porCampo[fieldPath(spec.name)]}
              onChange={(value) => onFieldChange(spec.name, value)}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar metadados'}
        </button>
      </form>
    </section>
  )
}

/** Confirmação em `status`, recusa em `alert` — a mesma divisão da tela de seção. */
function SaveFeedback({ save }: { readonly save: MetadataSaveState }): JSX.Element | null {
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
