/**
 * O identificador do vídeo nos eventos de analytics (`video_start`,
 * `video_progress`).
 *
 * O esquema de conteúdo não tem campo de identificador — e não deve ter: seria
 * um campo técnico exposto a quem edita conteúdo. Ele é derivado do **nome do
 * arquivo** enviado, que é o dado mais estável que a seção tem: o título do
 * vídeo é texto editável e a posição na lista é reordenável, então qualquer um
 * dos dois quebraria a série histórica do relatório ao ser mexido no painel.
 *
 * Consequência declarada: os identificadores mudaram em relação aos que estavam
 * escritos no código (`tutor-abrindo-petisco` virou o nome do arquivo real).
 */
export function videoTrackingId(videoUrl: string): string {
  const nomeDoArquivo = videoUrl.split('/').pop() ?? videoUrl
  return decodeURIComponent(nomeDoArquivo).replace(/\.[^.]+$/, '')
}
