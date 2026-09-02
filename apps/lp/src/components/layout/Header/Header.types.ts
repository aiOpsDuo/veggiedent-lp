export interface NavLink {
  label: string
  href: string
}

export interface HeaderContent {
  logoAlt: string
  navLinks: NavLink[]
  ctaDesktopLabel: string
  ctaMobileLabel: string
  menuButtonAriaLabel: string
  mainNavAriaLabel: string
}
