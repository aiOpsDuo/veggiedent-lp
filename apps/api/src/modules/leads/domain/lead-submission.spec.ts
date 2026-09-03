import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import {
  isHoneypotTriggered,
  toLeadSubmission,
  type RawLeadSubmission,
} from './lead-submission'

/**
 * A validação migrada do relay serverless (SDD § D-07: comportamento externo
 * preservado). Cada caso aqui é uma linha do `validate()` de
 * `serverless/rdstation-lead/handler.ts`, mais os três campos que o relay
 * descartava (risco R-01).
 *
 * As mensagens ganharam acentuação, que o relay não tinha; as **chaves** de
 * `fields` continuam idênticas, porque é por elas que o formulário da LP
 * encontra o campo a marcar em vermelho.
 */

const VALIDO: RawLeadSubmission = {
  nome: 'Ana Souza',
  email: 'ana@exemplo.com',
  aceite_lgpd: true,
}

function camposRecusados(raw: RawLeadSubmission): Record<string, string> {
  try {
    toLeadSubmission(raw)
  } catch (error) {
    return { ...(error as FieldValidationError).fields }
  }
  throw new Error('O envio foi aceito, e o teste esperava recusa.')
}

describe('validação do envio de lead', () => {
  it('aceita o mínimo: nome, e-mail e consentimento', () => {
    expect(toLeadSubmission(VALIDO).nome).toBe('Ana Souza')
  })

  it('recusa nome ausente', () => {
    expect(camposRecusados({ ...VALIDO, nome: undefined })).toHaveProperty('nome')
  })

  it('recusa nome só com espaços', () => {
    expect(camposRecusados({ ...VALIDO, nome: '   ' })).toHaveProperty('nome')
  })

  it('recusa e-mail sem arroba', () => {
    expect(camposRecusados({ ...VALIDO, email: 'ana.exemplo.com' })).toHaveProperty('email')
  })

  it('recusa e-mail sem domínio com ponto', () => {
    expect(camposRecusados({ ...VALIDO, email: 'ana@exemplo' })).toHaveProperty('email')
  })

  it('recusa consentimento LGPD não marcado', () => {
    expect(camposRecusados({ ...VALIDO, aceite_lgpd: false })).toHaveProperty('aceite_lgpd')
  })

  it('recusa consentimento LGPD ausente', () => {
    expect(camposRecusados({ ...VALIDO, aceite_lgpd: undefined })).toHaveProperty('aceite_lgpd')
  })

  /**
   * O consentimento é condição de envio, não campo do lead: ele é exigido e
   * depois desaparece. Se voltasse a ser carregado, voltaria a ser gravado — a
   * constante `true` em toda linha que a T18 removeu do banco
   * (SDD § "Modelo de dados").
   */
  it('não carrega o consentimento para dentro do lead', () => {
    expect(toLeadSubmission(VALIDO)).not.toHaveProperty('aceiteLgpd')
  })

  it('recusa porte fora da lista', () => {
    expect(camposRecusados({ ...VALIDO, porte_cachorro: 'gigante' })).toHaveProperty(
      'porte_cachorro',
    )
  })

  it('aceita porte ausente, que é campo opcional', () => {
    expect(toLeadSubmission(VALIDO).porteCachorro).toBeNull()
  })

  it.each(['pequeno', 'medio', 'grande'])('aceita o porte %s', (porte) => {
    expect(toLeadSubmission({ ...VALIDO, porte_cachorro: porte }).porteCachorro).toBe(porte)
  })

  it('acumula todos os erros em uma resposta só', () => {
    expect(camposRecusados({ nome: '', email: 'x', aceite_lgpd: false })).toEqual({
      nome: expect.any(String),
      email: expect.any(String),
      aceite_lgpd: expect.any(String),
    })
  })

  it('guarda os três campos que o relay antigo descartava (R-01)', () => {
    const lead = toLeadSubmission({
      ...VALIDO,
      conhece_virbac: 'sim',
      usa_produto_virbac: 'sim',
      qual_produto_virbac: 'Veggiedent',
    })

    expect(lead.conheceVirbac).toBe('sim')
    expect(lead.usaProdutoVirbac).toBe('sim')
    expect(lead.qualProdutoVirbac).toBe('Veggiedent')
  })

  it('preserva a acentuação dos textos livres', () => {
    expect(toLeadSubmission({ ...VALIDO, cidade_estado: 'São Paulo/SP' }).cidadeEstado).toBe(
      'São Paulo/SP',
    )
  })

  it('trata campo opcional em branco como ausente', () => {
    expect(toLeadSubmission({ ...VALIDO, telefone: '   ' }).telefone).toBeNull()
  })

  it('só considera aceite de comunicações quando é exatamente verdadeiro', () => {
    expect(toLeadSubmission(VALIDO).aceiteComunicacoes).toBe(false)
    expect(toLeadSubmission({ ...VALIDO, aceite_comunicacoes: true }).aceiteComunicacoes).toBe(true)
  })
})

describe('honeypot', () => {
  it('dispara com o campo preenchido', () => {
    expect(isHoneypotTriggered('http://spam.exemplo')).toBe(true)
  })

  it('não dispara com o campo ausente, que é o caso de uma pessoa', () => {
    expect(isHoneypotTriggered(undefined)).toBe(false)
  })

  it('não dispara com o campo só de espaços', () => {
    expect(isHoneypotTriggered('   ')).toBe(false)
  })
})
