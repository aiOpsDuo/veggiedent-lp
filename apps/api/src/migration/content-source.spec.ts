import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import {
  COMPONENT_IMAGE_FILES,
  extractPageMetadata,
  findRepositoryRoot,
  loadLandingPageContent,
  publicAssetPath,
} from './content-source'

/**
 * A leitura do conteúdo de hoje (PLAN.md § T9).
 *
 * O que estes testes prendem é a **fidelidade da fonte**: se a migração ler o
 * arquivo errado, ou deixar de ler um campo, tudo o que vier depois estará
 * consistente consigo mesmo e errado em relação à página. Por isso o teste
 * confronta o carregador com os arquivos do repositório, não com uma cópia.
 */

const repositoryRoot = findRepositoryRoot()
const landingPageRoot = resolve(repositoryRoot, 'apps/lp')

/** O caminho de um arquivo relativo a `apps/lp`, como os componentes o escrevem. */
function insideLandingPage(absolutePath: string): string {
  return relative(landingPageRoot, absolutePath).split('\\').join('/')
}

describe('leitura dos arquivos de conteúdo', () => {
  const content = loadLandingPageContent()

  it('lê os 12 arquivos de conteúdo e os metadados da página', () => {
    expect(content.header.ctaDesktopLabel.length).toBeGreaterThan(0)
    expect(content.faq.items.length).toBeGreaterThan(0)
    expect(content.metadata.title).toContain('Veggiedent')
  })

  it('preserva a acentuação e os símbolos do copy', () => {
    expect(content.produto.heading).toMatch(/[ãáéíóúç®]/)
  })

  /**
   * Os dois campos que a Virbac ainda não entregou. Eles chegam nulos do
   * arquivo de conteúdo, e é assim que a migração precisa recebê-los para poder
   * omiti-los do documento (SDD § C-08).
   */
  it('recebe como nulos os dois campos que a Virbac ainda não entregou', () => {
    expect(content.footer.legalDataPlaceholder).toBeNull()
    expect(content.capturaLead.ebookTitlePlaceholder).toBeNull()
  })

  it('resolve a importação de imagem em caminho absoluto no disco', () => {
    const primeiroCard = content.educacao.cards[0]

    expect(primeiroCard.image.src.startsWith(landingPageRoot)).toBe(true)
    expect(() => readFileSync(primeiroCard.image.src)).not.toThrow()
  })

  it('resolve o vídeo servido de public/ pelo endereço que o conteúdo declara', () => {
    const caminho = publicAssetPath(content, content.demonstracao.videos[0].src)

    expect(() => readFileSync(caminho)).not.toThrow()
  })
})

/**
 * As quatro imagens que nenhum `*.content.ts` declara: os componentes as
 * importam direto. A migração as conhece por um caminho escrito à mão, e um
 * caminho escrito à mão desatualiza em silêncio — a página passaria a mostrar
 * uma imagem e o CMS a guardar outra. Este teste lê o `import` dos próprios
 * componentes e exige que os dois digam o mesmo arquivo.
 */
describe('imagens que os componentes importam diretamente', () => {
  const IMPORT_BY_COMPONENT: Readonly<Record<keyof typeof COMPONENT_IMAGE_FILES, string>> = {
    headerLogo: 'src/components/layout/Header/Header.tsx',
    heroImage: 'src/sections/Hero/Hero.tsx',
    produtoPackshot: 'src/sections/Produto/Produto.tsx',
    footerLogo: 'src/components/layout/Footer/Footer.tsx',
  }

  const ASSET_IMPORT = /^import\s+\w+\s+from\s+['"](\..*\.(?:png|jpe?g|svg|webp|avif|gif))['"]/gm

  function importedAssets(componentPath: string): string[] {
    const source = readFileSync(resolve(landingPageRoot, componentPath), 'utf8')
    return [...source.matchAll(ASSET_IMPORT)].map(([, specifier]) =>
      insideLandingPage(resolve(landingPageRoot, componentPath, '..', specifier as string)),
    )
  }

  it.each(Object.entries(IMPORT_BY_COMPONENT))(
    'a migração leva a mesma imagem que %s importa',
    (campo, componentPath) => {
      const declarado = COMPONENT_IMAGE_FILES[campo as keyof typeof COMPONENT_IMAGE_FILES]

      expect(importedAssets(componentPath)).toContain(declarado)
    },
  )

  it('o logo do cabeçalho e o do rodapé são o mesmo arquivo', () => {
    expect(COMPONENT_IMAGE_FILES.headerLogo).toBe(COMPONENT_IMAGE_FILES.footerLogo)
  })
})

describe('metadados escritos em index.html', () => {
  const html = readFileSync(resolve(landingPageRoot, 'index.html'), 'utf8')

  it('extrai título, descrição e endereço canônico', () => {
    expect(extractPageMetadata(html)).toEqual({
      title: 'Veggiedent — Rotina de cuidado bucal para cachorros | Virbac',
      description:
        'Veggiedent entra na rotina do seu cachorro para ajudar no controle de tartaro e no halito fresco, sempre com a orientacao do medico-veterinario.',
      canonicalUrl: 'https://p.virbac.com.br/',
    })
  })

  /**
   * A imagem de compartilhamento é pendência declarada da Virbac: o próprio
   * `index.html` a descreve num comentário e proíbe publicar URL fictícia. Se um
   * dia a tag existir de verdade, este teste falha e alguém decide levá-la ao
   * CMS — que é melhor do que a migração continuar ignorando-a em silêncio.
   */
  it('não há tag og:image para migrar', () => {
    const semComentarios = html.replace(/<!--[\s\S]*?-->/g, '')

    expect(/<meta[^>]*property="og:image"/.test(semComentarios)).toBe(false)
  })

  it('recusa um HTML sem os metadados em vez de inventar valor', () => {
    expect(() => extractPageMetadata('<html><head></head></html>')).toThrow(
      /título da página/,
    )
  })
})
