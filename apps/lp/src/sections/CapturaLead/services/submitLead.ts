// Envio do formulario de captura para a API do CMS.
//
// O lead e gravado no banco do CMS, que desde 2026-09-03 e o UNICO lugar onde
// ele existe: nao ha repasse a sistema externo, e a saida do dado e a
// exportacao em CSV feita pelo painel (SDD, RN-01 e C-11). Por isso uma
// resposta que nao seja 2xx precisa virar erro visivel aqui — engoli-la faria a
// pagina agradecer por um lead que nao foi gravado em lugar nenhum.
//
// Desde 2026-10-02 o envio leva tambem o texto do aceite LGPD que o visitante
// viu (`aceite_lgpd_texto`), gravado junto do lead como prova do consentimento.
// O instante do aceite e o endereco da politica NAO vao: quem os define e a
// API, e ela recusa um corpo que tente envia-los.
import { LGPD_CONSENT_TEXT_MAX_LENGTH } from '@veggiedent/content-schema'
import { env } from '../../../config/env'
import type { LeadFormValues } from '../CapturaLead.types'

export interface SubmitLeadResult {
  success: boolean
}

/**
 * `aceiteLgpdTexto` e o texto do aceite exatamente como aparece na tela
 * (`consentLabelText`). Vai cortado no limite que a API aceita: um rotulo longo
 * demais escrito no painel faria a API recusar todo envio, e perder o lead e
 * pior do que guardar o texto do aceite pela metade.
 */
export async function submitLead(
  values: LeadFormValues,
  aceiteLgpdTexto: string,
): Promise<SubmitLeadResult> {
  const payload = {
    nome: values.nome.trim(),
    email: values.email.trim(),
    telefone: values.telefone.trim() || undefined,
    nome_cachorro: values.nomeCachorro.trim() || undefined,
    porte_cachorro: values.porteCachorro || undefined,
    cidade_estado: values.cidadeEstado.trim() || undefined,
    conhece_virbac: values.conheceVirbac || undefined,
    usa_produto_virbac: values.usaProdutoVirbac || undefined,
    qual_produto_virbac: values.qualProdutoVirbac.trim() || undefined,
    aceite_lgpd: values.aceiteLgpd,
    aceite_lgpd_texto: aceiteLgpdTexto.trim().slice(0, LGPD_CONSENT_TEXT_MAX_LENGTH),
    aceite_comunicacoes: values.aceiteComunicacoes,
    origem: 'lp-veggiedent',
  }

  const response = await fetch(env.leadSubmitEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Falha ao enviar o lead (status ${response.status})`)
  }

  return { success: true }
}
