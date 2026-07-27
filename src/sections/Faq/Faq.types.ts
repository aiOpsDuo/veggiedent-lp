export interface FaqItem {
  question: string
  answer: string
  isReadyForProduction: boolean
}

export interface FaqContent {
  heading: string
  items: FaqItem[]
}
