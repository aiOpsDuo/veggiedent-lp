import type { FieldSpec, ListSpec } from '@veggiedent/content-schema'
import type { RichTextSanitizer } from './rich-text-sanitizer.port'

/**
 * Reduz todo campo `texto-rico` de um documento à política de texto rico,
 * **antes** de validar e gravar.
 *
 * A página pública sanitiza de novo ao renderizar, e é lá que está a garantia
 * de que nada executa no navegador do visitante. Isto aqui é a segunda
 * barreira, do lado da escrita, e ela paga por si em três coisas que a barreira
 * da leitura não dá: o banco nunca guarda uma carga de injeção (nem o
 * instantâneo versionado da LP, gerado a partir dele); um consumidor futuro que
 * esqueça de sanitizar não encontra nada perigoso guardado; e o painel recebe
 * de volta exatamente o HTML canônico que gravou.
 *
 * O esquema é quem diz **quais** campos são texto rico — daí a função receber o
 * esquema em vez de adivinhar por nome ou por conteúdo.
 */

const RICH_TEXT = 'texto-rico'

export interface SanitizableSchema {
  readonly fields: readonly FieldSpec[]
  readonly lists: readonly ListSpec[]
}

function isDocument(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}

/**
 * Devolve uma cópia dos campos com o texto rico sanitizado. Valor que não é
 * texto passa intacto: recusá-lo é papel da validação, que roda em seguida e
 * sabe dizer ao operador qual campo está errado.
 */
function sanitizeFields(
  document: Record<string, unknown>,
  fields: readonly FieldSpec[],
  sanitize: RichTextSanitizer,
): Record<string, unknown> {
  const sanitized = { ...document }

  for (const field of fields) {
    const value = sanitized[field.name]
    if (field.type === RICH_TEXT && typeof value === 'string') {
      sanitized[field.name] = sanitize(value)
    }
  }

  return sanitized
}

export function sanitizeRichTextFields(
  schema: SanitizableSchema,
  document: unknown,
  sanitize: RichTextSanitizer,
): unknown {
  if (!isDocument(document)) return document

  const sanitized = sanitizeFields(document, schema.fields, sanitize)

  for (const list of schema.lists) {
    const items = sanitized[list.name]
    if (!Array.isArray(items)) continue
    sanitized[list.name] = items.map((item) =>
      isDocument(item) ? sanitizeFields(item, list.itemFields, sanitize) : item,
    )
  }

  return sanitized
}
