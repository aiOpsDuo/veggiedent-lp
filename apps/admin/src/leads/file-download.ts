import type { LeadsExport } from './leads-gateway'

/**
 * Entrega ao operador o arquivo que a API respondeu.
 *
 * Os bytes vêm da API e são entregues **sem serem reescritos**: o corpo da
 * resposta vira um `Blob` no cliente da API e chega aqui intacto. É isso que
 * preserva o BOM UTF-8 e o ponto e vírgula que fazem o Excel em português abrir
 * o arquivo certo (regra de negócio RN-01) — reconstruir o CSV no navegador
 * seria reimplementar a regra em um segundo lugar e arriscar perder o BOM na
 * reconversão.
 *
 * É uma função injetada na tela, e não uma chamada direta ao navegador dentro
 * dela, porque `URL.createObjectURL` e o clique sintético só existem em
 * navegador de verdade — a tela precisa ser exercitável sem eles. A verificação
 * de que este caminho funciona é feita em navegador real, nunca por teste.
 */
export type FileDownload = (file: LeadsExport) => void

export const downloadInBrowser: FileDownload = (file) => {
  const objectUrl = URL.createObjectURL(file.content)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = file.filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}
