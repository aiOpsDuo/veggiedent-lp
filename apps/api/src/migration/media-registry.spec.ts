import { extname } from 'node:path'
import { getSectionSchema } from '@veggiedent/content-schema'
import { ACCEPTED_MIME_TYPES } from '../modules/media/domain/media-kind'
import { loadLandingPageContent } from './content-source'
import { contentTypeOf, mediaValuesByAddress, referencedFiles } from './media-registry'
import { buildSectionDocuments } from './section-documents'

/**
 * O casamento entre arquivo do repositório e mídia registrada — a peça de que
 * depende a idempotência da migração (PLAN.md § T9).
 */

const drafts = buildSectionDocuments(loadLandingPageContent())

describe('tipo de arquivo deduzido da extensão', () => {
  it.each(referencedFiles(drafts))(
    'sabe qual é o tipo de %s, e é um tipo que os buckets aceitam',
    (filePath) => {
      expect(ACCEPTED_MIME_TYPES).toContain(contentTypeOf(filePath))
    },
  )

  it('recusa uma extensão que não sabe traduzir, em vez de chutar um tipo', () => {
    expect(() => contentTypeOf('/tmp/planilha.xlsx')).toThrow(/planilha\.xlsx/)
  })

  it('reconhece o SVG do logo como imagem', () => {
    expect(contentTypeOf('/tmp/logo.SVG')).toBe('image/svg+xml')
  })
})

/**
 * O endereço do campo é a chave que liga uma execução da migração à seguinte:
 * `hero.image` sempre vem do mesmo arquivo, e é por isso que a segunda execução
 * consegue reaproveitar a mídia da primeira sem consultar o armazenamento.
 */
describe('endereço de cada campo de mídia', () => {
  it('indexa campo de topo pelo nome e campo de item pela posição na lista', () => {
    const enderecos = [...mediaValuesByAddress(getSectionSchema('demonstracao'), drafts.demonstracao).keys()]

    expect(enderecos).toEqual([
      'videos[0].video',
      'videos[0].poster',
      'videos[1].video',
      'videos[1].poster',
    ])
  })

  it('não inventa endereço para lista ausente do documento', () => {
    expect(mediaValuesByAddress(getSectionSchema('faq'), { heading: 'Só o título' }).size).toBe(0)
  })
})

describe('arquivos referenciados pelos 12 documentos', () => {
  const arquivos = referencedFiles(drafts)

  it('conta o mesmo arquivo uma vez só, ainda que dois campos o usem', () => {
    expect(new Set(arquivos).size).toBe(arquivos.length)
  })

  it('inclui os dois vídeos e o logo em SVG', () => {
    const extensoes = arquivos.map((file) => extname(file).toLowerCase())

    expect(extensoes.filter((extensao) => extensao === '.mp4')).toHaveLength(2)
    expect(extensoes).toContain('.svg')
  })
})
