import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Regenera o instantâneo de conteúdo embutido no build da LP (SDD § D-08).
 *
 * O instantâneo é o que a página renderiza quando `GET /api/content` não
 * responde: sem ele, uma queda da API deixaria a página pública vazia, que é
 * exatamente o que o PRD proíbe. Ele é um arquivo versionado, e não uma busca
 * durante o `npm run build`, por duas razões: o build precisa passar sem rede
 * (integração contínua, máquina de quem desenvolve) e o conteúdo de reserva
 * precisa ser revisável no diff de quem publica.
 *
 * Uso: `npm run instantaneo` com a API no ar. Ver README, "Instantâneo de
 * conteúdo", para quando regenerar.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const DESTINO = resolve(RAIZ, 'apps/lp/src/content/content-snapshot.json')

/** A entrada única de desenvolvimento (T20) — a mesma que o navegador usa. */
const ORIGEM_PADRAO = 'http://localhost:5173/api/content'

const origem = process.argv[2] ?? process.env.CONTENT_URL ?? ORIGEM_PADRAO

function abortar(motivo) {
  console.error(`Instantâneo não gerado: ${motivo}`)
  console.error(`O arquivo em ${DESTINO} foi mantido como estava.`)
  process.exit(1)
}

let resposta
try {
  resposta = await fetch(origem)
} catch (erro) {
  abortar(`${origem} não respondeu (${erro.message}). A API precisa estar no ar.`)
}

if (!resposta.ok) {
  abortar(`${origem} respondeu ${resposta.status}.`)
}

let conteudo
try {
  conteudo = await resposta.json()
} catch (erro) {
  abortar(`a resposta de ${origem} não é JSON (${erro.message}).`)
}

const secoes = conteudo?.sections
if (typeof secoes !== 'object' || secoes === null || Array.isArray(secoes)) {
  abortar('a resposta não traz o objeto `sections`.')
}

const quantidade = Object.keys(secoes).length
if (quantidade === 0) {
  // Gravar um instantâneo vazio seria pior do que não ter instantâneo: a página
  // de reserva renderizaria nada, em silêncio, e só quem abrisse o site durante
  // uma queda da API descobriria.
  abortar('a API respondeu sem nenhuma seção publicada.')
}

writeFileSync(DESTINO, `${JSON.stringify(conteudo, null, 2)}\n`, 'utf8')

console.log(`Instantâneo gravado com ${quantidade} seções publicadas, lido de ${origem}.`)
console.log(DESTINO)
