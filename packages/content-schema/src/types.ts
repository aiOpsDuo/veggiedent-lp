/**
 * Tipos derivados dos esquemas declarativos.
 *
 * Nada aqui é escrito à mão por seção: o tipo de cada documento é calculado a
 * partir do mesmo array de campos que gera a validação e o formulário. Um campo
 * novo no esquema aparece no tipo sem nenhuma edição neste arquivo (SDD, D-02).
 */
import type { FieldSpec, ListItemBase, ListSpec, SectionKey, SectionSchema } from './contract'
import type { sectionSchemas } from './sections'
import type { siteMetadataSchema } from './site-metadata'

type Prettify<T> = { [K in keyof T]: T[K] } & {}

type FieldValue<F extends FieldSpec> = F['type'] extends 'booleano'
  ? boolean
  : F['type'] extends 'lista-de-textos'
    ? string[]
    : string

type RequiredFields<Fs extends readonly FieldSpec[]> = {
  [F in Fs[number] as F['required'] extends true ? F['name'] : never]: FieldValue<F>
}

type OptionalFields<Fs extends readonly FieldSpec[]> = {
  [F in Fs[number] as F['required'] extends true ? never : F['name']]?: FieldValue<F>
}

export type FieldsShape<Fs extends readonly FieldSpec[]> = Prettify<RequiredFields<Fs> & OptionalFields<Fs>>

export type ListItem<L extends ListSpec> = Prettify<ListItemBase & FieldsShape<L['itemFields']>>

type ListsShape<Ls extends readonly ListSpec[]> = {
  [L in Ls[number] as L['name']]: ListItem<L>[]
}

/** Documento completo de uma seção: seus campos simples mais suas listas. */
export type SectionDocument<S extends SectionSchema> = Prettify<FieldsShape<S['fields']> & ListsShape<S['lists']>>

export type SectionDocumentOf<K extends SectionKey> = SectionDocument<(typeof sectionSchemas)[K]>

export type HeaderDocument = SectionDocumentOf<'header'>
export type HeroDocument = SectionDocumentOf<'hero'>
export type EducacaoDocument = SectionDocumentOf<'educacao'>
export type RotinaDocument = SectionDocumentOf<'rotina'>
export type ProdutoDocument = SectionDocumentOf<'produto'>
export type DemonstracaoDocument = SectionDocumentOf<'demonstracao'>
export type IngredientesDocument = SectionDocumentOf<'ingredientes'>
export type ProvaAutoridadeDocument = SectionDocumentOf<'prova_autoridade'>
export type CapturaLeadDocument = SectionDocumentOf<'captura_lead'>
export type OndeComprarDocument = SectionDocumentOf<'onde_comprar'>
export type FaqDocument = SectionDocumentOf<'faq'>
export type FooterDocument = SectionDocumentOf<'footer'>

/** Todo o conteúdo publicado, como servido por `GET /api/content`. */
export type SectionDocuments = { [K in SectionKey]: SectionDocumentOf<K> }

export type SiteMetadata = FieldsShape<(typeof siteMetadataSchema)['fields']>
