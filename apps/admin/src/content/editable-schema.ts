import type { FieldSpec, ListSpec } from '@veggiedent/content-schema'

/**
 * Um documento que o painel sabe desenhar a partir do esquema: campos, listas e
 * um rótulo.
 *
 * As 10 seções são o caso principal, mas não o único — os metadados da página
 * são declarados com o mesmo contrato de campos, de propósito
 * (`packages/content-schema/src/site-metadata.ts`), e por isso o rascunho, a
 * tradução para documento e a regra de texto alternativo trabalham sobre esta
 * forma, e não sobre `SectionSchema`. `SectionSchema` a satisfaz; nada aqui
 * precisa saber que existem exatamente 10 chaves de seção.
 */
export interface EditableSchema {
  readonly key: string
  readonly label: string
  readonly fields: readonly FieldSpec[]
  readonly lists: readonly ListSpec[]
}
