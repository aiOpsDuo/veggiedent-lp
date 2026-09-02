import { extractBearerToken } from './bearer-token'

describe('extractBearerToken', () => {
  it('extrai o token do esquema Bearer', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('aceita o esquema em qualquer caixa', () => {
    expect(extractBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi')
    expect(extractBearerToken('BEARER abc.def.ghi')).toBe('abc.def.ghi')
  })

  it.each([
    ['cabeçalho ausente', undefined],
    ['cabeçalho vazio', ''],
    ['outro esquema', 'Basic abc.def.ghi'],
    ['sem esquema', 'abc.def.ghi'],
    ['esquema sem token', 'Bearer'],
    ['partes a mais', 'Bearer abc.def.ghi extra'],
    ['lista de cabeçalhos', ['Bearer abc.def.ghi']],
  ])('recusa %s', (_caso, header) => {
    expect(extractBearerToken(header)).toBeUndefined()
  })
})
