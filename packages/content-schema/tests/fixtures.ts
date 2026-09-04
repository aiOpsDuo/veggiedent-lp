/**
 * Documentos de exemplo das 12 seções, com o conteúdo que hoje vive nos
 * arquivos `*.content.ts` da LP.
 *
 * Cada constante é tipada com o tipo derivado do esquema correspondente. Isso
 * faz da checagem de tipos do pacote uma verificação real de que os tipos
 * cobrem os campos de hoje: um campo que faltasse no esquema quebraria a
 * compilação deste arquivo.
 */
import type {
  CapturaLeadDocument,
  DemonstracaoDocument,
  EducacaoDocument,
  FaqDocument,
  FooterDocument,
  HeaderDocument,
  HeroDocument,
  IngredientesDocument,
  OndeComprarDocument,
  ProdutoDocument,
  ProvaAutoridadeDocument,
  RotinaDocument,
  SectionDocuments,
  SiteMetadata,
} from '../src/types'

/** Identificadores de mídia de exemplo, no formato gravado em `media_assets`. */
export function mediaId(slot: number): string {
  return `00000000-0000-4000-8000-${String(slot).padStart(12, '0')}`
}

export const headerDocument: HeaderDocument = {
  logo: mediaId(1),
  logoAlt: 'Veggiedent, por Virbac',
  ctaDesktopLabel: 'Baixar o guia de cuidados diários',
  ctaMobileLabel: 'Baixar o guia de cuidados diários',
  menuButtonAriaLabel: 'Abrir menu',
  mainNavAriaLabel: 'Menu principal',
  navLinks: [
    { visivel: true, ordem: 0, label: 'Saúde oral', href: '#educacao' },
    { visivel: true, ordem: 1, label: 'Rotina de cuidado', href: '#rotina' },
    { visivel: true, ordem: 2, label: 'Produto', href: '#produto' },
    { visivel: true, ordem: 3, label: 'Onde comprar', href: '#onde-comprar' },
    { visivel: true, ordem: 4, label: 'Perguntas frequentes', href: '#faq' },
  ],
}

export const heroDocument: HeroDocument = {
  overline: 'SAÚDE ORAL CANINA',
  headline: 'A marca mais recomendada pelos médicos veterinários entrevistados.',
  subheadline:
    'Veggiedent entra na rotina do seu cachorro para ajudar no controle de tártaro e no hálito fresco, sempre com a orientação do médico-veterinário.',
  ctaPrimaryLabel: 'Baixar o guia de cuidados diários',
  ctaSecondaryLabel: 'Ver a rotina completa',
  image: mediaId(2),
  imageAlt:
    'Beagle recebendo Veggiedent das mãos de uma médica-veterinária em consultório, com selo N.1 Veggiedent Fr3sh e logo Virbac',
}

export const educacaoDocument: EducacaoDocument = {
  heading: 'Por que a saúde oral do seu cachorro importa',
  intro: 'A boca do seu cachorro muda aos poucos.',
  researchHighlight:
    'E, segundo a Pesquisa Ipsos 2026, Veggiedent® é a marca mais recomendada pelos profissionais entrevistados.',
  cards: [
    {
      visivel: true,
      ordem: 0,
      title: 'Devagar, mas sempre',
      body: 'Tártaro não aparece do dia para a noite.',
      image: mediaId(3),
      imageAlt: 'Cachorro deitado observando de perto, ilustrando o acúmulo silencioso de tártaro',
    },
  ],
}

export const rotinaDocument: RotinaDocument = {
  heading: 'Uma rotina simples, no ritmo do seu dia',
  intro: 'Não existe fórmula pronta. Existe consistência.',
  steps: [
    {
      visivel: true,
      ordem: 0,
      title: 'Observe a boca do seu cão de vez em quando',
      body: 'Um olhar por perto, sem pressa, ajuda a notar qualquer mudança desde cedo.',
      image: mediaId(4),
      imageAlt: 'Tutora observando e acariciando o cão em casa',
    },
  ],
}

