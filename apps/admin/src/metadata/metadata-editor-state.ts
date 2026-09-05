import { SITE_METADATA_ERROR_PREFIX, siteMetadataSchema } from '@veggiedent/content-schema'
import { NO_ERRORS, forSection, formPathsOf, type SectionFieldErrors } from '../content/field-errors'
import { buildDraft, withFieldValue, type SectionDraft } from '../content/section-draft'
import type { FieldErrors } from '../content/sections-gateway'
import type { SiteMetadataDetail } from './metadata-gateway'

/**
 * O estado da tela de metadados, como transições puras.
 *
 * É irmão de `content/editor-state.ts`, não uma cópia dele: os metadados não
 * têm listas nem visibilidade, e o que se promete ao operador ao salvar é
 * outra coisa — uma seção "sai na página", os metadados "passam a valer na
 * busca e no compartilhamento". Espremer os dois num reducer só exigiria
 * mensagens e um resumo de seção opcionais, e a tela de seção pagaria por um
 * caso que não é dela.
 *
 * O que é genuinamente comum — montar o rascunho, traduzir os caminhos de erro
 * da API e apagar o erro do campo que acabou de ser editado — vem de
 * `content/`, sem duplicação.
 */

export type MetadataSaveState =
  | { readonly kind: 'ocioso' }
  | { readonly kind: 'salvando' }
  | { readonly kind: 'confirmado'; readonly message: string }
  | { readonly kind: 'falha'; readonly message: string }

export type MetadataEditorState =
  | { readonly status: 'carregando' }
  | { readonly status: 'indisponivel'; readonly message: string }
  | {
      readonly status: 'pronto'
      readonly updatedAt: string | null
      readonly draft: SectionDraft
      /** O rascunho como veio do servidor, para saber se há edição não salva (T30-d). */
      readonly savedDraft: SectionDraft
      readonly errors: SectionFieldErrors
      readonly save: MetadataSaveState
    }

export type MetadataEditorAction =
  | { readonly type: 'carregado'; readonly metadata: SiteMetadataDetail }
  | { readonly type: 'falhou-ao-carregar'; readonly message: string }
  | { readonly type: 'campo-alterado'; readonly name: string; readonly value: unknown }
  | { readonly type: 'gravando' }
  | { readonly type: 'gravado'; readonly metadata: SiteMetadataDetail }
  | { readonly type: 'recusado'; readonly fields: FieldErrors }
  | { readonly type: 'recusado-no-painel'; readonly fields: FieldErrors }
  | { readonly type: 'falhou-ao-gravar'; readonly message: string }

export const SAVED_MESSAGE =
  'Metadados salvos. Eles passam a valer na busca e no compartilhamento do link.'
export const INVALID_MESSAGE = 'Os metadados não foram salvos. Corrija os campos indicados.'

export const INITIAL_METADATA_STATE: MetadataEditorState = { status: 'carregando' }

function loaded(metadata: SiteMetadataDetail, save: MetadataSaveState): MetadataEditorState {
  const draft = buildDraft(siteMetadataSchema, metadata.metadata)
  return {
    status: 'pronto',
    updatedAt: metadata.updatedAt,
    draft,
    savedDraft: draft,
    errors: NO_ERRORS,
    save,
  }
}

export function metadataEditorReducer(
  state: MetadataEditorState,
  action: MetadataEditorAction,
): MetadataEditorState {
  if (action.type === 'carregado') {
    return loaded(action.metadata, { kind: 'ocioso' })
  }

  if (action.type === 'falhou-ao-carregar') {
    return { status: 'indisponivel', message: action.message }
  }

  if (state.status !== 'pronto') {
    return state
  }

  switch (action.type) {
    /**
     * Editar limpa a confirmação anterior — um "salvo com sucesso" que
     * sobrevive à edição seguinte estaria afirmando algo falso — e apaga o erro
     * do campo editado, que é justamente o que o operador acabou de responder.
     */
    case 'campo-alterado': {
      const porCampo = Object.fromEntries(
        Object.entries(state.errors.porCampo).filter(([path]) => path !== action.name),
      )
      return {
        ...state,
        draft: withFieldValue(state.draft, action.name, action.value),
        errors: { porCampo, semCampo: state.errors.semCampo },
        save: { kind: 'ocioso' },
      }
    }

    case 'gravando':
      return { ...state, errors: NO_ERRORS, save: { kind: 'salvando' } }

    case 'gravado':
      return loaded(action.metadata, { kind: 'confirmado', message: SAVED_MESSAGE })

    case 'recusado':
      return {
        ...state,
        errors: forSection(
          SITE_METADATA_ERROR_PREFIX,
          action.fields,
          formPathsOf(siteMetadataSchema, state.draft),
        ),
        save: { kind: 'falha', message: INVALID_MESSAGE },
      }

    /** A recusa decidida pelo próprio painel já nasce nos caminhos do formulário. */
    case 'recusado-no-painel':
      return {
        ...state,
        errors: { porCampo: action.fields, semCampo: [] },
        save: { kind: 'falha', message: INVALID_MESSAGE },
      }

    case 'falhou-ao-gravar':
      return { ...state, save: { kind: 'falha', message: action.message } }

    default:
      return state
  }
}
