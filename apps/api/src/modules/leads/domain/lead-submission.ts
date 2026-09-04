import { FieldValidationError } from '../../../shared/domain/field-validation.error'

/**
 * O envio do formulário da LP, já validado (SDD § C-11).
 *
 * As regras são as que o relay serverless aposentado já aplicava: nome não
 * vazio, e-mail com forma de e-mail, consentimento LGPD marcado e porte dentro
 * da lista. O comportamento externo foi preservado, inclusive as chaves de
 * `fields` na resposta de erro, que continuam em `snake_case` porque é assim que
 * o formulário as envia.
 *
 * O que **mudou** em relação a ele são os três campos do fim: `conheceVirbac`,
 * `usaProdutoVirbac` e `qualProdutoVirbac`, que o relay descartava — o risco
 * R-01 do SDD.
 *
 * **O consentimento LGPD é condição de envio, não campo do lead.** Ele chega em
 * `RawLeadSubmission`, é exigido aqui e some: `LeadSubmission` não o carrega e o
 * banco não o guarda. Persisti-lo significaria gravar a constante `true` em toda
 * linha, porque sem ele nenhuma linha nasce — informação zero (SDD § "Modelo de
 * dados"; `agent_context/CHANGELOG.md`, 2026-09-02).
 */

export const PORTES_DE_CACHORRO = ['pequeno', 'medio', 'grande'] as const

export type PorteDeCachorro = (typeof PORTES_DE_CACHORRO)[number]

export interface LeadSubmission {
  readonly nome: string
  readonly email: string
  readonly telefone: string | null
  readonly nomeCachorro: string | null
  readonly porteCachorro: PorteDeCachorro | null
  readonly cidadeEstado: string | null
  readonly conheceVirbac: string | null
  readonly usaProdutoVirbac: string | null
  readonly qualProdutoVirbac: string | null
  readonly aceiteComunicacoes: boolean
  readonly origem: string | null
}

/** O corpo como chega do formulário, antes de qualquer regra ser aplicada. */
export interface RawLeadSubmission {
  readonly nome?: string
  readonly email?: string
  readonly telefone?: string
  readonly nome_cachorro?: string
  readonly porte_cachorro?: string
  readonly cidade_estado?: string
  readonly conhece_virbac?: string
  readonly usa_produto_virbac?: string
  readonly qual_produto_virbac?: string
  readonly aceite_lgpd?: boolean
  readonly aceite_comunicacoes?: boolean
  readonly origem?: string
  /** Honeypot: ver `isHoneypotTriggered`. */
  readonly website?: string
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MENSAGENS = {
  nome: 'Nome é obrigatório.',
  email: 'E-mail inválido.',
  aceite_lgpd: 'Consentimento LGPD é obrigatório.',
  porte_cachorro: 'Valor inválido.',
} as const

/**
 * Campo invisível no formulário real: quem preenche é um robô.
 *
 * Quem aciona o honeypot recebe **sucesso** e nada é gravado — responder com
 * erro ensinaria ao robô que o campo existe.
 */
export function isHoneypotTriggered(website: string | undefined): boolean {
  return typeof website === 'string' && website.trim().length > 0
}

function isPorteDeCachorro(candidato: string): candidato is PorteDeCachorro {
  return (PORTES_DE_CACHORRO as readonly string[]).includes(candidato)
}

/** Texto opcional: em branco e ausente são a mesma coisa, e viram `null`. */
function opcional(valor: string | undefined): string | null {
  const limpo = valor?.trim() ?? ''
  return limpo.length > 0 ? limpo : null
}

function erros(raw: RawLeadSubmission): Record<string, string> {
  const encontrados: Record<string, string> = {}

  if (opcional(raw.nome) === null) {
    encontrados.nome = MENSAGENS.nome
  }
  if (!raw.email || !EMAIL_FORMAT.test(raw.email)) {
    encontrados.email = MENSAGENS.email
  }
  if (raw.aceite_lgpd !== true) {
    encontrados.aceite_lgpd = MENSAGENS.aceite_lgpd
  }
  const porte = opcional(raw.porte_cachorro)
  if (porte !== null && !isPorteDeCachorro(porte)) {
    encontrados.porte_cachorro = MENSAGENS.porte_cachorro
  }

  return encontrados
}

/**
 * Valida o envio e devolve o lead pronto para ser gravado. Recusa com
 * `FieldValidationError`, que a apresentação traduz para `422` com os erros por
 * campo — o mesmo formato único de erro do resto da API.
 */
export function toLeadSubmission(raw: RawLeadSubmission): LeadSubmission {
  const encontrados = erros(raw)
  if (Object.keys(encontrados).length > 0) {
    throw new FieldValidationError(encontrados)
  }

  const porte = opcional(raw.porte_cachorro)
  return {
    nome: (raw.nome as string).trim(),
    email: (raw.email as string).trim(),
    telefone: opcional(raw.telefone),
    nomeCachorro: opcional(raw.nome_cachorro),
    porteCachorro: porte === null ? null : (porte as PorteDeCachorro),
    cidadeEstado: opcional(raw.cidade_estado),
    conheceVirbac: opcional(raw.conhece_virbac),
    usaProdutoVirbac: opcional(raw.usa_produto_virbac),
    qualProdutoVirbac: opcional(raw.qual_produto_virbac),
    aceiteComunicacoes: raw.aceite_comunicacoes === true,
    origem: opcional(raw.origem),
  }
}
