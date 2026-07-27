// Tipos compartilhados do relay de leads — nao depende de nenhuma plataforma
// especifica de hospedagem (Vercel/Netlify/Cloudflare). Ver README.md.

export interface LeadRelayRequestBody {
  nome: string
  email: string
  telefone?: string
  nome_cachorro?: string
  porte_cachorro?: 'pequeno' | 'medio' | 'grande'
  cidade_estado?: string
  aceite_lgpd: boolean
  aceite_comunicacoes: boolean
  origem: string
  // Campo honeypot: deve chegar vazio. Se vier preenchido, a submissao e de
  // um bot e deve ser descartada silenciosamente (ver handler.ts).
  website?: string
}

export interface NormalizedRequest {
  method: string
  origin: string | null
  body: unknown
}

export interface NormalizedResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export interface RelaySuccessBody {
  success: true
}

export interface RelayErrorBody {
  success: false
  error: string
  fields?: Record<string, string>
}
