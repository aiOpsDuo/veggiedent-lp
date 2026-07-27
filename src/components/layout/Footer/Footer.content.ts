// Fonte: Copy Deck v2.0, secao 13. Nenhum texto de link/legal vive no JSX.
import type { FooterContent } from './Footer.types'

export const footerContent: FooterContent = {
  logoAlt: 'Veggiedent, por Virbac',
  links: [
    { label: 'Política de privacidade', href: '/politica-de-privacidade' },
    { label: 'Termos de uso', href: '/termos-de-uso' },
    { label: 'Fale conosco', href: '/fale-conosco' },
  ],
  claimSource:
    '*Pesquisa IPSOS 2026. Fonte: Pesquisa Ipsos 2026. Realizada com 1.116 veterinários, base de dados Virbac. Acesse: https://br.virbac.com/home/veggie.html',
  speciesDisclaimer: 'Produto indicado exclusivamente para cães.',
  // [BLOQUEADO] CNPJ e demais dados legais da Virbac Brasil pendentes — nao publicar
  // texto de placeholder visivel; manter null ate o dado real chegar (ver secao 6.12).
  legalDataPlaceholder: null,
  copyright: '© 2026 Virbac. Todos os direitos reservados.',
}
