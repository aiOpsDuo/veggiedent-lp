import type { MediaUrlMap } from '../../../shared/domain/media-references'

/** Token de injeção da porta. O domínio declara; a infraestrutura implementa. */
export const MEDIA_URL_REPOSITORY = Symbol('MediaUrlRepository')

/**
 * Leitura dos endereços públicos das mídias (SDD § "Modelo de dados").
 *
 * A porta é estreita de propósito: quem serve conteúdo publicado só precisa
 * traduzir identificador em URL, e não deve ganhar de brinde registro, remoção
 * ou emissão de credencial de upload, que são da T7 (ISP). O registro completo
 * da mídia terá sua própria porta neste mesmo módulo.
 *
 * `findPublicUrls` recebe **todos** os identificadores de uma vez. É a
 * assinatura que impede o N+1 do risco R-05: não existe método que resolva uma
 * mídia por chamada, então nem um adaptador distraído consegue transformar a
 * resolução em uma consulta por item.
 */
export interface MediaUrlRepository {
  /**
   * URLs das mídias pedidas. Identificador sem registro — mídia apagada ou
   * referência quebrada — simplesmente não aparece no mapa; ausência não é erro.
   */
  findPublicUrls(mediaIds: readonly string[]): Promise<MediaUrlMap>
}
