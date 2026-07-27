// Fonte: Copy Deck v2.0, secao 12. A pergunta 2 (faixa etaria) tem resposta
// placeholder e isReadyForProduction: false — o componente Faq.tsx filtra
// esses itens antes de renderizar, para nao publicar placeholder visivel ao
// usuario final (Especificacao Funcional, secao 6.11).
import type { FaqContent } from './Faq.types'

export const faqContent: FaqContent = {
  heading: 'Perguntas frequentes',
  items: [
    {
      question: 'Com que frequência devo oferecer Veggiedent ao meu cachorro?',
      answer: 'Depende do porte, da idade e da rotina do seu cachorro. O melhor caminho é perguntar ao médico-veterinário que acompanha ele.',
      isReadyForProduction: true,
    },
    {
      question: 'A partir de que idade posso oferecer Veggiedent?',
      answer: '[PLACEHOLDER — faixa etária recomendada ainda não confirmada pela Virbac]',
      isReadyForProduction: false,
    },
    {
      question: 'Veggiedent substitui a escovação dos dentes?',
      answer: 'Não. Veggiedent faz parte da rotina de cuidado bucal, não substitui a escovação nem o acompanhamento veterinário.',
      isReadyForProduction: true,
    },
    {
      question: 'Como sei se meu cachorro tem algum problema bucal?',
      answer: 'Hálito diferente, dificuldade para mastigar ou mudanças na hora da comida são sinais para conversar com o veterinário. Só um profissional consegue avaliar a boca do seu cachorro com segurança.',
      isReadyForProduction: true,
    },
    {
      question: 'Existe alguma restrição de porte para o Veggiedent?',
      answer: 'Sim. A embalagem indica o porte recomendado. Confira essa informação antes de oferecer ao seu cachorro.',
      isReadyForProduction: true,
    },
    {
      question: 'Onde posso comprar Veggiedent?',
      answer: 'A Virbac não vende diretamente ao consumidor final. Veja os parceiros disponíveis na seção "Onde comprar" desta página.',
      isReadyForProduction: true,
    },
    {
      question: 'De onde vem o dado citado nesta página?',
      answer: 'Da Pesquisa Ipsos 2026, realizada com 1.116 médicos-veterinários, com base de dados da Virbac. O estudo completo está no link ao lado da informação.',
      isReadyForProduction: true,
    },
  ],
}
