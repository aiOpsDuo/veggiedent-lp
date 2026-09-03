import {
  MESSAGES,
  altTextFieldName,
  isDecorativeImage,
  type FieldSpec,
  type SectionSchema,
} from '@veggiedent/content-schema'
import { fieldPath, listItemFieldPath } from './field-errors'
import type { SectionDraft } from './section-draft'

/**
 * A única regra que o painel aplica antes de chamar a API: imagem
 * **informativa** preenchida exige o texto alternativo ao lado dela
 * (SDD § "Contrato do esquema de seção", § C-06).
 *
 * Todo o resto da validação continua sendo da API — é ela quem decide o que é
 * um documento válido, e é da recusa dela que vêm as mensagens por campo. Esta
 * é a exceção declarada, por dois motivos: é a invariante de acessibilidade do
 * produto, e ela precisa alcançar o operador **no momento em que ele acabou de
 * escolher a imagem**, não depois de uma ida à rede.
 *
 * Imagem **decorativa** não entra aqui, e não por esquecimento: ela não tem
 * campo de descrição no esquema, porque descrever uma imagem que não carrega
 * informação injeta ruído no leitor de tela. Não há o que exigir.
 */

function isFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** As imagens que carregam informação — as únicas que pedem descrição. */
function informativeImages(specs: readonly FieldSpec[]): readonly FieldSpec[] {
  return specs.filter((spec) => spec.type === 'imagem' && !isDecorativeImage(spec))
}

function missingAltIn(
  specs: readonly FieldSpec[],
  values: Readonly<Record<string, unknown>>,
  pathOf: (name: string) => string,
): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const spec of informativeImages(specs)) {
    const altName = altTextFieldName(spec.name)
    if (isFilled(values[spec.name]) && !isFilled(values[altName])) {
      errors[pathOf(altName)] = MESSAGES.altRequiredWithImage
    }
  }

  return errors
}

/**
 * Os textos alternativos que faltam na seção inteira, endereçados pelos mesmos
 * caminhos que o formulário usa para exibir erro — inclusive dentro das listas,
 * onde o caminho carrega a posição do item.
 */
export function altTextErrors(
  schema: SectionSchema,
  draft: SectionDraft,
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {
    ...missingAltIn(schema.fields, draft.fields, fieldPath),
  }

  for (const list of schema.lists) {
    const items = draft.lists[list.name] ?? []
    items.forEach((item, position) => {
      Object.assign(
        errors,
        missingAltIn(list.itemFields, item.fields, (name) =>
          listItemFieldPath(list.name, position, name),
        ),
      )
    })
  }

  return errors
}
