import { LGPD_CONSENT_TEXT_MAX_LENGTH, PRIVACY_POLICY_URL } from '@veggiedent/content-schema'
import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import {
  isHoneypotTriggered,
  toLeadSubmission,
  type RawLeadSubmission,
} from './lead-submission'

/**
 * A validação herdada do relay serverless aposentado, com o comportamento
 * externo preservado: cada caso aqui é uma linha do `validate()` dele, mais os
 * três campos que ele descartava (risco R-01).
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
   * Desde 2026-10-02 o consentimento é também registro (pedido do cliente): o
   * lead carrega o aceite, o texto que o visitante viu e o endereço da
   * política. O endereço é do servidor — vem de `@veggiedent/content-schema`,
   * a mesma constante dos links da LP —, nunca do corpo da requisição.
   */
  describe('registro do consentimento LGPD', () => {
    it('carrega o aceite e o endereço da política para dentro do lead', () => {
      expect(toLeadSubmission(VALIDO)).toMatchObject({
        aceiteLgpd: true,
        aceiteLgpdPoliticaUrl: PRIVACY_POLICY_URL,
      })
    })

    it('guarda o texto do aceite sem os espaços das bordas', () => {
      expect(
        toLeadSubmission({ ...VALIDO, aceite_lgpd_texto: '  Li e aceito a Política.  ' })
          .aceiteLgpdTexto,
      ).toBe('Li e aceito a Política.')
    })

    it('sem texto enviado, o texto fica nulo e o envio continua aceito', () => {
      expect(toLeadSubmission(VALIDO).aceiteLgpdTexto).toBeNull()
      expect(toLeadSubmission({ ...VALIDO, aceite_lgpd_texto: '   ' }).aceiteLgpdTexto).toBeNull()
    })

    it(`aceita texto com exatamente ${LGPD_CONSENT_TEXT_MAX_LENGTH} caracteres`, () => {
      const limite = 'a'.repeat(LGPD_CONSENT_TEXT_MAX_LENGTH)
      expect(toLeadSubmission({ ...VALIDO, aceite_lgpd_texto: limite }).aceiteLgpdTexto).toBe(
        limite,
      )
    })

    it('mede o limite depois de aparar as bordas', () => {
      const comBordas = `  ${'a'.repeat(LGPD_CONSENT_TEXT_MAX_LENGTH)}  `
      expect(toLeadSubmission({ ...VALIDO, aceite_lgpd_texto: comBordas }).aceiteLgpdTexto).toHaveLength(
        LGPD_CONSENT_TEXT_MAX_LENGTH,
      )
    })

    it(`recusa texto com mais de ${LGPD_CONSENT_TEXT_MAX_LENGTH} caracteres`, () => {
      expect(
        camposRecusados({
          ...VALIDO,
          aceite_lgpd_texto: 'a'.repeat(LGPD_CONSENT_TEXT_MAX_LENGTH + 1),
        }),
      ).toEqual({ aceite_lgpd_texto: expect.stringContaining(`${LGPD_CONSENT_TEXT_MAX_LENGTH}`) })
    })
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
