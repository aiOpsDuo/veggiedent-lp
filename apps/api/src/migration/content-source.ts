import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import * as ts from 'typescript'

/**
 * Leitura do conteúdo que hoje vive em código: os 12 arquivos `*.content.ts` da
 * landing page e os metadados declarados em `apps/lp/index.html`.
 *
 * Os arquivos são a fonte, e não uma cópia deles: a migração da T9 os executa
 * de verdade, em vez de repetir seus textos aqui. Repetir seria criar uma
 * segunda verdade que envelheceria em silêncio no dia em que alguém corrigisse
 * uma vírgula do Copy Deck.
 *
 * Eles importam imagens e vídeos como módulos (o Vite devolve a URL do arquivo
 * empacotado). Fora do Vite não existe esse carregador, então o `require` deste
 * módulo devolve o **caminho absoluto** do arquivo no disco — que é justamente
 * o que a migração precisa para enviar os bytes ao armazenamento.
 */

/** Extensões que o Vite trata como asset e entrega como URL, não como módulo. */
const ASSET_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.avif',
  '.gif',
  '.mp4',
  '.webm',
  '.vtt',
]

const REPOSITORY_MARKER = 'apps/lp/index.html'

/**
 * Sobe do diretório deste módulo até achar a raiz do repositório. Vale tanto
 * para `src/migration` (testes) quanto para `dist/migration` (execução), sem
 * que nenhum dos dois precise saber a profundidade do outro.
 */
export function findRepositoryRoot(startDirectory: string = __dirname): string {
  let directory = startDirectory
  while (!existsSync(resolve(directory, REPOSITORY_MARKER))) {
    const parent = dirname(directory)
    if (parent === directory) {
      throw new Error(
        `Raiz do repositório não encontrada a partir de ${startDirectory}: nenhum diretório acima contém ${REPOSITORY_MARKER}.`,
      )
    }
    directory = parent
  }
  return directory
}

function isAssetImport(specifier: string): boolean {
  return ASSET_EXTENSIONS.includes(extname(specifier).toLowerCase())
}

/**
 * Executa um módulo TypeScript do repositório e devolve o que ele exporta.
 *
 * O `Function` é o que dá ao módulo transpilado o `exports`/`require`/`module`
 * que ele espera. É código do próprio repositório, lido do disco pelo mesmo
 * processo que já poderia lê-lo de qualquer outra forma — não há entrada
 * externa aqui.
 */
