import { describe, expect, it } from 'vitest'
import { SECTION_KEYS, altTextFieldName } from '../src/contract'
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
    'a imagem $index de $section$list tem texto alternativo obrigatório adjacente',
    ({ fields, index }) => {
      const image = fields[index]
      const adjacent = fields[index + 1]

      expect(adjacent?.name).toBe(altTextFieldName(image.name))
      expect(adjacent?.type).toBe('texto-curto')
      expect(adjacent?.required).toBe(image.required)
    },
  )

  it('toda imagem das 12 seções é obrigatória, e o texto alternativo também', () => {
    const imagesInSections = findImageFields().filter((location) => location.section !== 'site_metadata')

    for (const { fields, index } of imagesInSections) {
      expect(fields[index].required).toBe(true)
      expect(fields[index + 1].required).toBe(true)
    }
  })

  it('acusa uma imagem declarada sem texto alternativo adjacente', () => {
    const violations = checkSchemaInvariants({
      key: 'exemplo',
      fields: [
        { name: 'foto', type: 'imagem', label: 'Foto', required: true },
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
        { name: 'foto', type: 'imagem', label: 'Foto', required: true },
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
          itemFields: [{ name: 'foto', type: 'imagem', label: 'Foto', required: true }],
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