export const produtoDocument: ProdutoDocument = {
  heading: 'Veggiedent® FR3SH rotina de cuidado bucal',
  ctaLabel: 'Ver onde comprar',
  packshot: mediaId(5),
  packshotAlt: 'Cachorro segurando na boca a embalagem oficial do Veggiedent Fr3sh',
  body: [
    { visivel: true, ordem: 0, texto: 'O formato em “Z” de Veggiedent® FR3SH não é por acaso.' },
    { visivel: true, ordem: 1, texto: 'A exclusiva tecnologia FR3SH combate o mau hálito na raiz do problema.' },
  ],
  benefits: [
    { visivel: true, ordem: 0, texto: 'Controle de tártaro' },
    { visivel: true, ordem: 1, texto: 'Hálito fresco e saudável' },
  ],
}

export const demonstracaoDocument: DemonstracaoDocument = {
  heading: 'Como oferecer Veggiedent® ao seu cão',
  intro: 'Os vídeos abaixo mostram o momento de oferecer o petisco.',
  bannerOverline: 'NA PRÁTICA',
  bannerHeadline: 'Do pacote à primeira mordida',
  bannerBody: 'Veja como é simples incluir o Veggiedent® no momento do petisco.',
  bannerCtaLabel: 'Quero receber o guia gratuito',
  videos: [
    {
      visivel: true,
      ordem: 0,
      label: 'Do pacote ao petisco',
      video: mediaId(6),
      poster: mediaId(7),
      posterAlt: 'Tutor abrindo o pacote de Veggiedent diante do cão',
      captions: mediaId(8),
    },
  ],
}

export const ingredientesDocument: IngredientesDocument = {
  heading: 'O que tem no Veggiedent',
}

export const provaAutoridadeDocument: ProvaAutoridadeDocument = {
  heading: 'A recomendação dos<br><strong>médicos-veterinários,</strong> em números',
  source: '*Pesquisa IPSOS 2026. Realizada com 1.116 veterinários, base de dados Virbac.',
  kit: mediaId(11),
  kitAlt: 'Veggiedent, selo número 1 e recomendação veterinária',
  stats: [
    { visivel: true, ordem: 0, stat: '1.116', label: 'Médicos-veterinários entrevistados' },
    { visivel: true, ordem: 1, stat: 'N.º 1', label: 'Marca mais recomendada no Brasil*' },
  ],
}

export const capturaLeadDocument: CapturaLeadDocument = {
  heading: 'Baixe o guia gratuito sobre cuidados diários com os pets',
  body: 'Descubra como tornar o cuidado oral parte da rotina do seu cão.',
  formNomeLabel: 'Nome',
  formNomePlaceholder: 'Seu nome',
  formEmailLabel: 'E-mail',
  formEmailPlaceholder: 'seuemail@exemplo.com',
  formTelefoneLabel: 'WhatsApp',
  formTelefonePlaceholder: '(00) 00000-0000',
  formNomeCachorroLabel: 'Nome do seu cão (opcional)',
  formNomeCachorroPlaceholder: 'Ex.: Bidu',
  formPorteCachorroLabel: 'Porte do seu cão (opcional)',
  formPorteCachorroPlaceholder: 'Selecione o porte',
  formCidadeEstadoLabel: 'Cidade e estado (opcional)',
  formCidadeEstadoPlaceholder: 'Ex.: São Paulo, SP',
  formConheceVirbacLabel: 'Você já conhece a Virbac?',
  formConheceVirbacPlaceholder: 'Selecione uma opção',
  formUsaProdutoVirbacLabel: 'Você já utiliza algum produto Virbac?',
  formUsaProdutoVirbacPlaceholder: 'Selecione uma opção',
  formQualProdutoVirbacLabel: 'Qual produto Virbac você utiliza? (opcional)',
  formQualProdutoVirbacPlaceholder: 'Digite o nome do produto',
  lgpdLabel:
    'Li e aceito a Política de Privacidade e autorizo o uso dos meus dados para receber o guia e comunicações relacionadas.',
  optInLabel: 'Quero receber novidades e conteúdos da Virbac sobre cuidado com o meu cão.',
  submitLabel: 'Quero o guia gratuito',
  submitLoadingLabel: 'Enviando...',
  errorNome: 'Digite seu nome.',
  errorEmail: 'Digite um e-mail válido.',
  errorAceiteLgpd: 'É preciso aceitar a Política de Privacidade para continuar.',
  successModalTitle: 'Guia a caminho!',
  successModalBody: 'Confirmamos seu cadastro. Clique no botão abaixo para acessar o guia agora.',
  successModalDownloadCtaLabel: 'Baixar o guia agora',
  successModalEmailModeMessage: 'Enviamos o guia para o seu e-mail. Se não encontrar, confira a caixa de spam.',
  successModalCloseAriaLabel: 'Fechar',
  errorToastMessage: 'Não foi possível enviar seu cadastro agora. Tente novamente em alguns instantes.',
  porteOptions: [
    { visivel: true, ordem: 0, value: 'pequeno', label: 'Pequeno' },
    { visivel: true, ordem: 1, value: 'medio', label: 'Médio' },
    { visivel: true, ordem: 2, value: 'grande', label: 'Grande' },
  ],
  simNaoOptions: [
    { visivel: true, ordem: 0, value: 'sim', label: 'Sim' },
    { visivel: true, ordem: 1, value: 'nao', label: 'Não' },
  ],
  mosaico: [
    { visivel: true, ordem: 0, image: mediaId(12) },
    { visivel: true, ordem: 1, image: mediaId(13) },
  ],
}

