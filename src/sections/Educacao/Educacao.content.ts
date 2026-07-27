// Fonte: Copy Deck v2.0, secao 3.
import type { EducacaoContent } from './Educacao.types'
import tartaroAlerta from '../../assets/images/educacao/tartaro-alerta.jpg'
import sinaisMauHalito from '../../assets/images/educacao/sinais-mau-halito.jpg'
import prevencaoDiaria from '../../assets/images/educacao/prevencao-diaria.jpg'

export const educacaoContent: EducacaoContent = {
  heading: 'Por que a saúde oral do seu cachorro importa',
  intro:
    'A boca do seu cachorro muda aos poucos. Ninguém percebe de um dia para o outro: placa e tártaro se acumulam devagar, até que um dia o hálito muda ou a mordida parece diferente. A boa notícia é que dá para ficar de olho nisso com hábitos simples, no dia a dia. E o médico-veterinário do seu cachorro é sempre o ponto de partida para saber o que faz sentido no caso dele.',
  cards: [
    {
      title: 'Devagar, mas sempre',
      body: 'Tártaro não aparece do dia para a noite. Por isso, um cuidado constante vale mais do que uma ação isolada de vez em quando.',
      image: {
        src: tartaroAlerta,
        alt: 'Cachorro deitado observando de perto, ilustrando o acúmulo silencioso de tártaro',
      },
    },
    {
      title: 'Sinais que valem atenção',
      body: 'Hálito diferente, desconforto ao mastigar, mudança na hora de comer. Vale conversar com o veterinário quando notar qualquer um desses sinais.',
      image: {
        src: sinaisMauHalito,
        alt: 'Ilustração oficial Virbac sobre o mau hálito como primeiro sinal de acúmulo de placa e tártaro',
      },
    },
    {
      title: 'Prevenção no dia a dia',
      body: 'Escovação, petiscos funcionais e visitas regulares ao veterinário formam a base de uma boa rotina bucal.',
      image: {
        src: prevencaoDiaria,
        alt: 'Embalagem de Veggiedent Fr3sh com a mensagem oficial "a prevenção deve ser diária"',
      },
    },
  ],
}
