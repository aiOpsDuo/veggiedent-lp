import { MissingEnvironmentVariableError, readEnvironment } from './env'

const COMPLETE_SOURCE = {
  VITE_API_BASE_URL: 'https://cms.exemplo.test/api',
  VITE_SUPABASE_URL: 'https://projeto.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_exemplo',
}

describe('readEnvironment', () => {
  it('lê as três variáveis do painel', () => {
    expect(readEnvironment(COMPLETE_SOURCE)).toEqual({
      apiBaseUrl: 'https://cms.exemplo.test/api',
      supabaseUrl: 'https://projeto.supabase.co',
      supabasePublishableKey: 'sb_publishable_exemplo',
    })
  })

  it('usa o caminho relativo /api quando a base da API não é declarada', () => {
    const { VITE_API_BASE_URL, ...semBase } = COMPLETE_SOURCE

    expect(readEnvironment(semBase).apiBaseUrl).toBe('/api')
  })

  it.each(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])(
    'nomeia %s quando ela falta',
    (variableName) => {
      const incompleteSource = { ...COMPLETE_SOURCE, [variableName]: '' }

      expect(() => readEnvironment(incompleteSource)).toThrow(
        MissingEnvironmentVariableError,
      )
      expect(() => readEnvironment(incompleteSource)).toThrow(variableName)
    },
  )
})
