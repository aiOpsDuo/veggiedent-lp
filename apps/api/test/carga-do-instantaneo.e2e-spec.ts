import {
  SECTION_KEYS,
  getSectionSchema,
  siteMetadataSchema,
  type SectionKey,
} from '@veggiedent/content-schema'
import { CmsApi, CmsApiError } from '../src/migration/cms-api'
import {
  defaultSnapshotPath,
  loadContentSnapshot,
  parseContentSnapshot,
  snapshotSections,
  type ContentSnapshot,
} from '../src/migration/content-snapshot'
import type {
  MediaBytes,
  MediaUploader,
  SnapshotMediaSource,
  TargetStorage,
} from '../src/migration/media-transfer'
import { parsePublicObjectUrl } from '../src/migration/public-object-url'
import { referencedUrls, type DocumentPair } from '../src/migration/media-reconciliation'
import {
  loadSnapshotIntoCms,
  type SnapshotLoadReport,
} from '../src/migration/seed-from-snapshot'
import type { UploadCredentialView } from '../src/modules/media/application/media-view'
import { startContentHarness, type ContentHarness } from './content-harness'

/**
 * A carga do CMS a partir do instantâneo, de ponta a ponta (PLAN.md § T23).
 *
 * A carga roda contra a aplicação **inteira** — mesmos controllers, mesma
 * guarda, mesma validação de esquema, mesmos repositórios —, só com o banco e o
 * armazenamento substituídos por dublês em memória. É o mesmo caminho que a
 * execução real percorre; o que muda é onde os bytes param.
 *
 * O que esta suíte prende, em ordem de importância:
 *
 * 1. **Um CMS vazio termina servindo o instantâneo, campo a campo.** A
 *    comparação é contra o arquivo versionado, com as URLs de mídia trocadas
 *    pelas do ambiente de destino — não contra o que a carga acha que gravou.
 * 2. **Rodar duas vezes não duplica nada**, provado por contagem antes e depois
 *    e por comparação campo a campo com as chaves normalizadas. Igualdade de
 *    corpo servido não serve como prova: a consulta de seções não tem
 *    `ORDER BY`.
 * 3. **Nenhum caminho de gravação escapa da validação de esquema.**
 */

jest.setTimeout(120_000)

const TAMANHO_SINTETICO = 2048

/** URLs de mídia do instantâneo, na mesma ordem em que a carga as encontra. */
function urlsDoInstantaneo(snapshot: ContentSnapshot): string[] {
  const pares: DocumentPair[] = snapshotSections(snapshot).map(([key, documento]) => ({
    scope: key,
    schema: getSectionSchema(key),
    snapshot: documento,
    stored: {},
  }))
  if (snapshot.metadata !== null) {
    pares.push({
      scope: 'site_metadata',
      schema: siteMetadataSchema,
      snapshot: snapshot.metadata,
      stored: {},
    })
  }
  return referencedUrls(pares)
}

/**
 * O papel do projeto Supabase de origem: entrega os bytes da URL pública que o
 * instantâneo guardou. Os bytes são sintéticos porque nada nesta suíte os
 * inspeciona — o dublê de armazenamento guarda tamanho e tipo, e é isso que a
 * confirmação do upload consulta. Baixar 30 MB de vídeo de verdade tornaria a
 * suíte lenta e dependente de rede sem verificar nada a mais.
 */
class FonteDeMidiaSintetica implements SnapshotMediaSource {
  readonly baixadas: string[] = []

  async download(publicUrl: string): Promise<ArrayBuffer> {
    this.baixadas.push(publicUrl)
    return new ArrayBuffer(TAMANHO_SINTETICO)
  }
}

/** O papel do navegador no passo 2 de D-05, aqui feito pelo processo da carga. */
class UploaderParaOArmazenamentoDeTeste implements MediaUploader {
  constructor(private readonly harness: ContentHarness) {}

  async upload(credential: UploadCredentialView, file: MediaBytes): Promise<void> {
    this.harness.database.storage.uploadWithCredential(
      credential.token,
      credential.bucket,
      credential.path,
      { sizeBytes: file.bytes.byteLength, mimeType: file.contentType },
    )
  }
}

/** O armazenamento do ambiente de destino, consultado pela URL pública. */
class ArmazenamentoDeDestinoDeTeste implements TargetStorage {
  constructor(private readonly harness: ContentHarness) {}

