import { useEffect, useState, type ChangeEvent } from 'react'
import type { MediaFieldType } from '@veggiedent/content-schema'
import { useMediaService } from './media-context'
import type { RegisteredMedia } from './media-gateway'
import { acceptAttributeOf, limitHint, policyOf } from './upload-policy'

/**
 * O campo de mídia do formulário: escolher o arquivo, ver o envio acontecer e
 * ver o que está guardado (SDD § C-06, C-07).
 *
 * O operador nunca digita identificador de mídia — o campo não tem onde
 * digitar. O valor do campo é o identificador que a API devolveu ao confirmar o
 * envio, e ele só muda por um envio concluído ou por uma remoção explícita
 * (SDD § "Contrato do esquema de seção").
 *
 * O texto alternativo **não** está aqui: quando a imagem é informativa, o
 * esquema declara um campo de texto ao lado dela, e é ele que o formulário
 * desenha. Quando ela é decorativa, esse campo não existe no esquema, e por
 * isso não existe na tela — que é o tratamento correto, não uma falta.
 */

interface MediaFieldProps {
  readonly id: string
  readonly describedBy: string | undefined
  readonly invalid: boolean
  readonly required: boolean
  readonly fieldType: MediaFieldType
  readonly label: string
  readonly value: string
  readonly onChange: (mediaId: string) => void
}

type SendState =
  | { readonly kind: 'ocioso' }
  | { readonly kind: 'enviando'; readonly percent: number }
  | { readonly kind: 'recusado'; readonly message: string }

/**
 * O que o campo sabe sobre a mídia já guardada. `ausente` é diferente de
 * `buscando`: uma mídia apagada por fora precisa ser dita ao operador, não
 * escondida atrás de um "carregando" que nunca termina.
 */
type StoredState =
  | { readonly kind: 'vazio' }
  | { readonly kind: 'buscando' }
  | { readonly kind: 'encontrada'; readonly media: RegisteredMedia }
  | { readonly kind: 'ausente' }

const PERCENT = 100

const PREVIEWS: Readonly<Record<MediaFieldType, (media: RegisteredMedia) => JSX.Element>> = {
  imagem: (media) => (
    <img
      src={media.publicUrl}
      alt={`Prévia de ${media.originalFilename}`}
      className="max-h-40 rounded border border-slate-200 bg-slate-50"
    />
  ),
  video: (media) => (
    <video
      src={media.publicUrl}
      controls
      preload="metadata"
      aria-label={`Prévia de ${media.originalFilename}`}
      className="max-h-40 rounded border border-slate-200 bg-slate-900"
    />
  ),
  legenda: (media) => (
    <a
      href={media.publicUrl}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-slate-700 underline"
    >
      {`Abrir ${media.originalFilename}`}
    </a>
  ),
}

const SELECT_CLASS =
  'block w-full text-sm text-slate-700 file:mr-3 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-100'

export function MediaField({
  id,
  describedBy,
  invalid,
  required,
  fieldType,
  label,
  value,
  onChange,
}: MediaFieldProps): JSX.Element {
  const service = useMediaService()
  const [stored, setStored] = useState<StoredState>({ kind: 'vazio' })
  const [send, setSend] = useState<SendState>({ kind: 'ocioso' })

  /**
   * A prévia sempre vem de uma leitura da API, mesmo logo depois de um envio
   * concluído: é ela que confirma que o registro existe de verdade. O envio já
   * deixou a mídia na tela, então a releitura não a apaga — a troca por
   * "buscando" só acontece quando o que está exibido é outra mídia.
   */
  useEffect(() => {
    if (value === '' || service === null) {
      setStored({ kind: 'vazio' })
      return
    }
    setStored((atual) =>
      atual.kind === 'encontrada' && atual.media.id === value ? atual : { kind: 'buscando' },
    )
    let current = true
    void service.describe(value).then((media) => {
      if (current) {
        setStored(media === null ? { kind: 'ausente' } : { kind: 'encontrada', media })
      }
    })
    return () => {
      current = false
    }
  }, [service, value])

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined || service === null) {
      return
    }

    setSend({ kind: 'enviando', percent: 0 })
    const outcome = await service.send(fieldType, file, (fraction) => {
      setSend({ kind: 'enviando', percent: Math.round(fraction * PERCENT) })
    })

    if (outcome.status === 'recusada') {
      setSend({ kind: 'recusado', message: outcome.message })
      return
    }
    setStored({ kind: 'encontrada', media: outcome.media })
    setSend({ kind: 'ocioso' })
    onChange(outcome.media.id)
  }

  const remove = (): void => {
    setStored({ kind: 'vazio' })
    setSend({ kind: 'ocioso' })
    onChange('')
  }

  const noun = policyOf(fieldType).label

  return (
    <div className="space-y-2">
      <StoredMedia fieldType={fieldType} stored={stored} />

      <input
        id={id}
        type="file"
        className={SELECT_CLASS}
        accept={acceptAttributeOf(fieldType)}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        disabled={send.kind === 'enviando' || service === null}
        onChange={(event) => void chooseFile(event)}
      />

      <p className="text-xs text-slate-500">{limitHint(fieldType)}</p>

      {send.kind === 'enviando' && <SendProgress label={label} percent={send.percent} />}

      {send.kind === 'recusado' && (
        <p role="alert" className="text-sm text-red-600">
          {send.message}
        </p>
      )}

      {value !== '' && send.kind !== 'enviando' && (
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          onClick={remove}
        >
          {`Remover ${noun === 'imagem' ? 'a imagem' : `o arquivo de ${noun}`}`}
        </button>
      )}
    </div>
  )
}

/**
 * O que está guardado no campo. Enquanto a API não respondeu, o campo diz que
 * está buscando; se a mídia não existe mais, diz isso em vez de deixar um
 * quadro vazio, que pareceria falha de carregamento.
 */
function StoredMedia({
  fieldType,
  stored,
}: {
  readonly fieldType: MediaFieldType
  readonly stored: StoredState
}): JSX.Element | null {
  if (stored.kind === 'vazio') {
    return <p className="text-xs text-slate-500">Nenhum arquivo enviado.</p>
  }
  if (stored.kind === 'buscando') {
    return <p className="text-xs text-slate-500">Carregando o arquivo guardado…</p>
  }
  if (stored.kind === 'ausente') {
    return (
      <p role="alert" className="text-sm text-red-600">
        O arquivo deste campo não está mais no armazenamento. Envie outro.
      </p>
    )
  }
  return (
    <div className="space-y-1">
      {PREVIEWS[fieldType](stored.media)}
      <p className="text-xs text-slate-500">{stored.media.originalFilename}</p>
    </div>
  )
}

/**
 * O progresso é barra **e** texto: a barra dá a noção de quanto falta num
 * relance, e o texto é o que chega a quem usa leitor de tela, que não enxerga a
 * barra encher.
 */
function SendProgress({
  label,
  percent,
}: {
  readonly label: string
  readonly percent: number
}): JSX.Element {
  return (
    <div className="space-y-1">
      <progress
        className="h-2 w-full"
        max={PERCENT}
        value={percent}
        aria-label={`Envio de ${label}`}
      />
      <p role="status" className="text-xs text-slate-600">
        {`Enviando… ${percent}%`}
      </p>
    </div>
  )
}
