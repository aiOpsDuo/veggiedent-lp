import { describe, expect, it } from 'vitest'
import { validateField, validateLeadForm } from './validation'
import type { LeadFormErrorMessages, LeadFormValues } from '../CapturaLead.types'

// Mensagens propositalmente diferentes das que estao no CMS: se a validacao
// voltar a importar texto de algum lugar em vez de receber o que lhe dao, estes
// testes acusam.
const mensagens: LeadFormErrorMessages = {
  nome: 'Falta o nome.',
  email: 'E-mail invalido.',
  aceiteLgpd: 'Falta o consentimento.',
}

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
    expect(validateLeadForm(valoresValidos, mensagens)).toEqual({})
  })

  it('acusa erro em nome, e-mail e aceite quando o formulario esta vazio', () => {
    const errors = validateLeadForm(
      { ...valoresValidos, nome: '', email: '', aceiteLgpd: false },
      mensagens,
    )

    expect(errors).toEqual({
      nome: mensagens.nome,
      email: mensagens.email,
      aceiteLgpd: mensagens.aceiteLgpd,
    })
  })

  it('usa exatamente a mensagem recebida, sem texto proprio', () => {
    const outras: LeadFormErrorMessages = {
      nome: 'Nome, por favor.',
      email: 'E-mail, por favor.',
      aceiteLgpd: 'Consentimento, por favor.',
    }

    const errors = validateLeadForm(
      { ...valoresValidos, nome: '', email: '', aceiteLgpd: false },
      outras,
    )

    expect(errors).toEqual(outras)
  })

  it('recusa nome com um unico caractere e nome composto so de espacos', () => {
    expect(validateLeadForm({ ...valoresValidos, nome: 'A' }, mensagens).nome).toBe(mensagens.nome)
    expect(validateLeadForm({ ...valoresValidos, nome: '   ' }, mensagens).nome).toBe(
      mensagens.nome,
    )
  })

  it('recusa e-mail sem dominio e nao exige campos opcionais', () => {
    const errors = validateLeadForm({ ...valoresValidos, email: 'ana@exemplo' }, mensagens)

    expect(errors.email).toBe(mensagens.email)
    expect(errors.telefone).toBeUndefined()
    expect(errors.cidadeEstado).toBeUndefined()
  })
})

describe('validateField', () => {
  it('valida apenas os tres campos obrigatorios e ignora os demais', () => {
    expect(validateField('nome', { ...valoresValidos, nome: '' }, mensagens)).toBe(mensagens.nome)
    expect(validateField('email', valoresValidos, mensagens)).toBeUndefined()
    expect(
      validateField('telefone', { ...valoresValidos, telefone: '' }, mensagens),
    ).toBeUndefined()
  })
})
