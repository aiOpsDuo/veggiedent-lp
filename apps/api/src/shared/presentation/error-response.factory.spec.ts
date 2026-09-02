import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common'
import { FieldValidationError } from '../domain/field-validation.error'
import { ResourceInUseError } from '../domain/resource-in-use.error'
import { toErrorResponse } from './error-response.factory'
import { INTERNAL_ERROR_MESSAGE, INVALID_DATA_MESSAGE } from './error-messages'

describe('toErrorResponse', () => {
  it('traduz erro de campo para 422 com o mapa de campos', () => {
    const response = toErrorResponse(
      new FieldValidationError({ 'hero.headline': 'Campo obrigatório.' }),
    )

    expect(response).toEqual({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: INVALID_DATA_MESSAGE,
      fields: { 'hero.headline': 'Campo obrigatório.' },
    })
  })

  it('usa a mensagem segura do status, nunca a da exceção HTTP', () => {
    const response = toErrorResponse(
      new NotFoundException('secao "hero" ausente na tabela content_sections'),
    )

    expect(response).toEqual({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'Recurso não encontrado.',
    })
  })

  it('traduz recurso em uso para 409 sem contar quem o usa', () => {
    const response = toErrorResponse(
      new ResourceInUseError('mídia 0f2f5b1e', ['Herói', 'Metadados da página']),
    )

    expect(response).toEqual({
      statusCode: HttpStatus.CONFLICT,
      error: 'Recurso em uso por outro registro.',
    })
    expect(JSON.stringify(response)).not.toContain('Herói')
  })

  it('não expõe detalhe de exceção desconhecida', () => {
    const response = toErrorResponse(
      new Error('falha ao ler SUPABASE_SECRET_KEY do adaptador do Supabase'),
    )

    expect(response).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: INTERNAL_ERROR_MESSAGE,
    })
  })

  it('trata valor lançado que nem é um erro', () => {
    expect(toErrorResponse('string solta')).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: INTERNAL_ERROR_MESSAGE,
    })
  })

  it('preserva o status de uma exceção HTTP sem mensagem mapeada', () => {
    const response = toErrorResponse(new HttpException('detalhe', 418))

    expect(response.statusCode).toBe(418)
    expect(response.error).toBe('Requisição inválida.')
  })

  it('nunca inclui fields fora do caminho de validação', () => {
    expect(toErrorResponse(new ForbiddenException())).not.toHaveProperty('fields')
  })
})
