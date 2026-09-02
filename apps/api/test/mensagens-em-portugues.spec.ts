import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { HttpStatus } from '@nestjs/common'
import { getMetadataStorage } from 'class-validator'
import request from 'supertest'
import { startContentHarness, type ContentHarness } from './content-harness'

/**
 * Guarda contra a regressão que a T4 deixou registrada: o `class-validator`
 * responde em inglês por padrão, e quem lê essas mensagens é o operador do
 * painel — em português (PRD § "rótulos na linguagem de quem escreve conteúdo").
 *
 * O teste não confere uma lista de DTOs escrita à mão; ele varre `src/` atrás
 * de todo `*.dto.ts`. Um DTO novo criado na T7 ou na T8 com um decorador sem
 * `message` faz esta suíte falhar sem que ninguém precise lembrar de vir aqui.
 */

const SRC = join(__dirname, '..', 'src')

/** Trechos que só aparecem nas mensagens padrão em inglês da biblioteca. */
const MARCAS_DE_INGLES = [
  'must be',
  'should not',
  'should be',
  'must not',
  'is not',
  'each value',
]

function dtoFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      return dtoFiles(path)
    }
    return entry.endsWith('.dto.ts') ? [path] : []
  })
}

function exportedClasses(path: string): { file: string; target: Function }[] {
  const module = require(path) as Record<string, unknown>
  return Object.values(module)
    .filter((value): value is Function => typeof value === 'function')
    .map((target) => ({ file: path.slice(SRC.length + 1), target }))
}

describe('mensagens de validação em português', () => {
  const classes = dtoFiles(SRC).flatMap(exportedClasses)

  it('encontra os DTOs da API — o teste não pode passar por não achar nada', () => {
    expect(classes.length).toBeGreaterThan(0)
  })

  it.each(classes.map(({ file, target }) => [`${file} → ${target.name}`, target]))(
    '%s declara mensagem própria em toda restrição',
    (_nome, target) => {
      const restricoes = getMetadataStorage().getTargetValidationMetadatas(
        target as Function,
        '',
        true,
        false,
      )
      expect(restricoes.length).toBeGreaterThan(0)

      for (const restricao of restricoes) {
        expect(typeof restricao.message).toBe('string')
        const mensagem = String(restricao.message).toLowerCase()
        expect(mensagem.length).toBeGreaterThan(0)
        for (const marca of MARCAS_DE_INGLES) {
          expect(mensagem).not.toContain(marca)
        }
      }
    },
  )
})

describe('mensagens em português na resposta', () => {
  let harness: ContentHarness

  beforeEach(async () => {
    harness = await startContentHarness()
  })

  afterEach(async () => {
    await harness.close()
  })

  const comToken = (req: request.Test): request.Test =>
    req.set('authorization', `Bearer ${harness.token}`)

  it('tipo errado no corpo responde a mensagem do decorador', async () => {
    const response = await comToken(
      request(harness.app.getHttpServer())
        .patch('/api/admin/sections/faq/visibility')
        .send({ isPublished: 'talvez' }),
    )

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(response.body.fields).toEqual({ isPublished: 'Informe sim ou não.' })
  })

  /**
   * `forbidNonWhitelisted` produz sua mensagem dentro do próprio
   * `class-validator`, sem passar por decorador nenhum: nenhuma quantidade de
   * `message:` nos DTOs a traduz. É o caso que escapa do teste de varredura
   * acima, e por isso está fixado aqui.
   */
  it('campo desconhecido no corpo não responde em inglês', async () => {
    const response = await comToken(
      request(harness.app.getHttpServer())
        .patch('/api/admin/sections/faq/visibility')
        .send({ isPublished: true, extra: 'x' }),
    )

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(response.body.fields).toEqual({ extra: 'Campo desconhecido nesta requisição.' })
    expect(JSON.stringify(response.body)).not.toContain('should not exist')
  })
})
