export type PorteCachorro = "pequeno" | "medio" | "grande";

export type SimNao = "sim" | "nao";

export interface LeadFormValues {
  nome: string;
  email: string;
  telefone: string;
  nomeCachorro: string;

  // Mantém por enquanto para não quebrar o formulário existente
  porteCachorro: PorteCachorro | "";

  cidadeEstado: string;

  // Novos campos solicitados pela cliente
  conheceVirbac: SimNao | "";
  usaProdutoVirbac: SimNao | "";
  qualProdutoVirbac: string;

  aceiteLgpd: boolean;
  aceiteComunicacoes: boolean;
}

export type LeadFormFieldName = keyof LeadFormValues;

export type LeadFormErrors = Partial<Record<LeadFormFieldName, string>>;

export type LeadFormStatus =
  | "idle"
  | "validating"
  | "submitting"
  | "success"
  | "error";

export interface CapturaLeadContent {
  heading: string;
  body: string;
  ebookTitlePlaceholder: string | null;
}
