/**
 * A imagem que o visitante ve **antes** de um video tocar: o primeiro quadro do
 * proprio arquivo, sem nenhum arquivo de miniatura cadastrado.
 *
 * O esquema nao tem campo de miniatura por decisao de produto (ver
 * `packages/content-schema/src/sections/demonstracao.ts`). Quem entrega a
 * imagem de espera e o proprio elemento `<video>`: sem atributo `poster`, o
 * navegador pinta o primeiro quadro assim que decodifica o inicio do arquivo.
 *
 * O fragmento de midia abaixo e o que torna isso confiavel em vez de provavel.
 * Sem ele, um navegador que so carregou os metadados pode ficar com a area em
 * branco ate o play — o comportamento historico do Safari no iOS. Pedindo um
 * instante logo apos o inicio, o navegador precisa buscar e decodificar esse
 * quadro, e e ele que fica na tela. O deslocamento e pequeno o bastante para
 * ser o primeiro quadro para quem assiste, e a reproducao comeca dali.
 */
const PRIMEIRO_QUADRO = '#t=0.001'

/** O endereco do video pedindo ao navegador que pinte o primeiro quadro. */
export function comPrimeiroQuadro(videoUrl: string): string {
  return `${videoUrl}${PRIMEIRO_QUADRO}`
}
