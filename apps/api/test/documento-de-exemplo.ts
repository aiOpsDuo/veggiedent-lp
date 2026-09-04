import {
  getSectionSchema,
  type FieldSpec,
  type SectionKey,
  type SectionSchema,
} from '@veggiedent/content-schema'

/**
 * Documentos válidos gerados a partir do próprio esquema.
 *
 * Escrever exemplos à mão por seção envelheceria: um campo obrigatório novo no
 * esquema tornaria os exemplos inválidos e a suíte falharia por um motivo que
 * não é o do teste. Gerar do esquema mantém a suíte focada no comportamento da
 * API, e o texto carrega acentuação de propósito (SDD § C-04).
 */

const MEDIA_ID = '00000000-0000-4000-8000-000000000001'

function valueFor(field: FieldSpec, seed: string): unknown {
  switch (field.type) {
    case 'texto-curto':
    case 'texto-longo':
      return `Conteúdo de ${field.label} — ${seed}`
    case 'texto-rico':
      return `Conteúdo de ${field.label} <br><strong>em destaque</strong> — ${seed}`
    case 'lista-de-textos':
      return [`Primeiro item (${seed})`, 'Segundo item, com acentuação']
    case 'imagem':
    case 'video':
      return MEDIA_ID
    case 'link':
      return '#secao-de-destino'
    case 'booleano':
      return true
  }
}

function fillRequired(
  fields: readonly FieldSpec[],
  seed: string,
): Record<string, unknown> {
  const filled: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.required) {
      filled[field.name] = valueFor(field, seed)
    }
  }
  return filled
}

export interface ExampleOptions {
  /** Quantos itens gerar em cada lista. Nunca menos que o mínimo do esquema. */
  readonly itemsPerList?: number
}

export function exampleDocumentFor(
  schema: SectionSchema,
  options: ExampleOptions = {},
): Record<string, unknown> {
  const document = fillRequired(schema.fields, schema.key)

  for (const list of schema.lists) {
    const total = Math.max(options.itemsPerList ?? 2, list.minItems ?? 0)
    document[list.name] = Array.from({ length: total }, (_unused, index) => ({
      visivel: true,
      ordem: index,
      ...fillRequired(list.itemFields, `${list.name} ${index + 1}`),
    }))
  }

  return document
}

export function exampleDocument(
  key: SectionKey,
  options: ExampleOptions = {},
): Record<string, unknown> {
  return exampleDocumentFor(getSectionSchema(key), options)
}

/** Metadados válidos da página, no formato do esquema. */
export function exampleMetadata(): Record<string, unknown> {
  return {
    title: 'Veggiedent — saúde oral canina',
    description: 'Rotina de cuidado com o hálito e o tártaro do seu cachorro.',
    canonicalUrl: 'https://veggiedent.com.br/',
  }
}
