// Fonte: Copy Deck v2.0, secao 12. A pergunta 2 (faixa etaria) tem resposta
// placeholder e isReadyForProduction: false — o componente Faq.tsx filtra
// esses itens antes de renderizar, para nao publicar placeholder visivel ao
// usuario final (Especificacao Funcional, secao 6.11).
import type { FaqContent } from "./Faq.types";

export const faqContent: FaqContent = {
  heading: "Perguntas frequentes",
  items: [
    {
      question: "Com que frequência devo oferecer Veggiedent® ao meu cão?",
      answer:
        "A placa bacteriana se forma em menos de 24 horas na superfície dental, portanto o ideal é escovar diariamente, ou se acordo com a recomendação do seu médico-veterinário.",
      isReadyForProduction: true,
    },
    {
      question: "A partir de que idade posso oferecer Veggiedent®?",
      answer:
        "[PLACEHOLDER — faixa etária recomendada ainda não confirmada pela Virbac]",
      isReadyForProduction: false,
    },
    {
      question: "Veggiedent® substitui a escovação dos dentes?",
      answer:
        "Não. Veggiedent® faz parte da rotina de cuidado bucal, não substitui a escovação nem o acompanhamento veterinário.",
      isReadyForProduction: true,
    },
    {
      question: "Como sei se meu cão tem algum problema bucal?",
      answer:
        "Hálito diferente, dificuldade para mastigar ou mudanças na hora da comida são sinais para conversar com o veterinário. Só um profissional consegue avaliar a boca do seu cão com segurança.",
      isReadyForProduction: true,
    },
    {
      question: "VeggieDent pode ser oferecido ao meu cão se ele for alérgico?",
      answer:
        "Sim. A composição de Veggiedent® é 100% vegetal, livre de conservantes ou ingredientes transgênicos.",
      isReadyForProduction: true,
    },
    // {
    //   question: "Onde posso comprar Veggiedent?",
    //   answer:
    //     'A Virbac não vende diretamente ao consumidor final. Veja os parceiros disponíveis na seção "Onde comprar" desta página.',
    //   isReadyForProduction: true,
    // },
    {
      question: "De onde vem o dado citado nesta página?",
      answer:
        "Da Pesquisa Ipsos 2026, realizada com 1.116 médicos-veterinários, com base de dados da Virbac. O estudo completo está no link ao lado da informação.",
      isReadyForProduction: true,
    },
  ],
};
