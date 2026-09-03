/**
 * Os tipos do formulário de captura de lead.
 *
 * O conteúdo da seção (rótulos, mensagens, opções) vem do CMS e é tipado a
 * partir do esquema — ver `content/published-content.ts`. O que sobra aqui é o
 * **estado do formulário**, que é do componente e não do conteúdo.
 *
 * `porteCachorro`, `conheceVirbac` e `usaProdutoVirbac` são `string` e não mais
 * uniões fechadas: os valores dessas opções passaram a ser cadastrados no CMS
 * (listas `porteOptions` e `simNaoOptions`), então prendê-los a um literal no
 * código seria uma promessa que o conteúdo pode desmentir. A API recebe os três
 * como texto livre (`submit-lead.dto.ts`), então nada se perde na fronteira.
 */
export interface LeadFormValues {
  nome: string;
  email: string;
  telefone: string;
  nomeCachorro: string;
  porteCachorro: string;
  cidadeEstado: string;
  conheceVirbac: string;
  usaProdutoVirbac: string;
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

/**
 * As mensagens de erro do formulário, como vêm do CMS.
 *
 * A validação as recebe em vez de importá-las: as regras (o que é um nome
 * válido) são do código, e o texto que o visitante lê é do conteúdo. Manter as
 * duas coisas no mesmo módulo faria a validação depender do CMS para existir.
 */
export interface LeadFormErrorMessages {
  readonly nome: string;
  readonly email: string;
  readonly aceiteLgpd: string;
}
