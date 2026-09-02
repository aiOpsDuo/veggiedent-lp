/**
 * `media_assets.storage_path` guarda o caminho **qualificado pelo bucket**, na
 * forma `bucket/caminho/do/arquivo`.
 *
 * Poderia guardar só o caminho dentro do bucket, já que o bucket se deduz da
 * natureza da mídia. Guardar os dois torna a coluna suficiente sozinha para a
 * conciliação de arquivos órfãos do risco R-04, que compara o que está no
 * armazenamento com o que está registrado — sem precisar reconstruir o bucket a
 * partir de outra coluna.
 */

const SEPARATOR = '/'

export function toStoragePath(bucket: string, objectPath: string): string {
  return `${bucket}${SEPARATOR}${objectPath}`
}

export interface StorageLocation {
  readonly bucket: string
  readonly objectPath: string
}

/**
 * O inverso de `toStoragePath`. O primeiro segmento é sempre o bucket.
 *
 * Um caminho sem separador não deveria existir — toda linha é gravada por
 * `toStoragePath`. Se existir, sai com o caminho do objeto vazio, e a remoção
 * falha alto no armazenamento em vez de apagar um arquivo qualquer.
 */
export function splitStoragePath(storagePath: string): StorageLocation {
  const separatorIndex = storagePath.indexOf(SEPARATOR)
  if (separatorIndex < 0) {
    return { bucket: storagePath, objectPath: '' }
  }
  return {
    bucket: storagePath.slice(0, separatorIndex),
    objectPath: storagePath.slice(separatorIndex + 1),
  }
}
