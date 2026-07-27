export type PorteCachorro = 'pequeno' | 'medio' | 'grande'

export interface LeadFormValues {
  nome: string
  email: string
  telefone: string
  nomeCachorro: string
  porteCachorro: PorteCachorro | ''
  cidadeEstado: string
  aceiteLgpd: boolean
  aceiteComunicacoes: boolean
}

export type LeadFormFieldName = keyof LeadFormValues

export type LeadFormErrors = Partial<Record<LeadFormFieldName, string>>

export type LeadFormStatus = 'idle' | 'validating' | 'submitting' | 'success' | 'error'

export interface CapturaLeadContent {
  heading: string
  body: string
  ebookTitlePlaceholder: string | null
}