export const ondeComprarDocument: OndeComprarDocument = {
  heading: 'Onde encontrar Veggiedent®',
  intro: 'A Virbac não vende diretamente ao consumidor final.',
  partners: [
    {
      visivel: true,
      ordem: 0,
      nome: 'Lupi',
      logo: mediaId(9),
      logoAlt: 'Logo da loja Lupi',
      link: 'https://www.lupipet.com.br/tiras-mastigaveis-virbac-veggie-dent-fresh',
    },
  ],
}

export const faqDocument: FaqDocument = {
  heading: 'Perguntas frequentes',
  items: [
    {
      visivel: true,
      ordem: 0,
      question: 'Com que frequência devo oferecer Veggiedent® ao meu cão?',
      answer: 'A placa bacteriana se forma em menos de 24 horas na superfície dental.',
    },
    {
      visivel: false,
      ordem: 1,
      question: 'A partir de que idade posso oferecer Veggiedent®?',
      answer: 'Resposta ainda não confirmada pela Virbac.',
    },
  ],
}

export const footerDocument: FooterDocument = {
  logo: mediaId(10),
  logoAlt: 'Veggiedent, por Virbac',
  claimSource: '*Pesquisa IPSOS 2026. Realizada com 1.116 veterinários, base de dados Virbac.',
  speciesDisclaimer: 'Produto indicado exclusivamente para cães.',
  copyright: '© 2026 Virbac. Todos os direitos reservados.',
  links: [
    { visivel: true, ordem: 0, label: 'Política de privacidade', href: '/politica-de-privacidade' },
    { visivel: true, ordem: 1, label: 'Termos de uso', href: '/termos-de-uso' },
    { visivel: true, ordem: 2, label: 'Fale conosco', href: '/fale-conosco' },
  ],
}

export const validSectionDocuments: SectionDocuments = {
  header: headerDocument,
  hero: heroDocument,
  educacao: educacaoDocument,
  rotina: rotinaDocument,
  produto: produtoDocument,
  demonstracao: demonstracaoDocument,
  ingredientes: ingredientesDocument,
  prova_autoridade: provaAutoridadeDocument,
  captura_lead: capturaLeadDocument,
  onde_comprar: ondeComprarDocument,
  faq: faqDocument,
  footer: footerDocument,
}

export const validSiteMetadata: SiteMetadata = {
  title: 'Veggiedent — Rotina de cuidado bucal para cachorros | Virbac',
  description:
    'Veggiedent entra na rotina do seu cachorro para ajudar no controle de tártaro e no hálito fresco.',
  canonicalUrl: 'https://p.virbac.com.br/',
}