  async hasObject(bucket: string, objectPath: string): Promise<boolean> {
    return this.harness.database.storage.find(bucket, objectPath) !== undefined
  }
}

type Documento = Record<string, unknown>

interface ConteudoPublicado {
  readonly sections: Record<string, Documento>
  readonly metadata: Documento | null
}

interface Contagens {
  readonly midias: number
  readonly arquivosNoArmazenamento: number
  readonly credenciaisEmitidas: number
  readonly secoes: number
  readonly itensDeLista: number
  readonly registrosDeMetadados: number
}

/**
 * O conteúdo servido achatado em uma lista ordenada de `caminho = valor`.
 *
 * É a forma de comparação exigida pela T23: um hash do corpo é prova fraca,
 * porque a ordem das chaves de `sections` pode mudar sem o conteúdo mudar — a
 * consulta não tem `ORDER BY`. Achatar e ordenar normaliza a ordem das chaves e
 * **preserva** a ordem dos itens de lista, que é conteúdo de verdade.
 */
function achatar(valor: unknown, caminho = ''): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((item, indice) => achatar(item, `${caminho}[${indice}]`))
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.entries(valor as Documento)
      .flatMap(([chave, item]) => achatar(item, caminho === '' ? chave : `${caminho}.${chave}`))
      .sort()
  }
  return [`${caminho} = ${JSON.stringify(valor)}`]
}

interface Ambiente {
  readonly harness: ContentHarness
  readonly api: CmsApi
  readonly fonte: FonteDeMidiaSintetica
  carregar(snapshot: ContentSnapshot): Promise<SnapshotLoadReport>
  lerConteudoPublicado(): Promise<ConteudoPublicado>
  contar(): Contagens
  urlPublicaDa(mediaId: string): string
  caminhoDeArmazenamentoDe(mediaId: string): string
  fechar(): Promise<void>
}

async function abrirAmbiente(): Promise<Ambiente> {
  const harness = await startContentHarness()
  await harness.app.listen(0)
  const raiz = await harness.app.getUrl()
  const api = new CmsApi({ baseUrl: `${raiz}/api`, accessToken: harness.token })
  const fonte = new FonteDeMidiaSintetica()

  const linhaDaMidia = (mediaId: string): Documento => {
    const linha = harness.database.rows('media_assets').find((media) => media.id === mediaId)
    expect(linha).toBeDefined()
    return linha as Documento
  }

  return {
    harness,
    api,
    fonte,
    carregar: (snapshot) =>
      loadSnapshotIntoCms({
        api,
        source: fonte,
        uploader: new UploaderParaOArmazenamentoDeTeste(harness),
        targetStorage: new ArmazenamentoDeDestinoDeTeste(harness),
        snapshot,
      }),
    lerConteudoPublicado: async () => {
      const resposta = await fetch(`${raiz}/api/content`)
      expect(resposta.status).toBe(200)
      return (await resposta.json()) as ConteudoPublicado
    },
    contar: () => ({
      midias: harness.database.rows('media_assets').length,
      arquivosNoArmazenamento: harness.database.storage.storedPaths.length,
      credenciaisEmitidas: harness.database.storage.issuedCredentials.length,
      secoes: harness.database.rows('content_sections').length,
      itensDeLista: harness.database
        .rows('content_sections')
        .flatMap((secao) => Object.values(secao.data as Documento))
        .filter(Array.isArray)
        .reduce((total, lista) => total + lista.length, 0),
      registrosDeMetadados: harness.database.rows('site_metadata').length,
    }),
    urlPublicaDa: (mediaId) => linhaDaMidia(mediaId).public_url as string,
    caminhoDeArmazenamentoDe: (mediaId) => linhaDaMidia(mediaId).storage_path as string,
    fechar: () => harness.close(),
  }
}

/**
 * O instantâneo como ele ficaria depois de semeado: mesmo conteúdo, com cada
 * URL de mídia trocada pela do ambiente de destino. É o que a LP tem de
 * receber, e é contra isto que a comparação campo a campo acontece.
 */
