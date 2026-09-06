/**
 * Os tipos do formulário de captura de lead.
 *
 * O conteúdo da seção (rótulos, mensagens, opções) vem do CMS e é tipado a
 * partir do esquema — ver `content/published-content.ts`. O que sobra aqui é o
 * **estado do formulário**, que é do componente e não do conteúdo.
 *
 * `porteCachorro`, `conheceVirbac` e `usaProdutoVirbac` são `string` porque a
 * API os recebe como texto livre (`submit-lead.dto.ts`). Os valores que o
 * formulário pode produzir estão fechados em código, em `PORTE_OPTIONS` e
 * `SIM_NAO_OPTIONS` (`@veggiedent/content-schema`) — o CMS edita só o texto de
 * cada opção, nunca o código gravado no lead (T25).
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

/**
 * Uma opção do formulário como o componente a renderiza: o valor vem de
 * `PORTE_OPTIONS`/`SIM_NAO_OPTIONS`, em código; o rótulo vem do CMS.
 */
export interface FormOptionView {
  readonly value: string;
  readonly label: string;
}
