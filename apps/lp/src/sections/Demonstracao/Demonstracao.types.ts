export interface VideoData {
  id: string
  src: string
  captionsSrc: string
  posterSrc: string
  label: string
}

export interface VideoBannerContent {
  overline: string
  headline: string
  body: string
  ctaLabel: string
}

export interface DemonstracaoContent {
  heading: string
  intro: string
  banner: VideoBannerContent
  videos: VideoData[]
}
