export interface RoutineStepImage {
  src: string
  alt: string
}

export interface RoutineStepData {
  title: string
  body: string
  image: RoutineStepImage
}

export interface RotinaCuidadoContent {
  heading: string
  intro: string
  steps: RoutineStepData[]
}
