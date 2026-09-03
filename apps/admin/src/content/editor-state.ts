import type { SectionSchema } from '@veggiedent/content-schema'
import { NO_ERRORS, forSection, formPathsOf, type SectionFieldErrors } from './field-errors'
import {
  buildDraft,
  withFieldValue,
  withListItems,
  type DraftListItem,
  type SectionDraft,
} from './section-draft'
import type { FieldErrors, SectionDetail, SectionSummary } from './sections-gateway'

/**
 * O estado da tela de edição de uma seção, como transições puras.
 *
 * Fica fora do componente porque as regras que importam aqui não são de
 * desenho: o que acontece com a confirmação de sucesso quando o operador volta
 * a digitar, o que acontece com o erro de um campo quando esse campo muda, e o
 * que a recusa da API faz com o rascunho (nada — o rascunho é do operador, e
 * perdê-lo por causa de um `422` seria perder o trabalho dele).
 */

export type SaveState =
  | { readonly kind: 'ocioso' }
  | { readonly kind: 'salvando' }
  | { readonly kind: 'confirmado'; readonly message: string }
  | { readonly kind: 'falha'; readonly message: string }

export type EditorState =
  | { readonly status: 'carregando' }
  | { readonly status: 'indisponivel'; readonly message: string }
  | {
      readonly status: 'pronto'
      readonly section: SectionSummary
      readonly draft: SectionDraft
      readonly errors: SectionFieldErrors
      readonly save: SaveState
    }

export type EditorAction =
  | { readonly type: 'carregado'; readonly section: SectionDetail }
  | { readonly type: 'falhou-ao-carregar'; readonly message: string }
  | { readonly type: 'campo-alterado'; readonly name: string; readonly value: unknown }
  | {
      readonly type: 'lista-alterada'
      readonly listName: string
      readonly items: readonly DraftListItem[]
    }
  | { readonly type: 'gravando' }
  | { readonly type: 'gravado'; readonly section: SectionDetail }
  | { readonly type: 'recusado'; readonly fields: FieldErrors }
  | { readonly type: 'recusado-no-painel'; readonly fields: FieldErrors }
  | { readonly type: 'falhou-ao-gravar'; readonly message: string }
  | { readonly type: 'visibilidade-alterada'; readonly section: SectionSummary }

export const SAVED_MESSAGE = 'Seção salva e publicada na página.'
export const INVALID_MESSAGE = 'A seção não foi salva. Corrija os campos indicados.'
export const PUBLISHED_MESSAGE = 'Seção ligada: ela volta a aparecer na página.'
export const UNPUBLISHED_MESSAGE = 'Seção desligada: ela sai da página, sem perder o conteúdo.'

export const INITIAL_EDITOR_STATE: EditorState = { status: 'carregando' }

function summaryOf(section: SectionDetail | SectionSummary): SectionSummary {
  return {
    key: section.key,
    label: section.label,
    isPublished: section.isPublished,
    updatedAt: section.updatedAt,
  }
}

/**
 * Editar limpa a confirmação e a falha da gravação anterior: um "salvo com
 * sucesso" que sobrevive à edição seguinte estaria afirmando algo falso.
 *
 * Some junto o erro do que foi editado — e, quando o editado é uma lista, o de
 * todos os seus itens: os erros vêm endereçados por posição (`items.1.question`)
 * e mover um item faria a posição apontar para outro conteúdo. Errar de campo é
 * pior do que não mostrar; o erro volta na próxima tentativa de gravar.
 */
function editing(
  state: Extract<EditorState, { status: 'pronto' }>,
  draft: SectionDraft,
  editedPath: string,
): EditorState {
  const porCampo = Object.fromEntries(
    Object.entries(state.errors.porCampo).filter(
      ([path]) => path !== editedPath && !path.startsWith(`${editedPath}.`),
    ),
  )
  return {
    ...state,
    draft,
    errors: { porCampo, semCampo: state.errors.semCampo },
    save: { kind: 'ocioso' },
  }
}

export function createEditorReducer(
  schema: SectionSchema,
): (state: EditorState, action: EditorAction) => EditorState {
  return (state, action) => {
    if (action.type === 'carregado') {
      return {
        status: 'pronto',
        section: summaryOf(action.section),
        draft: buildDraft(schema, action.section.data),
        errors: NO_ERRORS,
        save: { kind: 'ocioso' },
      }
    }

    if (action.type === 'falhou-ao-carregar') {
      return { status: 'indisponivel', message: action.message }
    }

    if (state.status !== 'pronto') {
      return state
    }

    switch (action.type) {
      case 'campo-alterado':
        return editing(state, withFieldValue(state.draft, action.name, action.value), action.name)

      case 'lista-alterada':
        return editing(
          state,
          withListItems(state.draft, action.listName, action.items),
          action.listName,
        )

      case 'gravando':
        return { ...state, errors: NO_ERRORS, save: { kind: 'salvando' } }

      case 'gravado':
        return {
          ...state,
          section: summaryOf(action.section),
          draft: buildDraft(schema, action.section.data),
          errors: NO_ERRORS,
          save: { kind: 'confirmado', message: SAVED_MESSAGE },
        }

      case 'recusado':
        return {
          ...state,
          errors: forSection(schema.key, action.fields, formPathsOf(schema, state.draft)),
          save: { kind: 'falha', message: INVALID_MESSAGE },
        }

      /**
       * A recusa que o painel decidiu sozinho já vem endereçada aos caminhos do
       * formulário — ela nasceu do esquema e do rascunho, não da resposta da
       * API, e por isso não passa pela tradução de prefixo de seção.
       */
      case 'recusado-no-painel':
        return {
          ...state,
          errors: { porCampo: action.fields, semCampo: [] },
          save: { kind: 'falha', message: INVALID_MESSAGE },
        }

      case 'falhou-ao-gravar':
        return { ...state, save: { kind: 'falha', message: action.message } }

      case 'visibilidade-alterada':
        return {
          ...state,
          section: summaryOf(action.section),
          save: {
            kind: 'confirmado',
            message: action.section.isPublished ? PUBLISHED_MESSAGE : UNPUBLISHED_MESSAGE,
          },
        }

      default:
        return state
    }
  }
}
