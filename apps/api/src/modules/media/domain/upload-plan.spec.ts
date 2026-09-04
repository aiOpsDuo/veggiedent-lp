import { FieldValidationError } from '../../../shared/domain/field-validation.error'
import { planUpload, toSafeFilename } from './upload-plan'

const UNIQUE_ID = '0f2f5b1e-1f7a-4a1b-9a5c-8f0e2d3c4b5a'
const MEGABYTE = 1024 * 1024

function plan(contentType: string, sizeBytes: number, originalFilename = 'arquivo.bin') {
  return planUpload({ originalFilename, contentType, sizeBytes }, UNIQUE_ID)
}

describe('plano de upload', () => {
  it('leva o arquivo ao bucket da sua natureza', () => {
    expect(plan('video/mp4', 10 * MEGABYTE).policy.bucket).toBe('veggiedent-videos')
    expect(plan('image/webp', MEGABYTE).policy.bucket).toBe('veggiedent-images')
  })

  it('recusa tipo não suportado com mensagem no campo do tipo', () => {
    expect(() => plan('application/zip', 1024)).toThrow(FieldValidationError)

    try {
      plan('application/zip', 1024)
    } catch (erro) {
      expect((erro as FieldValidationError).fields.contentType).toContain(
        'Tipo de arquivo não suportado',
      )
    }
  })

  it('recusa arquivo acima do limite da sua natureza', () => {
    expect(() => plan('image/png', 10 * MEGABYTE + 1)).toThrow(FieldValidationError)
    expect(() => plan('image/png', 10 * MEGABYTE)).not.toThrow()
  })

  it('prefixa o caminho com o identificador único, para dois envios do mesmo nome não colidirem', () => {
    expect(plan('image/png', 1024, 'foto.png').path).toBe(`${UNIQUE_ID}/foto.png`)
  })
})

describe('nome de arquivo seguro para URL', () => {
  it('tira acento, espaço e maiúscula, mantendo a extensão', () => {
    expect(toSafeFilename('Cão Sorrindo NA praça.PNG')).toBe('cao-sorrindo-na-praca.png')
  })

  it('não deixa hífen nem ponto sobrando nas pontas', () => {
    expect(toSafeFilename('  ***foto***.png  ')).toBe('foto.png')
  })

  it('cai em um nome padrão quando nada sobra', () => {
    expect(toSafeFilename('***')).toBe('arquivo')
    expect(toSafeFilename('')).toBe('arquivo')
  })
})
