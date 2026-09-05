import type { RegisteredMedia } from './media-gateway'

/**
 * Os dois estados que qualquer campo de mídia — o campo único (`MediaField`)
 * e cada quadro da variante de múltiplas imagens (`MultiImageMediaField`,
 * T36, item 3) — precisa acompanhar: o que está sendo enviado agora, e o que
 * já está guardado num identificador. Extraído para um arquivo à parte
 * (regra G5, DRY) para os dois nunca divergirem no que cada estado significa.
 */

export const PERCENT = 100

export type SendState =
  | { readonly kind: 'ocioso' }
  | { readonly kind: 'enviando'; readonly percent: number }
  | { readonly kind: 'recusado'; readonly message: string }

/**
 * `ausente` é diferente de `buscando`: uma mídia apagada por fora precisa ser
 * dita ao operador, não escondida atrás de um "carregando" que nunca termina.
 */
export type StoredState =
  | { readonly kind: 'vazio' }
  | { readonly kind: 'buscando' }
  | { readonly kind: 'encontrada'; readonly media: RegisteredMedia }
  | { readonly kind: 'ausente' }
