import type { SectionKey } from '@veggiedent/content-schema'
import type { LandingPageContent } from './content-source'
import { publicAssetPath } from './content-source'

/**
 * Tradução do conteúdo de hoje para os documentos de seção do CMS.
 *
 * Funções puras: entram os arquivos já lidos, saem os 12 documentos e o
 * documento de metadados. Nada aqui fala com o banco, com o armazenamento ou
 * com a rede — quem faz isso é `migrate-content.ts`.
 *
 * Duas convenções valem para o arquivo inteiro:
 *
 * - **Campos de mídia carregam o caminho do arquivo no disco**, não o
 *   identificador da mídia. A troca por identificador é feita depois, por
 *   `withResolvedMedia` — a mesma função que a API usa para trocar identificador
 *   por URL ao servir a LP. Um percurso só, escrito uma vez.
 * - **Campo sem valor real é omitido, nunca preenchido com espaço reservado.**
 *   É o critério C-08 do SDD: nenhum texto de espaço reservado chega ao
 *   visitante. Onde a Virbac ainda não entregou o dado — o título do e-book e os
 *   dados legais do rodapé —, o campo simplesmente não existe no documento, e o
 *   esquema o declara opcional exatamente por isso.
 */

/** Um documento de seção antes de as mídias serem resolvidas. */
export type SectionDocumentDraft = Record<string, unknown>

export type SectionDocumentDrafts = Record<SectionKey, SectionDocumentDraft>

/**
 * A pergunta do FAQ que hoje existe apenas como bloco comentado no arquivo de
 * conteúdo. Ela está pronta (o próprio bloco a marca como
 * `isReadyForProduction: true`) e foi retirada da página por comentário — que é
 * exatamente o controle em código que a visibilidade do CMS substitui
 * (SDD § "Linguagem ubíqua"). Entra preservada e **não publicada**, na posição
 * em que o autor a deixou, para que publicá-la volte a ser um clique.
 *
 * `faq-item-comentado.spec.ts` compara este texto com o do bloco comentado e
 * falha se os dois divergirem.
 */
export const COMMENTED_FAQ_ITEM = {
  question: 'Onde posso comprar Veggiedent?',
  answer:
    'A Virbac não vende diretamente ao consumidor final. Veja os parceiros disponíveis na seção "Onde comprar" desta página.',
} as const

/** Posição do item comentado dentro da lista do arquivo de conteúdo. */
export const COMMENTED_FAQ_ITEM_POSITION = 5

/** Os nove campos do formulário do guia, na ordem em que aparecem na tela. */
const FORM_FIELD_NAMES = [
  'nome',
  'email',
  'telefone',
  'nomeCachorro',
  'porteCachorro',
  'cidadeEstado',
  'conheceVirbac',
  'usaProdutoVirbac',
  'qualProdutoVirbac',
] as const

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * `fields.nome.label` do arquivo de hoje é `formNomeLabel` no esquema — o
 * esquema achata o agrupamento por campo em textos irmãos.
 */
function formFieldTexts(content: LandingPageContent): Record<string, string> {
  const texts: Record<string, string> = {}
  for (const name of FORM_FIELD_NAMES) {
    const field = content.form.fields[name]
    texts[`form${capitalize(name)}Label`] = field.label
    texts[`form${capitalize(name)}Placeholder`] = field.placeholder
  }
  return texts
}

interface OptionItem {
  readonly value: string
  readonly label: string
}

function toOptionItems(options: readonly OptionItem[]): SectionDocumentDraft[] {
  return options.map((option, ordem) => ({
    value: option.value,
    label: option.label,
    visivel: true,
    ordem,
  }))
}

interface TextLink {
  readonly label: string
  readonly href: string
}

function toLinkItems(links: readonly TextLink[]): SectionDocumentDraft[] {
  return links.map((link, ordem) => ({
    label: link.label,
    href: link.href,
    visivel: true,
    ordem,
  }))
}

/** Uma lista de parágrafos ou de benefícios: um texto por item. */
function toTextItems(texts: readonly string[]): SectionDocumentDraft[] {
  return texts.map((texto, ordem) => ({ texto, visivel: true, ordem }))
}

function headerDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    logo: content.componentImages.headerLogo,
    logoAlt: content.header.logoAlt,
    ctaDesktopLabel: content.header.ctaDesktopLabel,
    ctaMobileLabel: content.header.ctaMobileLabel,
    menuButtonAriaLabel: content.header.menuButtonAriaLabel,
    mainNavAriaLabel: content.header.mainNavAriaLabel,
    navLinks: toLinkItems(content.header.navLinks),
  }
}

function heroDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    overline: content.hero.overline,
    headline: content.hero.headline,
    subheadline: content.hero.subheadline,
    ctaPrimaryLabel: content.hero.ctaPrimaryLabel,
    ctaSecondaryLabel: content.hero.ctaSecondaryLabel,
    image: content.componentImages.heroImage,
    imageAlt: content.hero.imageAlt,
  }
}

function educacaoDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    heading: content.educacao.heading,
    intro: content.educacao.intro,
    researchHighlight: content.educacao.researchHighlight,
    cards: content.educacao.cards.map((card, ordem) => ({
      title: card.title,
      body: card.body,
      image: card.image.src,
      imageAlt: card.image.alt,
      visivel: true,
      ordem,
    })),
  }
}

function rotinaDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    heading: content.rotina.heading,
    intro: content.rotina.intro,
    steps: content.rotina.steps.map((step, ordem) => ({
      title: step.title,
      body: step.body,
      image: step.image.src,
      imageAlt: step.image.alt,
      visivel: true,
      ordem,
    })),
  }
}

function produtoDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    heading: content.produto.heading,
    ctaLabel: content.produto.ctaLabel,
    packshot: content.componentImages.produtoPackshot,
    packshotAlt: content.produto.packshotAlt,
    body: toTextItems(content.produto.body),
    benefits: toTextItems(content.produto.benefits),
  }
}

/**
 * O esquema exige texto alternativo ao lado de toda imagem, e a miniatura do
 * vídeo hoje não tem nenhum: ela é o atributo `poster` de um `<video>`, que não
 * aceita texto alternativo. Em vez de inventar uma descrição, a migração reusa o
 * título do vídeo — copy já aprovado, que descreve exatamente a cena que a
 * miniatura mostra. O operador pode refiná-lo no painel.
 *
 * As legendas ficam de fora: os arquivos `.vtt` que o conteúdo aponta não
 * existem em `public/videos/captions/`. O campo é opcional no esquema, então
 * omiti-lo reproduz o que a página faz hoje — o navegador simplesmente não
 * oferece legenda.
 */
function demonstracaoDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    heading: content.demonstracao.heading,
    intro: content.demonstracao.intro,
    bannerOverline: content.demonstracao.banner.overline,
    bannerHeadline: content.demonstracao.banner.headline,
    bannerBody: content.demonstracao.banner.body,
    bannerCtaLabel: content.demonstracao.banner.ctaLabel,
    videos: content.demonstracao.videos.map((video, ordem) => ({
      label: video.label,
      video: publicAssetPath(content, video.src),
      poster: publicAssetPath(content, video.posterSrc),
      posterAlt: video.label,
      visivel: true,
      ordem,
    })),
  }
}

function ingredientesDocument(content: LandingPageContent): SectionDocumentDraft {
  return { heading: content.ingredientes.heading }
}

function provaAutoridadeDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    heading: content.provaAutoridade.heading,
    source: content.provaAutoridade.source,
    stats: content.provaAutoridade.stats.map((stat, ordem) => ({
      stat: stat.stat,
      label: stat.label,
      visivel: true,
      ordem,
    })),
  }
}

function capturaLeadDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    heading: content.capturaLead.heading,
    body: content.capturaLead.body,
    ...formFieldTexts(content),
    lgpdLabel: content.form.lgpdLabel,
    optInLabel: content.form.optInLabel,
    submitLabel: content.form.submitLabel,
    submitLoadingLabel: content.form.submitLoadingLabel,
    errorNome: content.form.errorMessages.nome,
    errorEmail: content.form.errorMessages.email,
    errorAceiteLgpd: content.form.errorMessages.aceiteLgpd,
    successModalTitle: content.form.successModal.title,
    successModalBody: content.form.successModal.body,
    successModalDownloadCtaLabel: content.form.successModal.downloadCtaLabel,
    successModalEmailModeMessage: content.form.successModal.emailModeMessage,
    successModalCloseAriaLabel: content.form.successModal.closeAriaLabel,
    errorToastMessage: content.form.errorToastMessage,
    porteOptions: toOptionItems(content.form.porteOptions),
    simNaoOptions: toOptionItems(content.form.simNaoOptions),
  }
}

/**
 * O logo do parceiro não tem texto alternativo próprio no conteúdo de hoje: o
 * componente usa o nome da loja (`PartnerLogoMarquee.tsx`). A migração grava o
 * mesmo nome, reproduzindo o que o leitor de tela já ouve hoje.
 */
function ondeComprarDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    heading: content.ondeComprar.heading,
    intro: content.ondeComprar.intro,
    partners: content.ondeComprar.partners.map((partner, ordem) => ({
      nome: partner.nome,
      logo: partner.logoUrl,
      logoAlt: partner.nome,
      link: partner.link,
      visivel: true,
      ordem,
    })),
  }
}

/**
 * `isReadyForProduction` vira visibilidade do item, um para um. A pergunta cuja
 * resposta ainda é `[PLACEHOLDER — faixa etária…]` entra **não publicada**: o
 * texto fica guardado para o operador substituir, e não chega ao visitante
 * (SDD § C-08).
 */
function faqDocument(content: LandingPageContent): SectionDocumentDraft {
  const fromFile = content.faq.items.map((item) => ({
    question: item.question,
    answer: item.answer,
    visivel: item.isReadyForProduction,
  }))
  const withCommentedItem = [
    ...fromFile.slice(0, COMMENTED_FAQ_ITEM_POSITION),
    { ...COMMENTED_FAQ_ITEM, visivel: false },
    ...fromFile.slice(COMMENTED_FAQ_ITEM_POSITION),
  ]

  return {
    heading: content.faq.heading,
    items: withCommentedItem.map((item, ordem) => ({ ...item, ordem })),
  }
}

function footerDocument(content: LandingPageContent): SectionDocumentDraft {
  return {
    logo: content.componentImages.footerLogo,
    logoAlt: content.footer.logoAlt,
    claimSource: content.footer.claimSource,
    speciesDisclaimer: content.footer.speciesDisclaimer,
    copyright: content.footer.copyright,
    links: toLinkItems(content.footer.links),
  }
}

export function buildSectionDocuments(content: LandingPageContent): SectionDocumentDrafts {
  return {
    header: headerDocument(content),
    hero: heroDocument(content),
    educacao: educacaoDocument(content),
    rotina: rotinaDocument(content),
    produto: produtoDocument(content),
    demonstracao: demonstracaoDocument(content),
    ingredientes: ingredientesDocument(content),
    prova_autoridade: provaAutoridadeDocument(content),
    captura_lead: capturaLeadDocument(content),
    onde_comprar: ondeComprarDocument(content),
    faq: faqDocument(content),
    footer: footerDocument(content),
  }
}

/**
 * Metadados da página. `ogImage` fica de fora: `apps/lp/index.html` declara a
 * imagem de compartilhamento como pendência da Virbac e proíbe publicar uma URL
 * fictícia. Sem imagem, o texto alternativo dela também não existe.
 */
export function buildPageMetadata(content: LandingPageContent): SectionDocumentDraft {
  return {
    title: content.metadata.title,
    description: content.metadata.description,
    canonicalUrl: content.metadata.canonicalUrl,
  }
}

/**
 * Seções que nascem **não publicadas**.
 *
 * `Ingredientes` é a única: hoje o código a esconde com `isContentReady: false`,
 * porque o material técnico da Virbac não chegou. O que era uma constante em
 * código passa a ser visibilidade no CMS, sem que o título já aprovado se perca.
 */
export function unpublishedSections(content: LandingPageContent): SectionKey[] {
  return content.ingredientes.isContentReady ? [] : ['ingredientes']
}
