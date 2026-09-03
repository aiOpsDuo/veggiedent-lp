import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { CmsApi } from '../src/migration/cms-api'
import {
  loadLandingPageContent,
  publicAssetPath,
  type LandingPageContent,
} from '../src/migration/content-source'
import type { LocalFile, MediaUploader } from '../src/migration/media-uploader'
import { migrateContent, type MigrationReport } from '../src/migration/migrate-content'
import type { UploadCredentialView } from '../src/modules/media/application/media-view'
import { startContentHarness, type ContentHarness } from './content-harness'

/**
 * A carga inicial do CMS, de ponta a ponta (PLAN.md § T9).
 *
 * A migração roda contra a aplicação **inteira** — mesmos controllers, mesma
 * guarda, mesma validação de esquema, mesmos repositórios —, só com o banco e o
 * armazenamento substituídos por dublês em memória. É o mesmo caminho que a
 * execução real percorre; o que muda é onde os bytes param.
 *
 * O que esta suíte prende, em ordem de importância:
 *
 * 1. **`GET /api/content` devolve o conteúdo dos `*.content.ts`, campo a campo.**
 *    A comparação é escrita à mão, a partir dos arquivos de conteúdo — não
 *    reaproveita `buildSectionDocuments`. Um teste que usasse a tradução de
 *    produção como referência provaria apenas que ela é consistente consigo
 *    mesma.
 * 2. **Nenhum espaço reservado chega ao visitante** (SDD § C-08): a seção de
 *    Ingredientes e a pergunta sem resposta confirmada não aparecem.
 * 3. **Rodar duas vezes não duplica nada** — provado por contagem antes e
 *    depois da segunda execução, e pela resposta idêntica.
 */

jest.setTimeout(60_000)

/**
 * As 11 seções que a LP recebe. `ingredientes` é a décima segunda e está fora de
 * propósito: ela nasce não publicada, porque o material técnico da Virbac ainda
 * não chegou (SDD § C-08).
 */
const SECOES_PUBLICADAS = [
  'header',
  'hero',
  'educacao',
  'rotina',
  'produto',
  'demonstracao',
  'prova_autoridade',
  'captura_lead',
  'onde_comprar',
  'faq',
  'footer',
] as const

/**
 * O papel do navegador no passo 2 de D-05, aqui feito pelo processo da migração.
 * Não lê os bytes do arquivo: o dublê de armazenamento guarda tamanho e tipo, e
 * é só isso que a confirmação do upload consulta. Ler 24 MB de vídeo do disco
 * para descartá-los tornaria a suíte lenta sem verificar nada a mais.
 */
class UploaderParaOArmazenamentoDeTeste implements MediaUploader {
  constructor(private readonly harness: ContentHarness) {}

  async upload(credential: UploadCredentialView, file: LocalFile): Promise<void> {
    const { size } = await stat(file.path)
    this.harness.database.storage.uploadWithCredential(
      credential.token,
      credential.bucket,
      credential.path,
      { sizeBytes: size, mimeType: file.contentType },
    )
  }
}

interface ItemPublicado {
  readonly visivel: boolean
  readonly ordem: number
  readonly [campo: string]: unknown
}

type Documento = Record<string, unknown>

interface ConteudoPublicado {
  readonly sections: Record<string, Documento>
  readonly metadata: Documento | null
}

