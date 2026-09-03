import { useId, type ReactNode } from 'react'
import type { FieldSpec, FieldType } from '@veggiedent/content-schema'

/**
 * O controle de um campo, escolhido pelo **tipo declarado no esquema**.
 *
 * Nenhuma seção aparece neste arquivo, e nenhum nome de campo tampouco: o
 * painel não sabe que existe "título principal" nem "pergunta do FAQ", só sabe
 * desenhar cada tipo de campo (SDD § D-02). Um campo novo no esquema aparece
 * aqui sem nenhuma edição; um **tipo** novo de campo é uma entrada a mais em
 * `CONTROLS_BY_FIELD_TYPE`, sem tocar no que já existe.
 */

interface InputProps {
  readonly id: string
  readonly describedBy: string | undefined
  readonly invalid: boolean
  readonly spec: FieldSpec
  readonly value: unknown
  readonly onChange: (value: unknown) => void
}

/** Como o rótulo se liga ao controle: um `label` só serve a um controle só. */
type Wrapper = 'rotulo' | 'grupo'

interface FieldControlSpec {
  readonly Input: (props: InputProps) => JSX.Element
  readonly wrapper: Wrapper
}

const TEXT_INPUT_CLASS =
  'w-full rounded border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500'

const INVALID_INPUT_CLASS = 'border-red-500 focus:border-red-500 focus:ring-red-500'

const LONG_TEXT_ROWS = 4

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asTextList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.map(asText) : []
}

function inputClass(invalid: boolean): string {
  return invalid ? `${TEXT_INPUT_CLASS} ${INVALID_INPUT_CLASS}` : TEXT_INPUT_CLASS
}