function comAsUrlsDoDestino(
  valor: unknown,
  urlPorUrlDoInstantaneo: ReadonlyMap<string, string>,
): unknown {
  if (Array.isArray(valor)) {
    return valor.map((item) => comAsUrlsDoDestino(item, urlPorUrlDoInstantaneo))
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(
      Object.entries(valor as Documento).map(([chave, item]) => [
        chave,
        comAsUrlsDoDestino(item, urlPorUrlDoInstantaneo),
      ]),
    )
  }
  return typeof valor === 'string' ? (urlPorUrlDoInstantaneo.get(valor) ?? valor) : valor
}

const instantaneo = loadContentSnapshot(defaultSnapshotPath())

describe('a carga do instantâneo contra um CMS vazio', () => {
  let ambiente: Ambiente
  let relatorio: SnapshotLoadReport
  let publicado: ConteudoPublicado
  let esperado: ConteudoPublicado
  let antes: Contagens

  beforeAll(async () => {
    ambiente = await abrirAmbiente()
    antes = ambiente.contar()
    relatorio = await ambiente.carregar(instantaneo)
    publicado = await ambiente.lerConteudoPublicado()

    const urls = new Map(
      relatorio.media.map((entrada) => [
        entrada.publicUrl,
        ambiente.urlPublicaDa(entrada.mediaId),
      ]),
    )
    esperado = comAsUrlsDoDestino(instantaneo, urls) as ConteudoPublicado
  })

  afterAll(async () => {
    await ambiente.fechar()
  })

  it('parte de um CMS de fato vazio: nenhuma seção, mídia ou metadado', () => {
    expect(antes).toEqual({
      midias: 0,
      arquivosNoArmazenamento: 0,
      credenciaisEmitidas: 0,
      secoes: 0,
      itensDeLista: 0,
      registrosDeMetadados: 0,
    })
  })

  it('envia as 21 mídias do instantâneo, uma por arquivo distinto', () => {
    expect(relatorio.media).toHaveLength(21)
    expect(relatorio.media.every((entrada) => entrada.origin === 'enviada-nesta-execucao')).toBe(
      true,
    )
    expect(ambiente.contar().midias).toBe(21)
  })

  it('baixa cada arquivo da URL que o instantâneo guardou, uma vez só', () => {
    expect([...ambiente.fonte.baixadas].sort()).toEqual([...urlsDoInstantaneo(instantaneo)].sort())
  })

  it('grava as 9 seções e todas nascem publicadas, porque salvar publica', async () => {
    expect(relatorio.savedSections).toEqual([...SECTION_KEYS])

    for (const key of SECTION_KEYS) {
      expect((await ambiente.api.getSection(key)).isPublished).toBe(true)
    }
  })

  it('não desliga nenhuma seção: o instantâneo traz todas as 9', () => {
    expect(relatorio.unpublishedSections).toEqual([])
  })

  it.each([...SECTION_KEYS])(
    'a seção %s chega à LP campo a campo como está no instantâneo',
    (key) => {
      expect(publicado.sections[key]).toEqual(esperado.sections[key])
    },
  )

  it('serve as 9 seções do instantâneo, e nenhuma a mais', () => {
    expect(Object.keys(publicado.sections).sort()).toEqual([...SECTION_KEYS].sort())
  })

  it('grava os metadados da página como estão no instantâneo', () => {
    expect(publicado.metadata).toEqual(esperado.metadata)
    expect(relatorio.metadataTitle).toBe(instantaneo.metadata?.title)
  })

  it('nenhum campo de mídia servido continua apontando para o projeto de origem', () => {
    expect(JSON.stringify(publicado)).not.toContain('wkcioegorxdvqtrzapem')
  })

  it('preserva a acentuação e o texto rico na ida e na volta', () => {
    expect(String(publicado.sections.captura_lead.lgpdLabel)).toContain('Política')
    expect(String(publicado.sections.prova_autoridade.heading)).toContain(
      '<strong>médicos-veterinários,</strong>',
    )
  })
})

/**
 * A prova de idempotência é por **contagem antes e depois** e por comparação
 * campo a campo, não por "não deu erro": rodar de novo poderia enviar as mesmas
 * mídias outra vez sem falhar, deixando cópias órfãs no armazenamento e
 * registros duplicados.
 */