describe('migração do conteúdo atual para o CMS', () => {
  const content = loadLandingPageContent()

  let harness: ContentHarness
  let api: CmsApi
  let report: MigrationReport

  beforeAll(async () => {
    harness = await startContentHarness()
    await harness.app.listen(0)
    api = new CmsApi({
      baseUrl: `${await harness.app.getUrl()}/api`,
      accessToken: harness.token,
    })
    report = await executarMigracao()
  })

  afterAll(async () => {
    await harness.close()
  })

  const executarMigracao = (): Promise<MigrationReport> =>
    migrateContent({
      api,
      uploader: new UploaderParaOArmazenamentoDeTeste(harness),
      content,
    })

  const lerConteudoPublicado = async (): Promise<ConteudoPublicado> => {
    const response = await fetch(`${await harness.app.getUrl()}/api/content`)
    expect(response.status).toBe(200)
    return (await response.json()) as ConteudoPublicado
  }

  /** A URL pública da mídia que a migração criou para um arquivo do repositório. */
  const urlDe = (filePath: string): string => {
    const mediaId = report.mediaIdsByFile.get(filePath)
    const row = harness.database
      .rows('media_assets')
      .find((media) => media.id === mediaId)

    expect(row).toBeDefined()
    return row?.public_url as string
  }

  const urlDoVideo = (publicUrl: string): string => urlDe(publicAssetPath(content, publicUrl))

  describe('o conteúdo servido à LP', () => {
    let publicado: ConteudoPublicado

    beforeAll(async () => {
      publicado = await lerConteudoPublicado()
    })

    it.each(SECOES_PUBLICADAS)(
      'a seção %s chega campo a campo como está no arquivo de conteúdo',
      (key) => {
        const esperado = documentosEsperados(content, urlDe, urlDoVideo)[key]

        expect(publicado.sections[key]).toEqual(comTextosAparados(esperado))
      },
    )

    it('serve as 11 seções publicadas, e nenhuma a mais', () => {
      expect(Object.keys(publicado.sections).sort()).toEqual([...SECOES_PUBLICADAS].sort())
    })

    it('os metadados da página vêm do index.html, sem imagem de compartilhamento', () => {
      expect(publicado.metadata).toEqual({
        title: content.metadata.title,
        description: content.metadata.description,
        canonicalUrl: content.metadata.canonicalUrl,
      })
    })

    it('preserva a acentuação na ida e na volta', () => {
      expect(publicado.sections.produto.heading).toBe(content.produto.heading.trim())
      expect(String(publicado.sections.captura_lead.lgpdLabel)).toContain('Política')
    })
  })

  describe('nada de espaço reservado chega ao visitante', () => {
    let publicado: ConteudoPublicado

    beforeAll(async () => {
      publicado = await lerConteudoPublicado()
    })

    it('a seção de Ingredientes não é servida', () => {
      expect('ingredientes' in publicado.sections).toBe(false)
    })

    it('mas o conteúdo dela continua guardado, só não publicado', async () => {
      const secao = await api.getSection('ingredientes')

      expect(secao.isPublished).toBe(false)
      expect(secao.data.heading).toBe(content.ingredientes.heading.trim())
    })

    it('a pergunta sem resposta confirmada não é servida', () => {
      const perguntas = (publicado.sections.faq.items as ItemPublicado[]).map(
        (item) => item.question,
      )

      expect(perguntas).not.toContain('A partir de que idade posso oferecer Veggiedent®?')
    })

    it('mas ela continua guardada, com o texto inteiro, para o operador substituir', async () => {
      const secao = await api.getSection('faq')
      const naoPublicadas = (secao.data.items as ItemPublicado[]).filter(
        (item) => !item.visivel,
      )

      expect(naoPublicadas.map((item) => item.question)).toEqual([
        'A partir de que idade posso oferecer Veggiedent®?',
        'Onde posso comprar Veggiedent?',
      ])
    })

    it('nenhum texto servido contém a marca de espaço reservado', () => {
      expect(JSON.stringify(publicado)).not.toContain('PLACEHOLDER')
    })
  })

  /**
   * A prova de idempotência é por **contagem antes e depois**, não por "não deu
   * erro": rodar de novo poderia enviar as mesmas mídias outra vez sem falhar,
   * deixando cópias órfãs no armazenamento e registros duplicados.
   */
  describe('rodar a migração uma segunda vez', () => {
    interface Contagens {
      readonly midias: number
      readonly arquivosNoArmazenamento: number
      readonly credenciaisEmitidas: number
      readonly secoes: number
      readonly itensDeLista: number
    }

    const contar = (): Contagens => ({
      midias: harness.database.rows('media_assets').length,
      arquivosNoArmazenamento: harness.database.storage.storedPaths.length,
      credenciaisEmitidas: harness.database.storage.issuedCredentials.length,
      secoes: harness.database.rows('content_sections').length,
      itensDeLista: harness.database
        .rows('content_sections')
        .flatMap((secao) => Object.values(secao.data as Documento))
        .filter(Array.isArray)
        .reduce((total, lista) => total + lista.length, 0),
    })

    let antes: Contagens
    let depois: Contagens
    let conteudoAntes: ConteudoPublicado
    let conteudoDepois: ConteudoPublicado
    let segundoRelatorio: MigrationReport

    beforeAll(async () => {
      antes = contar()
      conteudoAntes = await lerConteudoPublicado()
      segundoRelatorio = await executarMigracao()
      depois = contar()
      conteudoDepois = await lerConteudoPublicado()
    })

    it('não duplica mídia, arquivo, seção nem item de lista', () => {
      expect(depois).toEqual(antes)
    })

    it('não emite credencial de upload nenhuma: reaproveita as mídias já registradas', () => {
      expect(segundoRelatorio.uploadedMedia).toEqual([])
      expect(segundoRelatorio.reusedMedia).toHaveLength(antes.midias)
    })

    it('cada arquivo continua apontando para a mesma mídia', () => {
      expect([...segundoRelatorio.mediaIdsByFile]).toEqual([...report.mediaIdsByFile])
    })

    it('a LP recebe exatamente a mesma resposta', () => {
      expect(conteudoDepois).toEqual(conteudoAntes)
    })

    it('Ingredientes continua não publicada — republicar não é efeito de rodar de novo', () => {
      expect(conteudoDepois.sections.ingredientes).toBeUndefined()
    })
  })

  describe('as mídias registradas', () => {
    it('registra uma mídia por arquivo distinto, com o nome original preservado', () => {
      const nomes = harness.database
        .rows('media_assets')
        .map((media) => media.original_filename)

      expect(nomes.sort()).toEqual(
        [...report.mediaIdsByFile.keys()].map((file) => basename(file)).sort(),
      )
    })

    it('o logo usado no cabeçalho e no rodapé é uma mídia só', () => {
      expect(publicadoLogo('header')).toBe(publicadoLogo('footer'))
    })

    it('o logo sobe como SVG, sem ser convertido para bitmap', () => {
      const logo = harness.database
        .rows('media_assets')
        .find((media) => String(media.original_filename).endsWith('.svg'))

      expect(logo?.mime_type).toBe('image/svg+xml')
      expect(logo?.kind).toBe('image')
    })

    it('os dois vídeos entram no bucket de vídeo', () => {
      const videos = harness.database
        .rows('media_assets')
        .filter((media) => media.kind === 'video')

      expect(videos).toHaveLength(content.demonstracao.videos.length)
      expect(
        videos.every((media) => String(media.storage_path).length > 0),
      ).toBe(true)
    })

    function publicadoLogo(secao: 'header' | 'footer'): unknown {
      const documento = harness.database
        .rows('content_sections')
        .find((linha) => linha.key === secao)?.data as Documento

      return documento.logo
    }
  })
})

