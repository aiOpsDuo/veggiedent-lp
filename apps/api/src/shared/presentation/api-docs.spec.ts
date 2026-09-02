import { shouldExposeApiDocs } from './api-docs'

describe('shouldExposeApiDocs', () => {
  it('expõe a documentação em desenvolvimento', () => {
    expect(shouldExposeApiDocs('development')).toBe(true)
  })

  it('nunca expõe a documentação em produção', () => {
    expect(shouldExposeApiDocs('production')).toBe(false)
  })
})
