import { describe, expect, it } from 'vitest'
import { formContent } from '../CapturaLead.content'
import { validateField, validateLeadForm } from './validation'
import type { LeadFormValues } from '../CapturaLead.types'

const valoresValidos: LeadFormValues = {
  nome: 'Ana Souza',
  email: 'ana@exemplo.com.br',
  telefone: '',
  nomeCachorro: '',
  porteCachorro: '',
  cidadeEstado: '',
  conheceVirbac: '',
  usaProdutoVirbac: '',
  qualProdutoVirbac: '',
  aceiteLgpd: true,
  aceiteComunicacoes: false,
}

describe('validateLeadForm', () => {
  it('nao acusa erro quando nome, e-mail e aceite estao preenchidos', () => {
    expect(validateLeadForm(valoresValidos)).toEqual({})
  })

  it('acusa erro em nome, e-mail e aceite quando o formulario esta vazio', () => {
    const errors = validateLeadForm({
      ...valoresValidos,
      nome: '',
      email: '',
      aceiteLgpd: false,
    })

    expect(errors).toEqual({
      nome: formContent.errorMessages.nome,
      email: formContent.errorMessages.email,
      aceiteLgpd: formContent.errorMessages.aceiteLgpd,
    })
  })

  it('recusa nome com um unico caractere e nome composto so de espacos', () => {
    expect(validateLeadForm({ ...valoresValidos, nome: 'A' }).nome).toBe(
      formContent.errorMessages.nome,
    )
    expect(validateLeadForm({ ...valoresValidos, nome: '   ' }).nome).toBe(
      formContent.errorMessages.nome,
    )
  })

  it('recusa e-mail sem dominio e nao exige campos opcionais', () => {
    const errors = validateLeadForm({ ...valoresValidos, email: 'ana@exemplo' })

    expect(errors.email).toBe(formContent.errorMessages.email)
    expect(errors.telefone).toBeUndefined()
    expect(errors.cidadeEstado).toBeUndefined()
  })
})

describe('validateField', () => {
  it('valida apenas os tres campos obrigatorios e ignora os demais', () => {
    expect(validateField('nome', { ...valoresValidos, nome: '' })).toBe(
      formContent.errorMessages.nome,
    )
    expect(validateField('email', valoresValidos)).toBeUndefined()
    expect(validateField('telefone', { ...valoresValidos, telefone: '' })).toBeUndefined()
  })
})
