import { useEffect, useState } from 'react'
import type { MediaService } from './media-service'
import type { StoredState } from './media-field-state'

/**
 * Busca a mídia guardada de um identificador, e mantém a prévia enquanto o
 * identificador não muda — mesmo que o efeito monte duas vezes (`StrictMode`).
 *
 * Compartilhado entre o campo de imagem único (`MediaField`) e cada quadro da
 * variante de múltiplas imagens (`MultiImageMediaField`, T36, item 3): os dois
 * só precisam saber "o que está guardado neste identificador agora", nunca
 * como buscar — extrair o efeito para um hook à parte (regra G5, DRY) evita
 * que o segundo componente reimplemente a mesma corrida entre a resposta da
 * API e uma montagem em duplicidade que o comentário original já documentava.
 *
 * `null` de serviço (ainda sem sessão) e identificador vazio contam como
 * "nada para buscar" — o campo continua desenhando `vazio` e apenas não pede
 * nada à API.
 */
export function useStoredMedia(mediaId: string, service: MediaService | null): StoredState {
  const [stored, setStored] = useState<StoredState>({ kind: 'vazio' })

  useEffect(() => {
    if (mediaId === '' || service === null) {
      setStored({ kind: 'vazio' })
      return
    }
    setStored((atual) =>
      atual.kind === 'encontrada' && atual.media.id === mediaId ? atual : { kind: 'buscando' },
    )
    let current = true
    void service.describe(mediaId).then((media) => {
      if (current) {
        setStored(media === null ? { kind: 'ausente' } : { kind: 'encontrada', media })
      }
    })
    return () => {
      current = false
    }
  }, [service, mediaId])

  return stored
}
