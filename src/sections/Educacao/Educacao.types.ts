export interface EducationalCardImage {
  src: string
  alt: string
}

export interface EducationalCardData {
  title: string
  body: string
  image: EducationalCardImage
}

export interface EducacaoContent {
  heading: string
  intro: string
  cards: EducationalCardData[]
}