/**
 * Os textos passam por `trim()` na validação do esquema — é o esquema que decide
 * a forma do que é gravado, e ele apara espaço em volta de todo texto. O valor
 * esperado é escrito com o texto do arquivo e aparado aqui, em vez de o teste
 * comparar textos "quase iguais".
 */
function comTextosAparados<T>(valor: T): T {
  if (typeof valor === 'string') {
    return valor.trim() as T
  }
  if (Array.isArray(valor)) {
    return valor.map(comTextosAparados) as T
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
        chave,
        comTextosAparados(item),
      ]),
    ) as T
  }
  return valor
}

function comOrdem<T extends object>(itens: readonly T[]): ItemPublicado[] {
  return itens.map((item, ordem) => ({ ...item, visivel: true, ordem }) as ItemPublicado)
}

function textos(valores: readonly string[]): ItemPublicado[] {
  return comOrdem(valores.map((texto) => ({ texto })))
}

/**
 * Posição, na lista guardada, das perguntas que a LP recebe. O índice 1 é a
 * pergunta cuja resposta ainda é um espaço reservado e o índice 5 é a pergunta
 * que hoje está comentada no arquivo — as duas ficam guardadas e não publicadas,
 * então as publicadas mantêm a posição original, com buracos.
 */
const ORDEM_DAS_PERGUNTAS_PUBLICADAS = [0, 2, 3, 4, 6]

