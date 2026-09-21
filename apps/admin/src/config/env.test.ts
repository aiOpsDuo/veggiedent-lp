import { readEnvironment } from './env'

const COMPLETE_SOURCE = {
  VITE_API_BASE_URL: 'https://cms.exemplo.test/api',
}

describe('readEnvironment', () => {
  it('lê a base da API declarada', () => {
    expect(readEnvironment(COMPLETE_SOURCE)).toEqual({
      apiBaseUrl: 'https://cms.exemplo.test/api',
    })
  })

  it('usa o caminho relativo /api quando a base da API não é declarada', () => {
    expect(readEnvironment({}).apiBaseUrl).toBe('/api')
  })

  it('usa o caminho relativo /api quando a variável está em branco', () => {
    expect(readEnvironment({ VITE_API_BASE_URL: '   ' }).apiBaseUrl).toBe('/api')
  })
})
