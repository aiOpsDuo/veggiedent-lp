import { useEffect, useState, type ChangeEvent } from 'react'
import type { MediaFieldType } from '@veggiedent/content-schema'
import { DeleteImageButton, DropzoneEmptyIcon, DropzoneShell, DropzoneUploading } from './Dropzone'
import { useMediaService } from './media-context'
import { PERCENT, type SendState, type StoredState } from './media-field-state'
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
 *
 * O tipo `imagem` desenha uma área de soltar/enviar (dropzone, T36, item 2); o
 * tipo `video` mantém o seletor de arquivo tradicional com barra de progresso
 * — os dois casos, por serem visualmente bem diferentes, são dois componentes
 * de apresentação (`ImageDropzoneField`/`VideoPickerField`) que só a função
 * exportada escolhe entre si, cada um com um único jeito de desenhar o que
 * recebe (G30, G34).
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

  const disabled = service === null

  return (
    <div className="space-y-2">
      {fieldType === 'imagem' ? (
        <ImageDropzoneField
          id={id}
          describedBy={describedBy}
          invalid={invalid}
          required={required}
          stored={stored}
          send={send}
          disabled={disabled}
          onChooseFile={(event) => void chooseFile(event)}
          onRemove={remove}
        />
      ) : (
        <VideoPickerField
          id={id}
          describedBy={describedBy}
          invalid={invalid}
          required={required}
          label={label}
          value={value}
          stored={stored}
          send={send}
          disabled={disabled}
          onChooseFile={(event) => void chooseFile(event)}
          onRemove={remove}
        />
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">{limitHint(fieldType)}</p>

      {send.kind === 'recusado' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {send.message}
        </p>
      )}
    </div>
  )
}

interface ImageDropzoneFieldProps {
  readonly id: string
  readonly describedBy: string | undefined
  readonly invalid: boolean
  readonly required: boolean
  readonly stored: StoredState
  readonly send: SendState
  readonly disabled: boolean
  readonly onChooseFile: (event: ChangeEvent<HTMLInputElement>) => void
  readonly onRemove: () => void
}

/**
 * Altura fixa e compacta (~160px, como a antiga prévia em `max-h-40`), largura
 * total do campo: um retângulo baixo, não uma faixa 16:9 esticada pela largura
 * do formulário (T36-ajuste — o formato `aspect-video` original dominava a
 * tela num formulário largo).
 */
const DROPZONE_SIZE_CLASS = 'h-40 w-full'

/**
 * O campo de imagem em estilo de soltar/enviar (T36, item 2): retângulo de
 * largura total, borda tracejada, ícone quando vazio, animação dentro do
 * próprio campo durante o envio, imagem preenchendo a área quando enviada, e
 * o botão de excluir só quando há imagem.
 *
 * O botão de excluir é **irmão** do `<label>`, nunca filho dele — os dois
 * ficam num `div` com `position: relative` só para o posicionamento absoluto
 * do botão. Colocar um botão dentro de um `<label>` faria o clique nele também
 * abrir o seletor de arquivo, na maioria dos navegadores, por causa da
 * ativação nativa do rótulo.
 */
function ImageDropzoneField({
  id,
  describedBy,
  invalid,
  required,
  stored,
  send,
  disabled,
  onChooseFile,
  onRemove,
}: ImageDropzoneFieldProps): JSX.Element {
  const uploading = send.kind === 'enviando'
  const inputDisabled = disabled || uploading
  const hasImage = stored.kind === 'encontrada'

  return (
    <div className="space-y-1">
      <div className="relative">
        <label htmlFor={id} className="block">
          <input
            id={id}
            type="file"
            className="peer sr-only"
            accept={acceptAttributeOf('imagem')}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            disabled={inputDisabled}
            onChange={onChooseFile}
          />
          <DropzoneShell interactive={!inputDisabled} className={DROPZONE_SIZE_CLASS}>
            <ImageDropzoneContent stored={stored} send={send} />
          </DropzoneShell>
        </label>

        {hasImage && !uploading && (
          <DeleteImageButton label="Remover a imagem" onClick={onRemove} />
        )}
      </div>

      {hasImage && !uploading && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {stored.media.originalFilename}
        </p>
      )}

      {stored.kind === 'ausente' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          O arquivo deste campo não está mais no armazenamento. Envie outro.
        </p>
      )}
    </div>
  )
}

