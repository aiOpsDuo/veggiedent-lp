import { HttpStatus } from '@nestjs/common'

export const INTERNAL_ERROR_MESSAGE = 'Erro interno no servidor.'
export const INVALID_DATA_MESSAGE = 'Dados inválidos.'

const GENERIC_CLIENT_ERROR_MESSAGE = 'Requisição inválida.'

/**
 * Mensagens seguras para o cliente. A resposta nunca usa a mensagem da exceção:
 * ela pode carregar caminho de arquivo, nome de variável de ambiente ou detalhe
 * do Supabase — nada disso pode sair da API.
 */
const MESSAGE_BY_STATUS: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: GENERIC_CLIENT_ERROR_MESSAGE,
  [HttpStatus.UNAUTHORIZED]: 'Autenticação necessária.',
  [HttpStatus.FORBIDDEN]: 'Acesso negado.',
  [HttpStatus.NOT_FOUND]: 'Recurso não encontrado.',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Método não permitido.',
  [HttpStatus.CONFLICT]: 'Recurso em uso por outro registro.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Arquivo maior que o limite aceito.',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Tipo de arquivo não suportado.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: INVALID_DATA_MESSAGE,
  [HttpStatus.TOO_MANY_REQUESTS]: 'Muitas requisições. Tente novamente em instantes.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Serviço temporariamente indisponível.',
}

export function messageForStatus(status: number): string {
  const knownMessage = MESSAGE_BY_STATUS[status]
  if (knownMessage) {
    return knownMessage
  }
  return status < HttpStatus.INTERNAL_SERVER_ERROR
    ? GENERIC_CLIENT_ERROR_MESSAGE
    : INTERNAL_ERROR_MESSAGE
}
