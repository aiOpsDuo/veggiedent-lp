// Funcoes puras de validacao — Especificacao Funcional, secao 8.1-8.2.
// Exclusivas desta secao (nenhuma outra secao valida formulario), por isso
// nao ficam em um lib/ global.
//
// A regra e do codigo; o texto exibido ao visitante e do CMS e entra por
// parametro. Nenhuma destas funcoes conhece a origem das mensagens.
import type {
  LeadFormErrorMessages,
  LeadFormErrors,
  LeadFormValues,
} from '../CapturaLead.types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateNome(nome: string, message: string): string | undefined {
  return nome.trim().length >= 2 ? undefined : message
}

export function validateEmail(email: string, message: string): string | undefined {
  return EMAIL_REGEX.test(email.trim()) ? undefined : message
}

export function validateAceiteLgpd(aceite: boolean, message: string): string | undefined {
  return aceite ? undefined : message
}

/** Valida o formulario inteiro. Campos opcionais/condicionais nao bloqueiam o envio. */
export function validateLeadForm(
  values: LeadFormValues,
  messages: LeadFormErrorMessages,
): LeadFormErrors {
  const errors: LeadFormErrors = {}

  const nomeError = validateNome(values.nome, messages.nome)
  if (nomeError) errors.nome = nomeError

  const emailError = validateEmail(values.email, messages.email)
  if (emailError) errors.email = emailError

  const lgpdError = validateAceiteLgpd(values.aceiteLgpd, messages.aceiteLgpd)
  if (lgpdError) errors.aceiteLgpd = lgpdError

  return errors
}

export function validateField(
  name: keyof LeadFormValues,
  values: LeadFormValues,
  messages: LeadFormErrorMessages,
): string | undefined {
  switch (name) {
    case 'nome':
      return validateNome(values.nome, messages.nome)
    case 'email':
      return validateEmail(values.email, messages.email)
    case 'aceiteLgpd':
      return validateAceiteLgpd(values.aceiteLgpd, messages.aceiteLgpd)
    default:
      return undefined
  }
}
