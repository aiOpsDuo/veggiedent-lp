export interface Partner {
  nome: string
  logoUrl: string
  link: string
}

export interface OndeComprarContent {
  heading: string
  intro: string
  partners: Partner[]
}
