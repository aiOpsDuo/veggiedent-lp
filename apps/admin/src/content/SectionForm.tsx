import type { SectionSchema } from '@veggiedent/content-schema'
import { FieldControl } from './fields/FieldControl'
import { fieldPath, type SectionFieldErrors } from './field-errors'
import { ListEditor } from './ListEditor'
import type { DraftListItem, SectionDraft } from './section-draft'
import { Card } from '../shared/Card'

/**
 * O formulário de uma seção, gerado do esquema (SDD § D-02).
 *
 * O arquivo inteiro é um percurso por `schema.fields` e `schema.lists` — não
 * existe aqui nenhum nome de campo, nenhuma chave de seção e nenhuma exceção
 * por seção. É por isso que acrescentar um campo ao esquema o faz aparecer
 * nesta tela sem que uma linha daqui mude.
 *
 * Os campos simples e cada lista viram cartões separados (T35, item 7) — o
 * agrupamento visual que faltava quando tudo dividia um único bloco corrido.
 */

interface SectionFormProps {
  readonly schema: SectionSchema
  readonly draft: SectionDraft
  readonly errors: SectionFieldErrors
  readonly onFieldChange: (name: string, value: unknown) => void
  readonly onListChange: (listName: string, items: readonly DraftListItem[]) => void
}

export function SectionForm({
  schema,
  draft,
  errors,
  onFieldChange,
  onListChange,
}: SectionFormProps): JSX.Element {
  return (
    <div className="space-y-6">
      {schema.fields.length > 0 && (
        <Card className="space-y-4">
          {schema.fields.map((spec) => (
            <FieldControl
              key={spec.name}
              spec={spec}
              value={draft.fields[spec.name]}
              error={errors.porCampo[fieldPath(spec.name)]}
              onChange={(value) => onFieldChange(spec.name, value)}
            />
          ))}
        </Card>
      )}

      {schema.lists.map((list) => (
        <ListEditor
          key={list.name}
          list={list}
          items={draft.lists[list.name] ?? []}
          errors={errors.porCampo}
          onChange={(items) => onListChange(list.name, items)}
        />
      ))}
    </div>
  )
}
