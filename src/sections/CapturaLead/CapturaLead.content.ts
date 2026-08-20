// Fonte: Copy Deck v2.0, secoes 9 e 10. Titulo do e-book [BLOQUEADO] — Notas
// Tecnicas v2.0, secao 2.

import type { CapturaLeadContent } from "./CapturaLead.types";

export const capturaLeadContent: CapturaLeadContent = {
  heading: "Baixe o guia gratuito sobre cuidados diários com os pets",

  body: "Descubra como tornar o cuidado oral parte da rotina do seu cão, com informações sobre prevenção, controle do tártaro, mau hálito e os diferenciais de Veggiedent® FR3SH. Preencha o formulário ao lado e receba o guia por e-mail.",

  ebookTitlePlaceholder: null,
};

export const formContent = {
  fields: {
    nome: {
      label: "Nome",
      placeholder: "Seu nome",
    },

    email: {
      label: "E-mail",
      placeholder: "seuemail@exemplo.com",
    },

    telefone: {
      label: "WhatsApp",
      placeholder: "(00) 00000-0000",
    },

    nomeCachorro: {
      label: "Nome do seu cão (opcional)",
      placeholder: "Ex.: Bidu",
    },

    porteCachorro: {
      label: "Porte do seu cão (opcional)",
      placeholder: "Selecione o porte",
    },

    cidadeEstado: {
      label: "Cidade e estado (opcional)",
      placeholder: "Ex.: São Paulo, SP",
    },

    conheceVirbac: {
      label: "Você já conhece a Virbac?",
      placeholder: "Selecione uma opção",
    },

    usaProdutoVirbac: {
      label: "Você já utiliza algum produto Virbac?",
      placeholder: "Selecione uma opção",
    },

    qualProdutoVirbac: {
      label: "Qual produto Virbac você utiliza? (opcional)",
      placeholder: "Digite o nome do produto",
    },
  },

  porteOptions: [
    { value: "pequeno", label: "Pequeno" },
    { value: "medio", label: "Médio" },
    { value: "grande", label: "Grande" },
  ] as const,

  simNaoOptions: [
    { value: "sim", label: "Sim" },
    { value: "nao", label: "Não" },
  ] as const,

  lgpdLabel:
    "Li e aceito a Política de Privacidade e autorizo o uso dos meus dados para receber o guia e comunicações relacionadas.",

  optInLabel:
    "Quero receber novidades e conteúdos da Virbac sobre cuidado com o meu cão.",

  submitLabel: "Quero o guia gratuito",

  submitLoadingLabel: "Enviando...",

  errorMessages: {
    nome: "Digite seu nome.",
    email: "Digite um e-mail válido.",
    aceiteLgpd: "É preciso aceitar a Política de Privacidade para continuar.",
  },

  successModal: {
    title: "Guia a caminho!",

    body: "Confirmamos seu cadastro. Clique no botão abaixo para acessar o guia agora.",

    downloadCtaLabel: "Baixar o guia agora",

    emailModeMessage:
      "Enviamos o guia para o seu e-mail. Se não encontrar, confira a caixa de spam.",

    closeAriaLabel: "Fechar",
  },

  errorToastMessage:
    "Não foi possível enviar seu cadastro agora. Tente novamente em alguns instantes.",
};
