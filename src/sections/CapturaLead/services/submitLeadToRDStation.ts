// Integracao com RD Station Marketing — Especificacao Funcional, secao 8.5.
//
// O front-end NUNCA chama a API do RD Station diretamente e nunca guarda a
// credencial privada. Este servico so faz um POST para um endpoint proprio
// (funcao serverless — Vercel/Netlify Function ou Cloudflare Worker), que e
// quem efetivamente conversa com o RD Station usando um token de ambiente
// do lado do servidor. Sem banco de dados proprio e sem processo de
// exportacao manual — o RD Station Marketing e o unico sistema de registro
// do lead.
import { env } from '../../../config/env'
import type { LeadFormValues } from '../CapturaLead.types'

export interface SubmitLeadResult {
  success: boolean
}

export async function submitLeadToRDStation(values: LeadFormValues): Promise<SubmitLeadResult> {
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
    throw new Error(`Falha ao enviar lead ao RD Station (status ${response.status})`)
  }

  return { success: true }
}