describe('rodar a carga uma segunda vez, contra o CMS que ela mesma populou', () => {
  let ambiente: Ambiente
  let primeiro: SnapshotLoadReport
  let segundo: SnapshotLoadReport
  let antes: Contagens
  let depois: Contagens
  let conteudoAntes: string[]
  let conteudoDepois: string[]

  beforeAll(async () => {
    ambiente = await abrirAmbiente()
    primeiro = await ambiente.carregar(instantaneo)
    antes = ambiente.contar()
    conteudoAntes = achatar(await ambiente.lerConteudoPublicado())
    segundo = await ambiente.carregar(instantaneo)
    depois = ambiente.contar()
    conteudoDepois = achatar(await ambiente.lerConteudoPublicado())
  })

  afterAll(async () => {
    await ambiente.fechar()
  })

  it('não duplica mídia, arquivo, credencial, seção nem item de lista', () => {
    expect(depois).toEqual(antes)
  })

  it('não envia nenhum byte na segunda execução', () => {
    expect(ambiente.fonte.baixadas).toHaveLength(antes.midias)
  })

  it('reaproveita cada mídia pelo endereço do campo no documento já gravado', () => {
    expect(segundo.media.map((entrada) => entrada.origin)).toEqual(
      segundo.media.map(() => 'documento-gravado'),
    )
  })

  it('cada URL do instantâneo continua apontando para a mesma mídia', () => {
    expect(segundo.media).toEqual(primeiro.media.map((entrada) => ({ ...entrada, origin: 'documento-gravado' })))
  })

  it('a LP recebe o mesmo conteúdo, campo a campo, com as chaves normalizadas', () => {
    expect(conteudoDepois).toEqual(conteudoAntes)
  })
})

describe('a carga contra um projeto cujas tabelas foram zeradas e os arquivos ficaram', () => {
  let ambiente: Ambiente
  let relatorio: SnapshotLoadReport
  let credenciaisAntes: number

  beforeAll(async () => {
    ambiente = await abrirAmbiente()

    for (const url of urlsDoInstantaneo(instantaneo)) {
      const local = parsePublicObjectUrl(url)
      expect(local).not.toBeNull()
      const { bucket, objectPath } = local as NonNullable<typeof local>
      const token = ambiente.harness.database.storage.issueCredential(bucket, objectPath)
      ambiente.harness.database.storage.uploadWithCredential(token, bucket, objectPath, {
        sizeBytes: TAMANHO_SINTETICO,
        mimeType: bucket.endsWith('videos') ? 'video/mp4' : 'image/png',
      })
    }

    credenciaisAntes = ambiente.contar().credenciaisEmitidas
    relatorio = await ambiente.carregar(instantaneo)
  })

  afterAll(async () => {
    await ambiente.fechar()
  })

  it('reaproveita o registro do próprio caminho de armazenamento, sem mover byte nenhum', () => {
    expect(relatorio.media.map((entrada) => entrada.origin)).toEqual(
      relatorio.media.map(() => 'registro-existente'),
    )
    expect(ambiente.fonte.baixadas).toEqual([])
  })

  it('não emite credencial de upload nenhuma', () => {
    expect(ambiente.contar().credenciaisEmitidas).toBe(credenciaisAntes)
  })

  it('registra cada mídia no caminho que o instantâneo já apontava', () => {
    for (const entrada of relatorio.media) {
      const local = parsePublicObjectUrl(entrada.publicUrl) as NonNullable<
        ReturnType<typeof parsePublicObjectUrl>
      >
      expect(ambiente.caminhoDeArmazenamentoDe(entrada.mediaId)).toBe(
        `${local.bucket}/${local.objectPath}`,
      )
    }
  })

  it('não duplica arquivo no armazenamento', () => {
    expect(ambiente.contar().arquivosNoArmazenamento).toBe(21)
  })
})

describe('uma seção que o instantâneo não traz', () => {
  let ambiente: Ambiente
  let relatorio: SnapshotLoadReport
  let publicado: ConteudoPublicado

  const semFaq = parseContentSnapshot({
    sections: Object.fromEntries(
      Object.entries(instantaneo.sections).filter(([key]) => key !== 'faq'),
    ),
    metadata: instantaneo.metadata,
  })

  beforeAll(async () => {
    ambiente = await abrirAmbiente()
    ambiente.harness.database.seed('content_sections', [
      {
        key: 'faq',
        data: instantaneo.sections.faq as Documento,
        is_published: true,
        updated_at: '2026-09-01T00:00:00.000Z',
        updated_by: null,
      },
    ])
    relatorio = await ambiente.carregar(semFaq)
    publicado = await ambiente.lerConteudoPublicado()
  })

  afterAll(async () => {
    await ambiente.fechar()
  })

  it('termina desligada, que é o estado em que o instantâneo a encontrou', () => {
    expect(relatorio.unpublishedSections).toEqual(['faq'])
    expect(publicado.sections.faq).toBeUndefined()
  })

  it('mas o conteúdo dela continua guardado, sem ser tocado', async () => {
    const guardada = await ambiente.api.getSection('faq')

    expect(guardada.isPublished).toBe(false)
    expect(guardada.data).toEqual(instantaneo.sections.faq)
  })

  it('não é gravada nem publicada por acidente', () => {
    expect(relatorio.savedSections).not.toContain('faq')
  })
})

