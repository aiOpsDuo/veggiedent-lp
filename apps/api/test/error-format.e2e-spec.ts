import { Body, Controller, Get, HttpStatus, Logger, Post } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsNotEmpty, IsObject, ValidateNested } from 'class-validator'
import request from 'supertest'
import { Public } from '../src/modules/auth/presentation/public.decorator'
import { createTestApp } from './create-test-app'

const INTERNAL_DETAIL = 'falha ao ler SUPABASE_SECRET_KEY do adaptador do Supabase'

class HeroProbeDto {
  @IsNotEmpty({ message: 'Campo obrigatório.' })
  headline!: string
}

class SectionProbeDto {
  @IsObject({ message: 'Informe o conteúdo da seção.' })
  @ValidateNested()
  @Type(() => HeroProbeDto)
  hero!: HeroProbeDto
}

/**
 * Controller-sonda: existe só neste teste. Ele força os dois caminhos de erro
 * sem que a aplicação publicada precise expor uma rota de mentira.
 *
 * `@Public()` porque o alvo aqui é o formato do erro, não a autenticação: sem a
 * marcação, a guarda global (T5) recusaria antes com 401 e o teste deixaria de
 * exercitar o 422 e o 500. A guarda tem a sua própria suíte.
 */
@Public()
@Controller('probe')
class ErrorProbeController {
  @Post('validation')
  accept(@Body() _body: SectionProbeDto): { success: true } {
    return { success: true }
  }

  @Get('failure')
  fail(): never {
    throw new Error(INTERNAL_DETAIL)
  }
}

describe('formato único de erro', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ErrorProbeController] })
  })

  afterAll(async () => {
    await app.close()
  })

  it('responde erro de validação como { statusCode, error, fields }', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/validation')
      .send({ hero: {} })

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(response.body).toEqual({
      statusCode: 422,
      error: 'Dados inválidos.',
      fields: { 'hero.headline': 'Campo obrigatório.' },
    })
    expect(Object.keys(response.body).sort()).toEqual([
      'error',
      'fields',
      'statusCode',
    ])
  })

  it('aponta o campo raiz quando a seção inteira falta', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/validation')
      .send({})

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(response.body.fields).toEqual({
      hero: 'Informe o conteúdo da seção.',
    })
  })

  it('recusa propriedade que o contrato não prevê', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/probe/validation')
      .send({ hero: { headline: 'Sorriso saudável' }, campoIntruso: 'x' })

    expect(response.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(Object.keys(response.body.fields)).toEqual(['campoIntruso'])
  })

  it('não vaza detalhe interno na resposta 500', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    const response = await request(app.getHttpServer()).get('/api/probe/failure')

    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(response.body).toEqual({
      statusCode: 500,
      error: 'Erro interno no servidor.',
    })

    const rawBody = response.text
    expect(rawBody).not.toContain('SUPABASE')
    expect(rawBody).not.toContain(INTERNAL_DETAIL)
    expect(rawBody).not.toContain('apps/api')
    expect(rawBody).not.toMatch(/\bat .+:\d+:\d+/)

    // O detalhe não some: ele fica no log do servidor, fora do alcance do cliente.
    expect(logged).toHaveBeenCalledWith(
      'Falha não tratada ao responder a requisição.',
      expect.stringContaining(INTERNAL_DETAIL),
    )

    logged.mockRestore()
  })

  it('usa o mesmo formato para rota inexistente', async () => {
    const response = await request(app.getHttpServer()).get('/api/rota-inexistente')

    expect(response.status).toBe(HttpStatus.NOT_FOUND)
    expect(response.body).toEqual({
      statusCode: 404,
      error: 'Recurso não encontrado.',
    })
  })
})
