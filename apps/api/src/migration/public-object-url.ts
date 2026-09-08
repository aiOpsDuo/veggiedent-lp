/**
 * A forma de uma URL pública do Supabase Storage, nas duas direções.
 *
 * O instantâneo guarda URLs já resolvidas — foi assim que a LP as recebeu —, e
 * a carga precisa voltar delas ao par `bucket` + caminho do objeto para saber
 * de que natureza é a mídia e se o mesmo objeto já existe no ambiente de
 * destino. É o inverso do que `SupabaseMediaStorage.publicUrlFor` faz ao servir
 * o conteúdo, e o único ponto da carga que conhece esse formato.
 */

const PUBLIC_OBJECT_MARKER = '/storage/v1/object/public/'

export interface PublicObjectLocation {
  /** Origem do projeto Supabase que serviu o arquivo, com esquema e host. */
  readonly origin: string
  readonly bucket: string
  /** Caminho dentro do bucket, na forma `identificador/nome-do-arquivo`. */
  readonly objectPath: string
}

/** `null` quando a URL não é uma URL pública de objeto do Supabase Storage. */
export function parsePublicObjectUrl(url: string): PublicObjectLocation | null {
  const markerIndex = url.indexOf(PUBLIC_OBJECT_MARKER)
  if (markerIndex < 0) {
    return null
  }

  const origin = url.slice(0, markerIndex)
  const rest = url.slice(markerIndex + PUBLIC_OBJECT_MARKER.length)
  const separatorIndex = rest.indexOf('/')
  if (origin.length === 0 || separatorIndex <= 0 || separatorIndex === rest.length - 1) {
    return null
  }

  return {
    origin,
    bucket: rest.slice(0, separatorIndex),
    objectPath: rest.slice(separatorIndex + 1),
  }
}

export function publicObjectUrl(
  supabaseUrl: string,
  bucket: string,
  objectPath: string,
): string {
  return `${supabaseUrl.replace(/\/+$/, '')}${PUBLIC_OBJECT_MARKER}${bucket}/${objectPath}`
}
