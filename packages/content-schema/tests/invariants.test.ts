import { describe, expect, it } from 'vitest'
import { SECTION_KEYS, altTextFieldName, isDecorativeImage } from '../src/contract'
import type { FieldSpec, SectionKey } from '../src/contract'
import { checkSchemaInvariants } from '../src/invariants'
import { sectionSchemas } from '../src/sections'
import { siteMetadataSchema } from '../src/site-metadata'

interface ImageFieldLocation {
  readonly section: SectionKey | 'site_metadata'
  readonly list?: string
  readonly fields: readonly FieldSpec[]
  readonly index: number
}

function findImageFields(): ImageFieldLocation[] {
  const schemas = [...SECTION_KEYS.map((key) => sectionSchemas[key]), siteMetadataSchema]
  const found: ImageFieldLocation[] = []

  for (const schema of schemas) {
    schema.fields.forEach((field, index) => {
      if (field.type === 'imagem') {
        found.push({ section: schema.key as SectionKey, fields: schema.fields, index })
      }
    })
    for (const list of schema.lists) {
      list.itemFields.forEach((field, index) => {
        if (field.type === 'imagem') {
          found.push({ section: schema.key as SectionKey, list: list.name, fields: list.itemFields, index })
        }
      })
    }
  }

  return found
}

/**
 * A única imagem opcional das 12 seções, e por quê: o fundo do banner da
 * Demonstração é **vídeo ou imagem**, à escolha de quem edita o conteúdo. Exigir
 * a imagem obrigaria a enviar as duas coisas para usar uma só. Toda outra imagem
 * do CMS continua obrigatória — sem ela fica um buraco no layout, e é essa a
 * regra que o teste abaixo prende.
 */
const IMAGEM_COM_ALTERNATIVA = 'demonstracao.bannerImage'

function isAlternativeToAnotherField({ section, fields, index }: ImageFieldLocation): boolean {
  return `${section}.${fields[index].name}` === IMAGEM_COM_ALTERNATIVA
}

