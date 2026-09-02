// Funcoes puras de validacao — Especificacao Funcional, secao 8.1-8.2.
// Exclusivas desta secao (nenhuma outra secao valida formulario), por isso
// nao ficam em um lib/ global.
import type { LeadFormErrors, LeadFormValues } from '../CapturaLead.types'
import { formContent } from '../CapturaLead.content'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateNome(nome: string): string | undefined {
  return nome.trim().length >= 2 ? undefined : formContent.errorMessages.nome
}

export function validateEmail(email: string): string | undefined {
  return EMAIL_REGEX.test(email.trim()) ? undefined : formContent.errorMessages.email
}

export function validateAceiteLgpd(aceite: boolean): string | undefined {
  return aceite ? undefined : formContent.errorMessages.aceiteLgpd
}

/** Valida o formulario inteiro. Campos opcionais/condicionais nao bloqueiam o envio. */
export function validateLeadForm(values: LeadFormValues): LeadFormErrors {
  const errors: LeadFormErrors = {}

  const nomeError = validateNome(values.nome)
  if (nomeError) errors.nome = nomeError

  const emailError = validateEmail(values.email)
  if (emailError) errors.email = emailError

  const lgpdError = validateAceiteLgpd(values.aceiteLgpd)
  if (lgpdError) errors.aceiteLgpd = lgpdError

  return errors
}

export function validateField(name: keyof LeadFormValues, values: LeadFormValues): string | undefined {
  switch (name) {
    case 'nome':
      return validateNome(values.nome)
    case 'email':
      return validateEmail(values.email)
    case 'aceiteLgpd':
      return validateAceiteLgpd(values.aceiteLgpd)
    default:
      return undefined
  }
}
