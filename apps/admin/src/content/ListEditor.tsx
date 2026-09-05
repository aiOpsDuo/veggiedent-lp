import type { ListSpec } from '@veggiedent/content-schema'
import { FieldControl } from './fields/FieldControl'
import { listItemFieldPath, listPath } from './field-errors'
import {
  moveItem,
  newListItem,
  replaceItem,
  withItemField,
  type DraftListItem,
} from './section-draft'

/**
 * A lista de itens de uma seção: adicionar, remover, reordenar e ligar ou
 * desligar cada item (SDD § C-05 e § C-08).
 *
 * A ordem é a ordem do array — não há campo de posição para o operador digitar.
 * `ordem` só volta a existir na hora de gravar, calculada a partir da posição,
 * o que torna impossível salvar duas posições iguais ou um buraco na sequência.
 */

interface ListEditorProps {
  readonly list: ListSpec
  readonly items: readonly DraftListItem[]
  readonly errors: Readonly<Record<string, string>>
  readonly onChange: (items: readonly DraftListItem[]) => void
}

function itemName(list: ListSpec, position: number): string {
  return `item ${position + 1} de ${list.label}`
}

const ITEM_BUTTON_CLASS =
  'rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'

export function ListEditor({ list, items, errors, onChange }: ListEditorProps): JSX.Element {
  const listError = errors[listPath(list.name)]

  const changeItem = (position: number, item: DraftListItem): void => {
    onChange(replaceItem(items, position, item))
  }

  return (
    <fieldset className="animate-fade-in-up space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {list.label}
      </legend>

      {listError !== undefined && (
        <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>
      )}

      {items.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum item nesta lista.</p>
      )}

      {items.map((item, position) => (
        <div
          key={item.id}
          className="space-y-3 rounded border border-slate-200 p-4 dark:border-slate-700"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{`Item ${position + 1}`}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  aria-label={`Exibir na página o ${itemName(list, position)}`}
                  checked={item.visivel}
                  onChange={(event) =>
                    changeItem(position, { ...item, visivel: event.target.checked })
                  }
                />
                Aparece na página
              </label>
              <button
                type="button"
                className={ITEM_BUTTON_CLASS}
                aria-label={`Mover para cima o ${itemName(list, position)}`}
                disabled={position === 0}
                onClick={() => onChange(moveItem(items, position, position - 1))}
              >
                Subir
              </button>
              <button
                type="button"
                className={ITEM_BUTTON_CLASS}
                aria-label={`Mover para baixo o ${itemName(list, position)}`}
                disabled={position === items.length - 1}
                onClick={() => onChange(moveItem(items, position, position + 1))}
              >
                Descer
              </button>
              <button
                type="button"
                className={ITEM_BUTTON_CLASS}
                aria-label={`Remover o ${itemName(list, position)}`}
                onClick={() =>
                  onChange(items.filter((_item, index) => index !== position))
                }
              >
                Remover
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {list.itemFields.map((spec) => (
              <FieldControl
                key={spec.name}
                spec={spec}
                value={item.fields[spec.name]}
                error={errors[listItemFieldPath(list.name, position, spec.name)]}
                onChange={(value) => changeItem(position, withItemField(item, spec.name, value))}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        onClick={() => onChange([...items, newListItem(list)])}
      >
        {`Adicionar item em ${list.label}`}
      </button>
    </fieldset>
  )
}
