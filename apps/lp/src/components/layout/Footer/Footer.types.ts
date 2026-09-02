export interface FooterLink {
  label: string
  href: string
}

export interface FooterContent {
  logoAlt: string
  links: FooterLink[]
  claimSource: string
  speciesDisclaimer: string
  legalDataPlaceholder: string | null // null enquanto o CNPJ/dados legais nao chegarem (ver Notas Tecnicas v2.0)
  copyright: string
}