/** O que aparece dentro do retângulo, conforme o envio e o que está guardado. */
function ImageDropzoneContent({
  stored,
  send,
}: {
  readonly stored: StoredState
  readonly send: SendState
}): JSX.Element {
  if (send.kind === 'enviando') {
    return <DropzoneUploading percent={send.percent} />
  }
  if (stored.kind === 'encontrada') {
    return (
      <img
        src={stored.media.publicUrl}
        alt={`Prévia de ${stored.media.originalFilename}`}
        className="h-full w-full object-cover"
      />
    )
  }
  if (stored.kind === 'buscando') {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">Carregando o arquivo guardado…</p>
    )
  }
  return <DropzoneEmptyIcon label="Clique para enviar uma imagem" />
}

interface VideoPickerFieldProps {
  readonly id: string
  readonly describedBy: string | undefined
  readonly invalid: boolean
  readonly required: boolean
  readonly label: string
  readonly value: string
  readonly stored: StoredState
  readonly send: SendState
  readonly disabled: boolean
  readonly onChooseFile: (event: ChangeEvent<HTMLInputElement>) => void
  readonly onRemove: () => void
}

const SELECT_CLASS =
  'block w-full text-sm text-slate-700 file:mr-3 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-100 dark:text-slate-300 dark:file:border-slate-600 dark:file:bg-slate-800 dark:file:text-slate-200 dark:hover:file:bg-slate-700'

/**
 * O campo de vídeo, sem nenhuma mudança visual da T36: seletor de arquivo
 * tradicional, prévia com controles de reprodução e barra de progresso. O
 * pedido do usuário foi só sobre o campo de imagem (T36, item 2) — vídeo não
 * ganha nada em virar dropzone, porque não há como "ver o conteúdo" de um
 * vídeo antes de tocar, do mesmo jeito que uma imagem se vê inteira de uma vez.
 */
function VideoPickerField({
  id,
  describedBy,
  invalid,
  required,
  label,
  value,
  stored,
  send,
  disabled,
  onChooseFile,
  onRemove,
}: VideoPickerFieldProps): JSX.Element {
  return (
    <div className="space-y-2">
      <VideoStoredMedia stored={stored} />

      <input
        id={id}
        type="file"
        className={SELECT_CLASS}
        accept={acceptAttributeOf('video')}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        disabled={disabled || send.kind === 'enviando'}
        onChange={onChooseFile}
      />

      {send.kind === 'enviando' && <SendProgress label={label} percent={send.percent} />}

      {value !== '' && send.kind !== 'enviando' && (
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={onRemove}
        >
          {`Remover o arquivo de ${policyOf('video').label}`}
        </button>
      )}
    </div>
  )
}

/**
 * O que está guardado no campo de vídeo. Enquanto a API não respondeu, o campo
 * diz que está buscando; se a mídia não existe mais, diz isso em vez de deixar
 * um quadro vazio, que pareceria falha de carregamento.
 */
function VideoStoredMedia({ stored }: { readonly stored: StoredState }): JSX.Element | null {
  if (stored.kind === 'vazio') {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum arquivo enviado.</p>
  }
  if (stored.kind === 'buscando') {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">Carregando o arquivo guardado…</p>
    )
  }
  if (stored.kind === 'ausente') {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        O arquivo deste campo não está mais no armazenamento. Envie outro.
      </p>
    )
  }
  return (
    <div className="space-y-1">
      <video
        src={stored.media.publicUrl}
        controls
        preload="metadata"
        aria-label={`Prévia de ${stored.media.originalFilename}`}
        className="max-h-40 rounded border border-slate-200 bg-slate-900"
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {stored.media.originalFilename}
      </p>
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
      <p role="status" className="text-xs text-slate-600 dark:text-slate-400">
        {`Enviando… ${percent}%`}
      </p>
    </div>
  )
}
