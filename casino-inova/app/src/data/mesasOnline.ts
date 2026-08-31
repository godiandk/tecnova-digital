/**
 * As mesas de jogo, em formato deitado.
 *
 * São a arte própria do CASINO INOVA, 1600x900, com as áreas de aposta, o sapato, o
 * descarte e os dizeres já desenhados no pano. É por causa disso que as posições das
 * cartas e das fichas neste app são medidas EM CIMA desta arte, em pixel de 1600x900:
 * assim a ficha cai dentro do círculo pintado, em qualquer tamanho de tela.
 */
export const MESAS_ONLINE: Record<string, number> = {
  slots: require('../../assets/images/mesas-online/mesa-slots.jpg'),
  roleta: require('../../assets/images/mesas-online/mesa-roleta.jpg'),
  blackjack: require('../../assets/images/mesas-online/mesa-blackjack.jpg'),
  bacara: require('../../assets/images/mesas-online/mesa-bacara.jpg'),
  'bac-bo': require('../../assets/images/mesas-online/mesa-bac-bo.jpg'),
  'stock-market': require('../../assets/images/mesas-online/mesa-stock-market.jpg'),
  'banca-francesa': require('../../assets/images/mesas-online/mesa-banca-francesa.jpg'),
  truco: require('../../assets/images/mesas-online/mesa-truco.jpg'),
  domino: require('../../assets/images/mesas-online/mesa-domino.jpg'),
  poker: require('../../assets/images/mesas-online/mesa-poker.jpg'),
};

/** O tamanho em que a arte foi desenhada. Toda medida de posição parte daqui. */
export const ARTE = { largura: 1600, altura: 900 } as const;

/**
 * Onde ficam as coisas na mesa de blackjack, medido na arte.
 *
 * As sete casas seguem o arco pintado, da esquerda pra direita. A nossa mesa usa uma
 * casa só por enquanto (a do meio), mas as sete estão aqui porque o arco existe no pano
 * e é pra elas que a mesa cresce quando entrar mais gente.
 */
export const BLACKJACK = {
  cartasDoDealer: { x: 810, y: 285 },
  totalDoDealer: { x: 947, y: 314 },
  casas: [
    { x: 300, y: 462 },
    { x: 437, y: 547 },
    { x: 590, y: 617 },
    { x: 793, y: 635 },
    { x: 963, y: 612 },
    { x: 1140, y: 545 },
    { x: 1287, y: 462 },
  ],
  /** A casa que o jogador sozinho ocupa: a do meio do arco. */
  minhaCasa: 3,
  /** As cartas da mão ficam acima da casa; a ficha, dentro dela. */
  recuoDasCartas: -126,
  /** Onde a barra de controles do app começa, em altura da arte. */
  alturaDoPano: 720,
} as const;