describe('invariantes do esquema de seção', () => {
  it('percorre as 12 seções e não encontra nenhuma violação', () => {
    const violations = SECTION_KEYS.flatMap((key) => checkSchemaInvariants(sectionSchemas[key]))
    expect(violations).toEqual([])
  })

  it('não encontra violação nos metadados da página', () => {
    expect(checkSchemaInvariants(siteMetadataSchema)).toEqual([])
  })

  it('encontra ao menos um campo de imagem para verificar', () => {
    expect(findImageFields().length).toBeGreaterThan(0)
  })

  it.each(findImageFields())(
    'a imagem $index de $section (lista: $list) declara se é informativa ou decorativa',
    ({ fields, index }) => {
      expect(fields[index].imageRole).toBeDefined()
    },
  )

  it.each(findImageFields().filter(({ fields, index }) => !isDecorativeImage(fields[index])))(
    'a imagem informativa $index de $section (lista: $list) tem texto alternativo obrigatório adjacente',
    ({ fields, index }) => {
      const image = fields[index]
      const adjacent = fields[index + 1]

      expect(adjacent?.name).toBe(altTextFieldName(image.name))
      expect(adjacent?.type).toBe('texto-curto')
      expect(adjacent?.required).toBe(image.required)
    },
  )

  it.each(findImageFields().filter(({ fields, index }) => isDecorativeImage(fields[index])))(
    'a imagem decorativa $index de $section (lista: $list) não tem campo de descrição a preencher',
    ({ fields, index }) => {
      const nomeDoAlternativo = altTextFieldName(fields[index].name)

      expect(fields.some((field) => field.name === nomeDoAlternativo)).toBe(false)
    },
  )

  it('toda imagem das 12 seções é obrigatória, e o texto alternativo também', () => {
    const imagesInSections = findImageFields().filter(
      (location) => location.section !== 'site_metadata' && !isAlternativeToAnotherField(location),
    )

    for (const { fields, index } of imagesInSections) {
      expect(fields[index].required).toBe(true)
      if (!isDecorativeImage(fields[index])) {
        expect(fields[index + 1].required).toBe(true)
      }
    }
  })

  it('a imagem do banner é a única opcional, porque o vídeo do banner ocupa o mesmo lugar', () => {
    const opcionais = findImageFields()
      .filter((location) => location.section !== 'site_metadata')
      .filter(({ fields, index }) => !fields[index].required)
      .map(({ section, fields, index }) => `${section}.${fields[index].name}`)

    expect(opcionais).toEqual([IMAGEM_COM_ALTERNATIVA])
  })

  it('acusa uma imagem que não escolheu entre informativa e decorativa', () => {
    const violations = checkSchemaInvariants({
      key: 'exemplo',
      fields: [
        { name: 'foto', type: 'imagem', label: 'Foto', required: true },
        { name: 'fotoAlt', type: 'texto-curto', label: 'Texto alternativo', required: true },
      ],
      lists: [],
    })

    expect(violations).toEqual([
      'exemplo: o campo de imagem "foto" não declara se é informativa ou decorativa.',
    ])
  })

  it('acusa uma imagem decorativa com campo de texto alternativo ao lado', () => {
    const violations = checkSchemaInvariants({
      key: 'exemplo',
      fields: [
        { name: 'foto', type: 'imagem', label: 'Foto', required: true, imageRole: 'decorativa' },
        { name: 'fotoAlt', type: 'texto-curto', label: 'Texto alternativo', required: true },
      ],
      lists: [],
    })

    expect(violations).toEqual([
      'exemplo: a imagem decorativa "foto" não pode ter o campo "fotoAlt" — imagem decorativa entra com texto alternativo vazio e escondida de leitores de tela.',
    ])
  })

  it('aceita uma imagem decorativa declarada sem texto alternativo', () => {
    const violations = checkSchemaInvariants({
      key: 'exemplo',
      fields: [{ name: 'foto', type: 'imagem', label: 'Foto', required: true, imageRole: 'decorativa' }],
      lists: [],
    })

    expect(violations).toEqual([])
  })

  it('acusa uma imagem informativa declarada sem texto alternativo adjacente', () => {
    const violations = checkSchemaInvariants({
      key: 'exemplo',
      fields: [
        { name: 'foto', type: 'imagem', label: 'Foto', required: true, imageRole: 'informativa' },
        { name: 'titulo', type: 'texto-curto', label: 'Título', required: true },
      ],
      lists: [],
    })

    expect(violations).toEqual(['exemplo: o campo de imagem "foto" não tem "fotoAlt" no campo seguinte.'])
  })

  it('acusa um texto alternativo menos obrigatório que a imagem que acompanha', () => {
    const violations = checkSchemaInvariants({
      key: 'exemplo',
      fields: [
        { name: 'foto', type: 'imagem', label: 'Foto', required: true, imageRole: 'informativa' },
        { name: 'fotoAlt', type: 'texto-curto', label: 'Texto alternativo', required: false },
      ],
      lists: [],
    })

    expect(violations).toEqual([
      'exemplo: "fotoAlt" precisa ter a mesma obrigatoriedade da imagem "foto".',
    ])
  })

  it('acusa uma imagem sem texto alternativo dentro de uma lista', () => {
    const violations = checkSchemaInvariants({
      key: 'exemplo',
      fields: [],
      lists: [
        {
          name: 'cards',
          label: 'Cards',
          reorderable: true,
          itemFields: [
            { name: 'foto', type: 'imagem', label: 'Foto', required: true, imageRole: 'informativa' },
          ],
        },
      ],
    })

    expect(violations).toEqual([
      'exemplo.cards: o campo de imagem "foto" não tem "fotoAlt" no campo seguinte.',
    ])
  })

  it('acusa um item de lista que tenta redefinir visibilidade ou ordenação', () => {
    const violations = checkSchemaInvariants({
      key: 'exemplo',
      fields: [],
      lists: [
        {
          name: 'cards',
          label: 'Cards',
          reorderable: true,
          itemFields: [{ name: 'ordem', type: 'texto-curto', label: 'Ordem', required: true }],
        },
      ],
    })

    expect(violations).toEqual(['exemplo.cards: "ordem" é reservado para visibilidade e ordenação do item.'])
  })
})
