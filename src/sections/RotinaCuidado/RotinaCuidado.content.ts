// Fonte: Copy Deck v2.0, secao 4.
import type { RotinaCuidadoContent } from './RotinaCuidado.types'
import observarBoca from '../../assets/images/rotina/observar-boca.jpg'
import escovacaoRotina from '../../assets/images/rotina/escovacao-rotina.jpg'
import veggiedentNaRotina from '../../assets/images/rotina/veggiedent-na-rotina.jpg'
import consultasVeterinarias from '../../assets/images/rotina/consultas-veterinarias.jpg'

export const rotinaCuidadoContent: RotinaCuidadoContent = {
  heading: 'Uma rotina simples, no ritmo do seu dia',
  intro:
    'Não existe fórmula pronta. Existe consistência. O médico-veterinário do seu cachorro ajuda a encontrar a frequência certa para o porte, a idade e o jeito de viver dele.',
  steps: [
    {
      title: 'Observe a boca do seu cachorro de vez em quando',
      body: 'Um olhar por perto, sem pressa, ajuda a notar cedo qualquer mudança.',
      image: {
        src: observarBoca,
        alt: 'Tutora observando e acariciando o cachorro em casa, em momento de atenção e carinho',
      },
    },
    {
      title: 'Escove os dentes na frequência que o veterinário indicar',
      body: 'Cada cachorro tem o seu ritmo. Pergunte ao profissional que acompanha o seu.',
      image: {
        src: escovacaoRotina,
        alt: 'Mão próxima à boca do cachorro, ilustrando a rotina de higiene oral orientada por veterinário',
      },
    },
    {
      title: 'Coloque o Veggiedent na rotina',
      body: 'Ofereça no momento que funcionar melhor para vocês dois, sempre respeitando o porte indicado na embalagem.',
      image: {
        src: veggiedentNaRotina,
        alt: 'Embalagem oficial do Veggiedent Fr3sh com selo N.1 de marca mais recomendada',
      },
    },
    {
      title: 'Não pule as consultas veterinárias',
      body: 'É o acompanhamento profissional que dá segurança para qualquer ajuste na rotina.',
      image: {
        src: consultasVeterinarias,
        alt: 'Médico-veterinário segurando um cão de porte pequeno no colo durante consulta',
      },
    },
  ],
}
