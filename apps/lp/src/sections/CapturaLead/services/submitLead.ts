// Envio do formulario de captura para a API do CMS.
//
// O lead e gravado no banco do CMS, que desde 2026-09-03 e o UNICO lugar onde
// ele existe: nao ha repasse a sistema externo, e a saida do dado e a
// exportacao em CSV feita pelo painel (SDD, RN-01 e C-11). Por isso uma
// resposta que nao seja 2xx precisa virar erro visivel aqui — engoli-la faria a
// pagina agradecer por um lead que nao foi gravado em lugar nenhum.
import { env } from '../../../config/env'
import type { LeadFormValues } from '../CapturaLead.types'

export interface SubmitLeadResult {
  success: boolean
}

export async function submitLead(values: LeadFormValues): Promise<SubmitLeadResult> {
  const payload = {
    nome: values.nome.trim(),
    email: values.email.trim(),
    telefone: values.telefone.trim() || undefined,
    nome_cachorro: values.nomeCachorro.trim() || undefined,
    porte_cachorro: values.porteCachorro || undefined,
    cidade_estado: values.cidadeEstado.trim() || undefined,
    aceite_lgpd: values.aceiteLgpd,
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