function loadModule(filePath: string): Record<string, unknown> {
  const javaScript = ts.transpileModule(readFileSync(filePath, 'utf8'), {
    fileName: filePath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText

  const moduleShell = { exports: {} as Record<string, unknown> }
  const requireFromFile = (specifier: string): unknown =>
    isAssetImport(specifier)
      ? { __esModule: true, default: resolve(dirname(filePath), specifier) }
      : {}

  const run = new Function('exports', 'require', 'module', '__filename', '__dirname', javaScript)
  run(moduleShell.exports, requireFromFile, moduleShell, filePath, dirname(filePath))

  return moduleShell.exports
}

/** Uma imagem como os arquivos de hoje a declaram: caminho e texto alternativo. */
export interface ContentImage {
  readonly src: string
  readonly alt: string
}

export interface HeaderContentFile {
  readonly logoAlt: string
  readonly navLinks: readonly { readonly label: string; readonly href: string }[]
  readonly ctaDesktopLabel: string
  readonly ctaMobileLabel: string
  readonly menuButtonAriaLabel: string
  readonly mainNavAriaLabel: string
}

export interface HeroContentFile {
  readonly overline: string
  readonly headline: string
  readonly subheadline: string
  readonly ctaPrimaryLabel: string
  readonly ctaSecondaryLabel: string
  readonly imageAlt: string
}

export interface EducacaoContentFile {
  readonly heading: string
  readonly intro: string
  readonly researchHighlight: string
  readonly cards: readonly {
    readonly title: string
    readonly body: string
    readonly image: ContentImage
  }[]
}

export interface RotinaContentFile {
  readonly heading: string
  readonly intro: string
  readonly steps: readonly {
    readonly title: string
    readonly body: string
    readonly image: ContentImage
  }[]
}

export interface ProdutoContentFile {
  readonly heading: string
  readonly body: readonly string[]
  readonly benefits: readonly string[]
  readonly ctaLabel: string
  readonly packshotAlt: string
}

export interface DemonstracaoContentFile {
  readonly heading: string
  readonly intro: string
  readonly banner: {
    readonly overline: string
    readonly headline: string
    readonly body: string
    readonly ctaLabel: string
  }
  readonly videos: readonly {
    readonly id: string
    readonly src: string
    readonly captionsSrc: string
    readonly posterSrc: string
    readonly label: string
  }[]
}

export interface IngredientesContentFile {
  readonly heading: string
  readonly isContentReady: boolean
}

export interface ProvaAutoridadeContentFile {
  readonly heading: string
  readonly stats: readonly { readonly stat: string; readonly label: string }[]
  readonly source: string
}

export interface CapturaLeadContentFile {
  readonly heading: string
  readonly body: string
  readonly ebookTitlePlaceholder: string | null
}

export interface FormContentFile {
  readonly fields: Readonly<
    Record<string, { readonly label: string; readonly placeholder: string }>
  >
  readonly porteOptions: readonly { readonly value: string; readonly label: string }[]
  readonly simNaoOptions: readonly { readonly value: string; readonly label: string }[]
  readonly lgpdLabel: string
  readonly optInLabel: string
  readonly submitLabel: string
  readonly submitLoadingLabel: string
  readonly errorMessages: Readonly<Record<'nome' | 'email' | 'aceiteLgpd', string>>
  readonly successModal: Readonly<
    Record<
      'title' | 'body' | 'downloadCtaLabel' | 'emailModeMessage' | 'closeAriaLabel',
      string
    >
  >
  readonly errorToastMessage: string
}

export interface OndeComprarContentFile {
  readonly heading: string
  readonly intro: string
  readonly partners: readonly {
    readonly nome: string
    readonly logoUrl: string
    readonly link: string
  }[]
}

export interface FaqContentFile {
  readonly heading: string
  readonly items: readonly {
    readonly question: string
    readonly answer: string
    readonly isReadyForProduction: boolean
  }[]
}

export interface FooterContentFile {
  readonly logoAlt: string
  readonly links: readonly { readonly label: string; readonly href: string }[]
  readonly claimSource: string
  readonly speciesDisclaimer: string
  readonly legalDataPlaceholder: string | null
  readonly copyright: string
}

/** Metadados que hoje estão escritos à mão em `apps/lp/index.html`. */
export interface PageMetadataFile {
  readonly title: string
  readonly description: string
  readonly canonicalUrl: string
}

/**
 * Imagens que hoje não estão em nenhum `*.content.ts`: os componentes as
 * importam diretamente. O esquema as declara como campo editável, então a
 * migração precisa saber onde elas estão — é o único lugar do repositório em
 * que esses caminhos aparecem escritos.
 */
export interface ComponentImages {
  readonly headerLogo: string
  readonly heroImage: string
  readonly produtoPackshot: string
  readonly provaAutoridadeKit: string
  readonly footerLogo: string
}

export interface LandingPageContent {
  readonly header: HeaderContentFile
  readonly hero: HeroContentFile
  readonly educacao: EducacaoContentFile
  readonly rotina: RotinaContentFile
  readonly produto: ProdutoContentFile
  readonly demonstracao: DemonstracaoContentFile
  readonly ingredientes: IngredientesContentFile
  readonly provaAutoridade: ProvaAutoridadeContentFile
  readonly capturaLead: CapturaLeadContentFile
  readonly form: FormContentFile
  readonly ondeComprar: OndeComprarContentFile
  readonly faq: FaqContentFile
  readonly footer: FooterContentFile
  readonly metadata: PageMetadataFile
  readonly componentImages: ComponentImages
  /** As fotos do mosaico do formulário, na ordem em que o layout as dispõe. */
  readonly mosaicPhotos: readonly string[]
  /** Raiz de `apps/lp`, para resolver os vídeos servidos de `public/`. */
  readonly landingPageRoot: string
}

const CONTENT_FILES = {
  header: 'src/components/layout/Header/Header.content.ts',
  hero: 'src/sections/Hero/Hero.content.ts',
  educacao: 'src/sections/Educacao/Educacao.content.ts',
  rotina: 'src/sections/RotinaCuidado/RotinaCuidado.content.ts',
  produto: 'src/sections/Produto/Produto.content.ts',
  demonstracao: 'src/sections/Demonstracao/Demonstracao.content.ts',
  ingredientes: 'src/sections/Ingredientes/Ingredientes.content.ts',
  provaAutoridade: 'src/sections/ProvaAutoridade/ProvaAutoridade.content.ts',
  capturaLead: 'src/sections/CapturaLead/CapturaLead.content.ts',
  ondeComprar: 'src/sections/OndeComprar/OndeComprar.content.ts',
  faq: 'src/sections/Faq/Faq.content.ts',
  footer: 'src/components/layout/Footer/Footer.content.ts',
} as const

/**
 * A imagem do cabeçalho e a do rodapé são o mesmo arquivo, e ele é o SVG do
 * logo — aceito no armazenamento desde
 * `20260903120000_allow_svg_in_images_bucket.sql`. Ele sobe como está: converter
 * um ativo de marca para bitmap custaria nitidez em tela de alta densidade sem
 * nada em troca.
 *
 * Como o mesmo arquivo aparece em dois campos, ele vira **uma** mídia só — a
 * dedução é de `media-registry.ts`, que indexa por caminho de arquivo.
 */
export const COMPONENT_IMAGE_FILES: ComponentImages = {
  headerLogo: 'src/assets/logos/veggiedent-fresh-edc-logo.svg',
  heroImage: 'src/assets/images/hero/virbac-kv-hero.png',
  produtoPackshot: 'src/assets/images/produto/veggiedent-packshot.jpg',
  provaAutoridadeKit: 'src/assets/images/prova-autoridade/Kit-de-imagens.png',
  footerLogo: 'src/assets/logos/veggiedent-fresh-edc-logo.svg',
}

/**
 * As seis fotos do mosaico que acompanha o formulário do guia, na ordem em que
 * `LeadFormMosaic.tsx` as dispõe — a ordem é o que a lista do CMS passa a
 * guardar, e mudá-la aqui muda o desenho da grade.
 *
 * Não há texto alternativo a migrar: o esquema as declara **decorativas**, como
 * a página já as trata hoje (o bloco inteiro é `aria-hidden` e cada foto entra
 * com `alt=""`). Descrevê-las aqui seria inventar conteúdo que ninguém escreveu
 * e fazer o leitor de tela anunciar seis fotos no meio de um formulário.
 */
export const MOSAIC_PHOTOS: readonly string[] = [
  'src/assets/images/formulario/mosaico-descanso.jpg',
  'src/assets/images/formulario/mosaico-mastigando.jpg',
  'src/assets/images/formulario/mosaico-jardim.jpg',
  'src/assets/images/formulario/mosaico-produto.jpg',
  'src/assets/images/formulario/mosaico-retriever.jpg',
  'src/assets/images/formulario/mosaico-rotina.jpg',
]

const TITLE = /<title>([\s\S]*?)<\/title>/
const DESCRIPTION = /<meta\s+name="description"[\s\S]*?content="([\s\S]*?)"/
const CANONICAL = /<link\s+rel="canonical"[\s\S]*?href="([\s\S]*?)"/

function firstCapture(pattern: RegExp, html: string, what: string): string {
  const match = pattern.exec(html)
  if (match === null) {
    throw new Error(`Não encontrei ${what} em apps/lp/index.html.`)
  }
  return match[1].trim()
}

export function extractPageMetadata(html: string): PageMetadataFile {
  return {
    title: firstCapture(TITLE, html, 'o título da página'),
    description: firstCapture(DESCRIPTION, html, 'a descrição da página'),
    canonicalUrl: firstCapture(CANONICAL, html, 'o endereço canônico'),
  }
}

/**
 * Cada `*.content.ts` exporta um único objeto de conteúdo. Exigir isso em vez
 * de pegar o primeiro export protege a migração de silenciosamente ignorar um
 * conteúdo novo que alguém venha a acrescentar ao mesmo arquivo — foi o que
 * aconteceu com `CapturaLead.content.ts`, que exporta dois e por isso é lido
 * explicitamente, e não por esta função.
 */
function singleExportOf(filePath: string): unknown {
  const exported = Object.values(loadModule(filePath))
  if (exported.length !== 1) {
    throw new Error(
      `${filePath} deveria exportar exatamente um objeto de conteúdo; exporta ${exported.length}.`,
    )
  }
  return exported[0]
}

/** Todo o conteúdo de hoje, lido dos arquivos que o produzem. */
export function loadLandingPageContent(
  landingPageRoot: string = resolve(findRepositoryRoot(), 'apps/lp'),
): LandingPageContent {
  const load = <T>(relativePath: string): T =>
    singleExportOf(resolve(landingPageRoot, relativePath)) as T

  const capturaLeadModule = loadModule(
    resolve(landingPageRoot, CONTENT_FILES.capturaLead),
  )

  return {
    header: load<HeaderContentFile>(CONTENT_FILES.header),
    hero: load<HeroContentFile>(CONTENT_FILES.hero),
    educacao: load<EducacaoContentFile>(CONTENT_FILES.educacao),
    rotina: load<RotinaContentFile>(CONTENT_FILES.rotina),
    produto: load<ProdutoContentFile>(CONTENT_FILES.produto),
    demonstracao: load<DemonstracaoContentFile>(CONTENT_FILES.demonstracao),
    ingredientes: load<IngredientesContentFile>(CONTENT_FILES.ingredientes),
    provaAutoridade: load<ProvaAutoridadeContentFile>(CONTENT_FILES.provaAutoridade),
    capturaLead: capturaLeadModule.capturaLeadContent as CapturaLeadContentFile,
    form: capturaLeadModule.formContent as FormContentFile,
    ondeComprar: load<OndeComprarContentFile>(CONTENT_FILES.ondeComprar),
    faq: load<FaqContentFile>(CONTENT_FILES.faq),
    footer: load<FooterContentFile>(CONTENT_FILES.footer),
    metadata: extractPageMetadata(readFileSync(resolve(landingPageRoot, 'index.html'), 'utf8')),
    componentImages: {
      headerLogo: resolve(landingPageRoot, COMPONENT_IMAGE_FILES.headerLogo),
      heroImage: resolve(landingPageRoot, COMPONENT_IMAGE_FILES.heroImage),
      produtoPackshot: resolve(landingPageRoot, COMPONENT_IMAGE_FILES.produtoPackshot),
      provaAutoridadeKit: resolve(landingPageRoot, COMPONENT_IMAGE_FILES.provaAutoridadeKit),
      footerLogo: resolve(landingPageRoot, COMPONENT_IMAGE_FILES.footerLogo),
    },
    mosaicPhotos: MOSAIC_PHOTOS.map((photo) => resolve(landingPageRoot, photo)),
    landingPageRoot,
  }
}

/** Caminho absoluto de um arquivo servido estaticamente de `apps/lp/public`. */
export function publicAssetPath(content: LandingPageContent, publicUrl: string): string {
  return resolve(content.landingPageRoot, 'public', publicUrl.replace(/^\//, ''))
}
