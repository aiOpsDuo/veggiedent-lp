import { SECTION_KEYS } from '@veggiedent/content-schema'
import {
  SnapshotError,
  defaultSnapshotPath,
  loadContentSnapshot,
  parseContentSnapshot,
  sectionKeysMissingFromSnapshot,
  snapshotSectionKeys,
} from './content-snapshot'

const DOCUMENTO = { heading: 'Título' }

describe('o instantâneo versionado no repositório', () => {
  it('é encontrado a partir deste arquivo, sem caminho combinado à mão', () => {
    expect(defaultSnapshotPath()).toMatch(
      /apps[/\\]lp[/\\]src[/\\]content[/\\]content-snapshot\.json$/,
    )
  })

  it('carrega com as 9 seções e os metadados da página', () => {
    const snapshot = loadContentSnapshot(defaultSnapshotPath())

    expect(snapshotSectionKeys(snapshot)).toEqual([...SECTION_KEYS])
    expect(snapshot.metadata).not.toBeNull()
  })
})

describe('a leitura do instantâneo', () => {
  it('devolve as seções na ordem da página, não na ordem do arquivo', () => {
    const snapshot = parseContentSnapshot({
      sections: { faq: DOCUMENTO, hero: DOCUMENTO },
      metadata: null,
    })

    expect(snapshotSectionKeys(snapshot)).toEqual(['hero', 'faq'])
  })

  it('sabe dizer quais seções o instantâneo não traz', () => {
    const snapshot = parseContentSnapshot({ sections: { hero: DOCUMENTO } })

    expect(sectionKeysMissingFromSnapshot(snapshot)).toEqual(
      SECTION_KEYS.filter((key) => key !== 'hero'),
    )
  })

  it('trata metadados ausentes como ausentes, não como documento vazio', () => {
    expect(parseContentSnapshot({ sections: { hero: DOCUMENTO } }).metadata).toBeNull()
  })

  it.each([
    ['o conteúdo não é um objeto', 'não é um objeto JSON', []],
    ['não traz sections', 'objeto `sections`', { metadata: null }],
    ['sections está vazio', 'nenhuma seção publicada', { sections: {} }],
    [
      'traz uma chave que não é seção',
      'não existem no esquema: promocao',
      { sections: { hero: DOCUMENTO, promocao: DOCUMENTO } },
    ],
    [
      'uma seção não é um documento',
      'não são documentos: hero',
      { sections: { hero: 'texto' } },
    ],
    [
      'metadata não é um documento',
      '`metadata` do instantâneo não é um documento',
      { sections: { hero: DOCUMENTO }, metadata: 'texto' },
    ],
  ])('recusa quando %s', (_caso, mensagem, conteudo) => {
    expect(() => parseContentSnapshot(conteudo)).toThrow(SnapshotError)
    expect(() => parseContentSnapshot(conteudo)).toThrow(mensagem as string)
  })

  it('recusa um arquivo que não é JSON, dizendo qual arquivo', () => {
    expect(() => loadContentSnapshot(__filename)).toThrow(/não é JSON válido/)
  })

  it('recusa um arquivo inexistente, dizendo qual arquivo', () => {
    expect(() => loadContentSnapshot('/nao/existe/instantaneo.json')).toThrow(
      /Não consegui ler o instantâneo em \/nao\/existe\/instantaneo\.json/,
    )
  })
})
