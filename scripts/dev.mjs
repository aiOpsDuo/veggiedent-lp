import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** O único endereço de desenvolvimento — ver README, "Como rodar localmente". */
const ENTRADA_UNICA = 'http://localhost:5173'

/**
 * Os três processos por trás da entrada única (T20).
 *
 * A LP vem por último porque é ela quem abre a entrada e encaminha `/admin` e
 * `/api`: quando a linha do endereço aparecer no terminal, os outros dois já
 * foram iniciados. `npm run dev --workspaces` não serve aqui porque percorre os
 * workspaces em sequência, e o primeiro servidor nunca termina.
 */
const SERVICOS = [
  { nome: 'API', comando: ['run', 'start:dev', '-w', 'apps/api'] },
  { nome: 'painel', comando: ['run', 'dev', '-w', 'apps/admin'] },
  { nome: 'LP (entrada única)', comando: ['run', 'dev', '-w', 'apps/lp'] },
]

const processos = []
let encerrando = false

/**
 * Derruba os três de uma vez.
 *
 * Um servidor sobrevivente seguraria a porta e faria a próxima subida falhar
 * com `strictPort`, então a queda de qualquer um leva os outros junto.
 */
function encerrarTudo(codigo) {
  if (encerrando) return
  encerrando = true
  process.exitCode = codigo
  processos.forEach((processo) => processo.kill('SIGTERM'))
}

process.on('SIGINT', () => encerrarTudo(0))
process.on('SIGTERM', () => encerrarTudo(0))

for (const { nome, comando } of SERVICOS) {
  const processo = spawn('npm', comando, { cwd: RAIZ, stdio: 'inherit' })

  processo.on('error', (erro) => {
    console.error(`Falha ao iniciar ${nome}: ${erro.message}`)
    encerrarTudo(1)
  })

  processo.on('exit', (codigo, sinal) => {
    if (encerrando) return
    console.error(`\n${nome} terminou (${sinal ?? codigo}). Derrubando os demais.`)
    encerrarTudo(codigo ?? 1)
  })

  processos.push(processo)
}

console.log(`\nEntrada única em ${ENTRADA_UNICA} — LP em /, painel em /admin, API em /api\n`)
