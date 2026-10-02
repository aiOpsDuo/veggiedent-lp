/**
 * O consentimento com a Política de Privacidade (LGPD), no que a LP e a API
 * precisam concordar — por isso mora neste pacote, que as duas já importam.
 *
 * Não é conteúdo do CMS de propósito: o endereço da política é a prova do
 * **que** o visitante aceitou, e a API o grava em cada lead
 * (`leads.aceite_lgpd_politica_url`). Se ele fosse editável no painel, ou se a
 * LP o enviasse, o registro passaria a dizer o que o navegador quisesse.
 * Pedido do cliente de 2026-10-02 (ver `agent_context/CHANGELOG.md`).
 */

/**
 * A Política de Privacidade da Virbac Brasil: é a seção "Política de
 * privacidade" desta página de aviso legal. Usada pelo link do aceite no
 * formulário, pelo rodapé e pelo registro do consentimento no banco.
 */
export const PRIVACY_POLICY_URL = 'https://br.virbac.com/home/legal-notice.html'

/**
 * Tamanho máximo do texto do aceite que o visitante viu, gravado junto do lead
 * (`leads.aceite_lgpd_texto`, `VARCHAR(500)`). A API recusa o que passar disso;
 * a LP corta antes de enviar, para que um rótulo longo escrito no painel nunca
 * custe o lead.
 */
export const LGPD_CONSENT_TEXT_MAX_LENGTH = 500