function ShortTextInput({ id, describedBy, invalid, spec, value, onChange }: InputProps): JSX.Element {
  return (
    <input
      id={id}
      type="text"
      className={inputClass(invalid)}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-required={spec.required || undefined}
      value={asText(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function LongTextInput({ id, describedBy, invalid, spec, value, onChange }: InputProps): JSX.Element {
  return (
    <textarea
      id={id}
      rows={LONG_TEXT_ROWS}
      className={inputClass(invalid)}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-required={spec.required || undefined}
      value={asText(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function BooleanInput({ id, describedBy, invalid, spec, value, onChange }: InputProps): JSX.Element {
  return (
    <input
      id={id}
      type="checkbox"
      className="h-4 w-4 rounded border-slate-300"
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-required={spec.required || undefined}
      checked={value === true}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

/**
 * Lista de textos soltos — cada linha é um valor, sem visibilidade nem ordem
 * próprias. É diferente da lista de itens do esquema, que tem os dois.
 */
function TextListInput({ describedBy, invalid, spec, value, onChange }: InputProps): JSX.Element {
  const lines = asTextList(value)
  const replaceLine = (position: number, line: string): void => {
    onChange(lines.map((current, index) => (index === position ? line : current)))
  }

  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            className={inputClass(invalid)}
            aria-label={`${spec.label} — linha ${index + 1}`}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={line}
            onChange={(event) => replaceLine(index, event.target.value)}
          />
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => onChange(lines.filter((_line, position) => position !== index))}
          >
            {`Remover a linha ${index + 1} de ${spec.label}`}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
        onClick={() => onChange([...lines, ''])}
      >
        {`Adicionar linha em ${spec.label}`}
      </button>
    </div>
  )
}

const MEDIA_NOUN: Partial<Record<FieldType, string>> = {
  imagem: 'imagem',
  video: 'vídeo',
  legenda: 'legenda',
}

/**
 * Campo de mídia: espaço reservado até a tarefa de envio de arquivos existir.
 *
 * Mostra o que já está guardado e não deixa editar — digitar um identificador à
 * mão é exatamente o que o SDD proíbe ("referências de mídia guardam o
 * identificador da mídia, nunca uma URL digitada"). O valor atual continua no
 * rascunho e volta intacto na gravação, então salvar texto de uma seção não
 * apaga a imagem dela.
 */
function MediaPlaceholderInput({
  id,
  describedBy,
  invalid,
  spec,
  value,
}: InputProps): JSX.Element {
  const stored = asText(value)
  return (
    <div className="space-y-1">
      <input
        id={id}
        type="text"
        readOnly
        className={`${inputClass(invalid)} bg-slate-100 text-slate-600`}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-required={spec.required || undefined}
        value={stored === '' ? 'Nenhum arquivo enviado.' : stored}
      />
      <p className="text-xs text-slate-500">
        {`Envio e troca de ${MEDIA_NOUN[spec.type] ?? 'arquivo'} ainda não estão disponíveis nesta tela.`}
      </p>
    </div>
  )
}

const MEDIA_CONTROL: FieldControlSpec = { Input: MediaPlaceholderInput, wrapper: 'rotulo' }

const CONTROLS_BY_FIELD_TYPE: Readonly<Record<FieldType, FieldControlSpec>> = {
  'texto-curto': { Input: ShortTextInput, wrapper: 'rotulo' },
  'texto-longo': { Input: LongTextInput, wrapper: 'rotulo' },
  'lista-de-textos': { Input: TextListInput, wrapper: 'grupo' },
  link: { Input: ShortTextInput, wrapper: 'rotulo' },
  booleano: { Input: BooleanInput, wrapper: 'rotulo' },
  imagem: MEDIA_CONTROL,
  video: MEDIA_CONTROL,
  legenda: MEDIA_CONTROL,
}

interface FieldMetaProps {
  readonly helpId: string
  readonly help: string | undefined
  readonly errorId: string
  readonly error: string | undefined
}

/** Ajuda e erro do campo, os dois ligados ao controle por `aria-describedby`. */
function FieldMeta({ helpId, help, errorId, error }: FieldMetaProps): JSX.Element {
  return (
    <>
      {help !== undefined && (
        <p id={helpId} className="text-xs text-slate-500">
          {help}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  )
}

export interface FieldControlProps {
  readonly spec: FieldSpec
  readonly value: unknown
  readonly error?: string
  readonly onChange: (value: unknown) => void
}

/**
 * O asterisco é sinal visual e nada mais, e por isso mora **fora** do `label`:
 * dentro dele viraria parte do nome do campo, e o leitor de tela anunciaria
 * "Título principal asterisco". Quem carrega a obrigatoriedade para a
 * tecnologia assistiva é `aria-required`, no próprio controle.
 */
function RequiredMark({ required }: { readonly required: boolean }): JSX.Element | null {
  return required ? (
    <span aria-hidden="true" className="text-red-600">
      *
    </span>
  ) : null
}

export function FieldControl({ spec, value, error, onChange }: FieldControlProps): JSX.Element {
  const controlId = useId()
  const helpId = `${controlId}-ajuda`
  const errorId = `${controlId}-erro`
  const { Input, wrapper } = CONTROLS_BY_FIELD_TYPE[spec.type]

  const describedBy =
    [spec.help === undefined ? null : helpId, error === undefined ? null : errorId]
      .filter((each): each is string => each !== null)
      .join(' ') || undefined

  const input = (
    <Input
      id={controlId}
      describedBy={describedBy}
      invalid={error !== undefined}
      spec={spec}
      value={value}
      onChange={onChange}
    />
  )
  const meta = (
    <FieldMeta helpId={helpId} help={spec.help} errorId={errorId} error={error} />
  )

  return wrapper === 'grupo' ? (
    <FieldGroup label={spec.label} required={spec.required}>
      {meta}
      {input}
    </FieldGroup>
  ) : (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-sm font-medium text-slate-800">
        <label htmlFor={controlId}>{spec.label}</label>
        <RequiredMark required={spec.required} />
      </div>
      {meta}
      {input}
    </div>
  )
}

interface FieldGroupProps {
  readonly label: string
  readonly required: boolean
  readonly children: ReactNode
}

/** Um rótulo para vários controles é `legend`, não `label` (um `label` serve a um). */
function FieldGroup({ label, required, children }: FieldGroupProps): JSX.Element {
  return (
    <fieldset className="space-y-1">
      <legend className="flex items-center gap-1 text-sm font-medium text-slate-800">
        <span>{label}</span>
        <RequiredMark required={required} />
      </legend>
      {children}
    </fieldset>
  )
}
