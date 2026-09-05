import { useState, type ChangeEvent } from 'react'
import { DeleteImageButton, DropzoneEmptyIcon, DropzoneShell, DropzoneUploading } from './Dropzone'
import { useMediaService } from './media-context'
import { PERCENT, type SendState, type StoredState } from './media-field-state'
import type { MediaService } from './media-service'
import { useStoredMedia } from './use-stored-media'
import { acceptAttributeOf, limitHint } from './upload-policy'

/**
 * Variante de múltiplas imagens do campo de mídia (T36, item 3): a mesma
 * mecânica visual do dropzone único (`MediaField`, tipo `imagem`) — retângulo
 * tracejado, ícone quando vazio, animação dentro do campo durante o envio,
 * botão de excluir só com imagem —, mas guardando mais de uma imagem no mesmo
 * campo, cada uma com seu próprio quadro e seu próprio botão de excluir.
 *
 * **Decisão registrada (T36, item 3):** este componente existe pronto para
 * uso futuro, verificado isoladamente num navegador de verdade — ver
 * `MultiImageFieldHarnessScreen.tsx`, alcançável em `/verificacao/multi-imagem`
 * com sessão ativa. Nenhuma seção existente foi migrada para usá-lo.
 *
 * Por quê: o esquema de conteúdo não tem hoje um tipo de campo "várias
 * imagens direto" — o padrão para múltiplas fotos é uma **lista** de itens,
 * cada um com seu próprio campo de imagem (`captura_lead.mosaico`, com seis
 * fotos já publicadas). Trocar `mosaico` por este componente mudaria o
 * formato do documento gravado — de uma lista de itens
 * `{ image, ordem, visivel }` para um array simples de identificadores —, o
 * que exige alterar o esquema em `packages/content-schema`, a validação da
 * API que o lê, e migrar o dado já existente sem perder nenhuma das seis
 * fotos. Isso é uma migração de esquema e de dado real, não uma troca de
 * casca visual, e desproporcional ao pedido desta tarefa (reorganizar a
 * aparência do campo de imagem). Entregar o componente pronto, testado e
 * verificado de verdade no navegador cobre o que foi pedido sem esse risco;
 * migrar `mosaico` (ou outro caso concreto) para usá-lo fica como tarefa
 * futura, à parte, tratada com o cuidado de migração que o projeto já exige
 * (idempotência, conferência de conteúdo antes/depois).
 */

export interface MultiImageMediaFieldProps {
  readonly id: string
  readonly describedBy: string | undefined
  readonly invalid: boolean
  readonly required: boolean
  readonly value: readonly string[]
  readonly onChange: (mediaIds: readonly string[]) => void
}

/**
 * Bloco pequeno e quadrado (128px de lado) em vez de esticar pela largura da
 * célula da grade (T36-ajuste — `aspect-square` numa grade larga produzia
 * blocos grandes demais).
 */
const TILE_SIZE_CLASS = 'h-32 w-32'

export function MultiImageMediaField({
  id,
  describedBy,
  invalid,
  required,
  value,
  onChange,
}: MultiImageMediaFieldProps): JSX.Element {
  const service = useMediaService()
  const [send, setSend] = useState<SendState>({ kind: 'ocioso' })
  const uploading = send.kind === 'enviando'
  const disabled = service === null || uploading

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined || service === null) {
      return
    }

    setSend({ kind: 'enviando', percent: 0 })
    const outcome = await service.send('imagem', file, (fraction) => {
      setSend({ kind: 'enviando', percent: Math.round(fraction * PERCENT) })
    })

    if (outcome.status === 'recusada') {
      setSend({ kind: 'recusado', message: outcome.message })
      return
    }
    setSend({ kind: 'ocioso' })
    onChange([...value, outcome.media.id])
  }

  const removeAt = (mediaId: string): void => {
    onChange(value.filter((current) => current !== mediaId))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {value.map((mediaId) => (
          <ImageSlot key={mediaId} mediaId={mediaId} service={service} onRemove={() => removeAt(mediaId)} />
        ))}

        <div className="relative shrink-0">
          <label htmlFor={id} className="block">
            <input
              id={id}
              type="file"
              className="peer sr-only"
              accept={acceptAttributeOf('imagem')}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              aria-required={(required && value.length === 0) || undefined}
              disabled={disabled}
              onChange={(event) => void chooseFile(event)}
            />
            <DropzoneShell interactive={!disabled} className={TILE_SIZE_CLASS}>
              {uploading ? (
                <DropzoneUploading percent={send.percent} />
              ) : (
                <DropzoneEmptyIcon
                  label={value.length === 0 ? 'Clique para enviar uma imagem' : 'Adicionar outra imagem'}
                />
              )}
            </DropzoneShell>
          </label>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">{limitHint('imagem')}</p>

      {send.kind === 'recusado' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {send.message}
        </p>
      )}
    </div>
  )
}

interface ImageSlotProps {
  readonly mediaId: string
  readonly service: MediaService | null
  readonly onRemove: () => void
}

/**
 * Um quadro do campo múltiplo. Chaveado pelo próprio identificador da mídia
 * (`key={mediaId}` em quem monta): remover um item desmonta só o quadro dele
 * — os outros mantêm o que já buscaram, sem refazer a leitura.
 */
function ImageSlot({ mediaId, service, onRemove }: ImageSlotProps): JSX.Element {
  const stored = useStoredMedia(mediaId, service)

  return (
    <div className="relative shrink-0">
      <DropzoneShell interactive={false} className={TILE_SIZE_CLASS}>
        <ImageSlotContent stored={stored} />
      </DropzoneShell>

      {stored.kind === 'encontrada' && (
        <DeleteImageButton
          label={`Remover a imagem ${stored.media.originalFilename}`}
          onClick={onRemove}
        />
      )}
    </div>
  )
}

function ImageSlotContent({ stored }: { readonly stored: StoredState }): JSX.Element {
  if (stored.kind === 'encontrada') {
    return (
      <img
        src={stored.media.publicUrl}
        alt={`Prévia de ${stored.media.originalFilename}`}
        className="h-full w-full object-contain"
      />
    )
  }
  if (stored.kind === 'ausente') {
    return (
      <p role="alert" className="px-2 text-center text-xs text-red-600 dark:text-red-400">
        Arquivo não está mais no armazenamento.
      </p>
    )
  }
  return <p className="text-xs text-slate-500 dark:text-slate-400">Carregando…</p>
}