describe('um documento gravado que aponta para outro arquivo no mesmo campo', () => {
  const OUTRA_MIDIA = '11111111-2222-4333-8444-555555555555'
  let ambiente: Ambiente
  let relatorio: SnapshotLoadReport

  beforeAll(async () => {
    ambiente = await abrirAmbiente()
    ambiente.harness.database.seed('media_assets', [
      {
        id: OUTRA_MIDIA,
        kind: 'image',
        storage_path: 'veggiedent-images/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/outra-imagem.png',
        public_url:
          'https://projeto-de-teste.supabase.co/storage/v1/object/public/veggiedent-images/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/outra-imagem.png',
        mime_type: 'image/png',
        size_bytes: TAMANHO_SINTETICO,
        original_filename: 'outra-imagem.png',
        width: null,
        height: null,
        duration_seconds: null,
        created_at: '2026-09-01T00:00:00.000Z',
      },
    ])
    ambiente.harness.database.seed('content_sections', [
      {
        key: 'hero',
        data: { ...(instantaneo.sections.hero as Documento), image: OUTRA_MIDIA },
        is_published: true,
        updated_at: '2026-09-01T00:00:00.000Z',
        updated_by: null,
      },
    ])

    relatorio = await ambiente.carregar(instantaneo)
  })

  afterAll(async () => {
    await ambiente.fechar()
  })

  /**
   * O endereço do campo é a chave que liga duas execuções, mas ele sozinho
   * mentiria aqui: `hero.image` já está ocupado por outro arquivo. A guarda
   * pelo nome do arquivo é o que faz a carga enviar a mídia do instantâneo em
   * vez de semear, em silêncio, a que já estava no lugar.
   */
  it('não é reaproveitado: a mídia do instantâneo é enviada', () => {
    const hero = relatorio.media.find(
      (entrada) => entrada.publicUrl === instantaneo.sections.hero?.image,
    )

    expect(hero?.origin).toBe('enviada-nesta-execucao')
    expect(hero?.mediaId).not.toBe(OUTRA_MIDIA)
  })

  it('a LP passa a receber a imagem do instantâneo, não a que estava gravada', async () => {
    const publicado = await ambiente.lerConteudoPublicado()

    expect(publicado.sections.hero.image).not.toContain('outra-imagem.png')
    expect(String(publicado.sections.hero.image)).toContain('virbac-kv-hero.png')
  })
})

describe('a validação de esquema, que nenhum caminho de gravação contorna', () => {
  let ambiente: Ambiente

  beforeAll(async () => {
    ambiente = await abrirAmbiente()
  })

  afterAll(async () => {
    await ambiente.fechar()
  })

  it('recusa com 422 e erro por campo um instantâneo com campo obrigatório vazio', async () => {
    const semTitulo = parseContentSnapshot({
      sections: { hero: { ...(instantaneo.sections.hero as Documento), headline: '' } },
      metadata: null,
    })

    await expect(ambiente.carregar(semTitulo)).rejects.toThrow(CmsApiError)

    try {
      await ambiente.carregar(semTitulo)
    } catch (erro) {
      expect((erro as CmsApiError).status).toBe(422)
      expect((erro as CmsApiError).body).toContain('hero.headline')
    }
  })

  it('não deixa a seção recusada gravada pela metade', () => {
    expect(ambiente.harness.database.rows('content_sections')).toEqual([])
  })

  it('recusa um instantâneo com chave que não é seção, antes de tocar no banco', () => {
    expect(() =>
      parseContentSnapshot({ sections: { promocao: { heading: 'x' } }, metadata: null }),
    ).toThrow(/não existem no esquema: promocao/)
  })
})
