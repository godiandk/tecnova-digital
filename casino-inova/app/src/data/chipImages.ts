/**
 * Uma ficha por cor de jogador nas mesas compartilhadas. A ordem e os nomes têm que
 * bater exatamente com PLAYER_COLORS em server/src/modules/rooms/player-colors.ts —
 * é o servidor que decide qual cor cada pessoa recebe ao sentar, o app só desenha.
 *
 * O Metro exige `require(...)` estático, por isso o mapa é escrito à mão.
 */
export const PLAYER_CHIP_IMAGES = {
  branco: require('../../assets/images/fichas/ficha-branco.png'),
  vermelho: require('../../assets/images/fichas/ficha-vermelho.png'),
  azul: require('../../assets/images/fichas/ficha-azul.png'),
  amarelo: require('../../assets/images/fichas/ficha-amarelo.png'),
  laranja: require('../../assets/images/fichas/ficha-laranja.png'),
  roxo: require('../../assets/images/fichas/ficha-roxo.png'),
  rosa: require('../../assets/images/fichas/ficha-rosa.png'),
  ciano: require('../../assets/images/fichas/ficha-ciano.png'),
  'verde-limao': require('../../assets/images/fichas/ficha-verde-limao.png'),
  marrom: require('../../assets/images/fichas/ficha-marrom.png'),
  'cinza-claro': require('../../assets/images/fichas/ficha-cinza-claro.png'),
  vinho: require('../../assets/images/fichas/ficha-vinho.png'),
  'azul-marinho': require('../../assets/images/fichas/ficha-azul-marinho.png'),
  coral: require('../../assets/images/fichas/ficha-coral.png'),
  lilas: require('../../assets/images/fichas/ficha-lilas.png'),
} as const;

export type PlayerColor = keyof typeof PLAYER_CHIP_IMAGES;

/** Nome legível da cor, pra leitor de tela e pra quando a imagem não carregar. */
export const PLAYER_COLOR_LABELS: Record<PlayerColor, string> = {
  branco: 'Branco',
  vermelho: 'Vermelho',
  azul: 'Azul',
  amarelo: 'Amarelo',
  laranja: 'Laranja',
  roxo: 'Roxo',
  rosa: 'Rosa',
  ciano: 'Ciano',
  'verde-limao': 'Verde-limão',
  marrom: 'Marrom',
  'cinza-claro': 'Cinza-claro',
  vinho: 'Vinho',
  'azul-marinho': 'Azul-marinho',
  coral: 'Coral',
  lilas: 'Lilás',
};