/**
 * O conteúdo que `GET /api/content` deve devolver, escrito a partir dos
 * arquivos de conteúdo. Ingredientes não está aqui: não é publicada.
 */
function documentosEsperados(
  content: LandingPageContent,
  urlDe: (filePath: string) => string,
  urlDoVideo: (publicUrl: string) => string,
): Record<string, Documento> {
  const form = content.form

  return {
    header: {
      logo: urlDe(content.componentImages.headerLogo),
      logoAlt: content.header.logoAlt,
      ctaDesktopLabel: content.header.ctaDesktopLabel,
      ctaMobileLabel: content.header.ctaMobileLabel,
      menuButtonAriaLabel: content.header.menuButtonAriaLabel,
      mainNavAriaLabel: content.header.mainNavAriaLabel,
      navLinks: comOrdem(
        content.header.navLinks.map((link) => ({ label: link.label, href: link.href })),
      ),
    },
    hero: {
      overline: content.hero.overline,
      headline: content.hero.headline,
      subheadline: content.hero.subheadline,
      ctaPrimaryLabel: content.hero.ctaPrimaryLabel,
      ctaSecondaryLabel: content.hero.ctaSecondaryLabel,
      image: urlDe(content.componentImages.heroImage),
      imageAlt: content.hero.imageAlt,
    },
    educacao: {
      heading: content.educacao.heading,
      intro: content.educacao.intro,
      researchHighlight: content.educacao.researchHighlight,
      cards: comOrdem(
        content.educacao.cards.map((card) => ({
          title: card.title,
          body: card.body,
          image: urlDe(card.image.src),
          imageAlt: card.image.alt,
        })),
      ),
    },
    rotina: {
      heading: content.rotina.heading,
      intro: content.rotina.intro,
      steps: comOrdem(
        content.rotina.steps.map((step) => ({
          title: step.title,
          body: step.body,
          image: urlDe(step.image.src),
          imageAlt: step.image.alt,
        })),
      ),
    },
    produto: {
      heading: content.produto.heading,
      ctaLabel: content.produto.ctaLabel,
      packshot: urlDe(content.componentImages.produtoPackshot),
      packshotAlt: content.produto.packshotAlt,
      body: textos(content.produto.body),
      benefits: textos(content.produto.benefits),
    },
    demonstracao: {
      heading: content.demonstracao.heading,
      intro: content.demonstracao.intro,
      bannerOverline: content.demonstracao.banner.overline,
      bannerHeadline: content.demonstracao.banner.headline,
      bannerBody: content.demonstracao.banner.body,
      bannerCtaLabel: content.demonstracao.banner.ctaLabel,
      videos: comOrdem(
        content.demonstracao.videos.map((video) => ({
          label: video.label,
          video: urlDoVideo(video.src),
          poster: urlDoVideo(video.posterSrc),
          posterAlt: video.label,
        })),
      ),
    },
    prova_autoridade: {
      heading: content.provaAutoridade.heading,
      source: content.provaAutoridade.source,
      kit: urlDe(content.componentImages.provaAutoridadeKit),
      kitAlt: 'Veggiedent, selo número 1 e recomendação veterinária',
      stats: comOrdem(
        content.provaAutoridade.stats.map((item) => ({
          stat: item.stat,
          label: item.label,
        })),
      ),
    },
    captura_lead: {
      heading: content.capturaLead.heading,
      body: content.capturaLead.body,
      formNomeLabel: form.fields.nome.label,
      formNomePlaceholder: form.fields.nome.placeholder,
      formEmailLabel: form.fields.email.label,
      formEmailPlaceholder: form.fields.email.placeholder,
      formTelefoneLabel: form.fields.telefone.label,
      formTelefonePlaceholder: form.fields.telefone.placeholder,
      formNomeCachorroLabel: form.fields.nomeCachorro.label,
      formNomeCachorroPlaceholder: form.fields.nomeCachorro.placeholder,
      formPorteCachorroLabel: form.fields.porteCachorro.label,
      formPorteCachorroPlaceholder: form.fields.porteCachorro.placeholder,
      formCidadeEstadoLabel: form.fields.cidadeEstado.label,
      formCidadeEstadoPlaceholder: form.fields.cidadeEstado.placeholder,
      formConheceVirbacLabel: form.fields.conheceVirbac.label,
      formConheceVirbacPlaceholder: form.fields.conheceVirbac.placeholder,
      formUsaProdutoVirbacLabel: form.fields.usaProdutoVirbac.label,
      formUsaProdutoVirbacPlaceholder: form.fields.usaProdutoVirbac.placeholder,
      formQualProdutoVirbacLabel: form.fields.qualProdutoVirbac.label,
      formQualProdutoVirbacPlaceholder: form.fields.qualProdutoVirbac.placeholder,
      lgpdLabel: form.lgpdLabel,
      optInLabel: form.optInLabel,
      submitLabel: form.submitLabel,
      submitLoadingLabel: form.submitLoadingLabel,
      errorNome: form.errorMessages.nome,
      errorEmail: form.errorMessages.email,
      errorAceiteLgpd: form.errorMessages.aceiteLgpd,
      successModalTitle: form.successModal.title,
      successModalBody: form.successModal.body,
      successModalDownloadCtaLabel: form.successModal.downloadCtaLabel,
      successModalEmailModeMessage: form.successModal.emailModeMessage,
      successModalCloseAriaLabel: form.successModal.closeAriaLabel,
      errorToastMessage: form.errorToastMessage,
      porteOptions: comOrdem(
        form.porteOptions.map((option) => ({ value: option.value, label: option.label })),
      ),
      simNaoOptions: comOrdem(
        form.simNaoOptions.map((option) => ({ value: option.value, label: option.label })),
      ),
      mosaico: comOrdem(content.mosaicPhotos.map((photo) => ({ image: urlDe(photo) }))),
    },
    onde_comprar: {
      heading: content.ondeComprar.heading,
      intro: content.ondeComprar.intro,
      partners: comOrdem(
        content.ondeComprar.partners.map((partner) => ({
          nome: partner.nome,
          logo: urlDe(partner.logoUrl),
          logoAlt: partner.nome,
          link: partner.link,
        })),
      ),
    },
    faq: {
      heading: content.faq.heading,
      items: content.faq.items
        .filter((item) => item.isReadyForProduction)
        .map((item, indice) => ({
          question: item.question,
          answer: item.answer,
          visivel: true,
          ordem: ORDEM_DAS_PERGUNTAS_PUBLICADAS[indice],
        })),
    },
    footer: {
      logo: urlDe(content.componentImages.footerLogo),
      logoAlt: content.footer.logoAlt,
      claimSource: content.footer.claimSource,
      speciesDisclaimer: content.footer.speciesDisclaimer,
      copyright: content.footer.copyright,
      links: comOrdem(
        content.footer.links.map((link) => ({ label: link.label, href: link.href })),
      ),
    },
  }
}
