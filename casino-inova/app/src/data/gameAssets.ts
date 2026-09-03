/**
 * Mapas de imagem dos assets fatiados dos sheets gerados. O Metro exige `require`
 * com caminho estático, então tudo aqui é escrito literal — este arquivo foi gerado
 * a partir dos próprios arquivos em assets/, pra não errar nenhum dos 90+ caminhos.
 */

/** Baralho completo de 52 cartas, chave "naipe-rank" (ex: "copas-A"). */
export const CARD_IMAGES: Record<string, number> = {
  'copas-A': require('../../assets/images/cartas/baralho/copas-A.png'),
  'copas-2': require('../../assets/images/cartas/baralho/copas-2.png'),
  'copas-3': require('../../assets/images/cartas/baralho/copas-3.png'),
  'copas-4': require('../../assets/images/cartas/baralho/copas-4.png'),
  'copas-5': require('../../assets/images/cartas/baralho/copas-5.png'),
  'copas-6': require('../../assets/images/cartas/baralho/copas-6.png'),
  'copas-7': require('../../assets/images/cartas/baralho/copas-7.png'),
  'copas-8': require('../../assets/images/cartas/baralho/copas-8.png'),
  'copas-9': require('../../assets/images/cartas/baralho/copas-9.png'),
  'copas-10': require('../../assets/images/cartas/baralho/copas-10.png'),
  'copas-J': require('../../assets/images/cartas/baralho/copas-J.png'),
  'copas-Q': require('../../assets/images/cartas/baralho/copas-Q.png'),
  'copas-K': require('../../assets/images/cartas/baralho/copas-K.png'),
  'ouros-A': require('../../assets/images/cartas/baralho/ouros-A.png'),
  'ouros-2': require('../../assets/images/cartas/baralho/ouros-2.png'),
  'ouros-3': require('../../assets/images/cartas/baralho/ouros-3.png'),
  'ouros-4': require('../../assets/images/cartas/baralho/ouros-4.png'),
  'ouros-5': require('../../assets/images/cartas/baralho/ouros-5.png'),
  'ouros-6': require('../../assets/images/cartas/baralho/ouros-6.png'),
  'ouros-7': require('../../assets/images/cartas/baralho/ouros-7.png'),
  'ouros-8': require('../../assets/images/cartas/baralho/ouros-8.png'),
  'ouros-9': require('../../assets/images/cartas/baralho/ouros-9.png'),
  'ouros-10': require('../../assets/images/cartas/baralho/ouros-10.png'),
  'ouros-J': require('../../assets/images/cartas/baralho/ouros-J.png'),
  'ouros-Q': require('../../assets/images/cartas/baralho/ouros-Q.png'),
  'ouros-K': require('../../assets/images/cartas/baralho/ouros-K.png'),
  'espadas-A': require('../../assets/images/cartas/baralho/espadas-A.png'),
  'espadas-2': require('../../assets/images/cartas/baralho/espadas-2.png'),
  'espadas-3': require('../../assets/images/cartas/baralho/espadas-3.png'),
  'espadas-4': require('../../assets/images/cartas/baralho/espadas-4.png'),
  'espadas-5': require('../../assets/images/cartas/baralho/espadas-5.png'),
  'espadas-6': require('../../assets/images/cartas/baralho/espadas-6.png'),
  'espadas-7': require('../../assets/images/cartas/baralho/espadas-7.png'),
  'espadas-8': require('../../assets/images/cartas/baralho/espadas-8.png'),
  'espadas-9': require('../../assets/images/cartas/baralho/espadas-9.png'),
  'espadas-10': require('../../assets/images/cartas/baralho/espadas-10.png'),
  'espadas-J': require('../../assets/images/cartas/baralho/espadas-J.png'),
  'espadas-Q': require('../../assets/images/cartas/baralho/espadas-Q.png'),
  'espadas-K': require('../../assets/images/cartas/baralho/espadas-K.png'),
  'paus-A': require('../../assets/images/cartas/baralho/paus-A.png'),
  'paus-2': require('../../assets/images/cartas/baralho/paus-2.png'),
  'paus-3': require('../../assets/images/cartas/baralho/paus-3.png'),
  'paus-4': require('../../assets/images/cartas/baralho/paus-4.png'),
  'paus-5': require('../../assets/images/cartas/baralho/paus-5.png'),
  'paus-6': require('../../assets/images/cartas/baralho/paus-6.png'),
  'paus-7': require('../../assets/images/cartas/baralho/paus-7.png'),
  'paus-8': require('../../assets/images/cartas/baralho/paus-8.png'),
  'paus-9': require('../../assets/images/cartas/baralho/paus-9.png'),
  'paus-10': require('../../assets/images/cartas/baralho/paus-10.png'),
  'paus-J': require('../../assets/images/cartas/baralho/paus-J.png'),
  'paus-Q': require('../../assets/images/cartas/baralho/paus-Q.png'),
  'paus-K': require('../../assets/images/cartas/baralho/paus-K.png'),
};

/** Baralho de truco: 40 cartas, sem 8, 9 e 10. */
export const TRUCO_CARD_IMAGES: Record<string, number> = {
  'copas-A': require('../../assets/images/cartas/truco/copas-A.png'),
  'copas-2': require('../../assets/images/cartas/truco/copas-2.png'),
  'copas-3': require('../../assets/images/cartas/truco/copas-3.png'),
  'copas-4': require('../../assets/images/cartas/truco/copas-4.png'),
  'copas-5': require('../../assets/images/cartas/truco/copas-5.png'),
  'copas-6': require('../../assets/images/cartas/truco/copas-6.png'),
  'copas-7': require('../../assets/images/cartas/truco/copas-7.png'),
  'copas-J': require('../../assets/images/cartas/truco/copas-J.png'),
  'copas-Q': require('../../assets/images/cartas/truco/copas-Q.png'),
  'copas-K': require('../../assets/images/cartas/truco/copas-K.png'),
  'ouros-A': require('../../assets/images/cartas/truco/ouros-A.png'),
  'ouros-2': require('../../assets/images/cartas/truco/ouros-2.png'),
  'ouros-3': require('../../assets/images/cartas/truco/ouros-3.png'),
  'ouros-4': require('../../assets/images/cartas/truco/ouros-4.png'),
  'ouros-5': require('../../assets/images/cartas/truco/ouros-5.png'),
  'ouros-6': require('../../assets/images/cartas/truco/ouros-6.png'),
  'ouros-7': require('../../assets/images/cartas/truco/ouros-7.png'),
  'ouros-J': require('../../assets/images/cartas/truco/ouros-J.png'),
  'ouros-Q': require('../../assets/images/cartas/truco/ouros-Q.png'),
  'ouros-K': require('../../assets/images/cartas/truco/ouros-K.png'),
  'espadas-A': require('../../assets/images/cartas/truco/espadas-A.png'),
  'espadas-2': require('../../assets/images/cartas/truco/espadas-2.png'),
  'espadas-3': require('../../assets/images/cartas/truco/espadas-3.png'),
  'espadas-4': require('../../assets/images/cartas/truco/espadas-4.png'),
  'espadas-5': require('../../assets/images/cartas/truco/espadas-5.png'),
  'espadas-6': require('../../assets/images/cartas/truco/espadas-6.png'),
  'espadas-7': require('../../assets/images/cartas/truco/espadas-7.png'),
  'espadas-J': require('../../assets/images/cartas/truco/espadas-J.png'),
  'espadas-Q': require('../../assets/images/cartas/truco/espadas-Q.png'),
  'espadas-K': require('../../assets/images/cartas/truco/espadas-K.png'),
  'paus-A': require('../../assets/images/cartas/truco/paus-A.png'),
  'paus-2': require('../../assets/images/cartas/truco/paus-2.png'),
  'paus-3': require('../../assets/images/cartas/truco/paus-3.png'),
  'paus-4': require('../../assets/images/cartas/truco/paus-4.png'),
  'paus-5': require('../../assets/images/cartas/truco/paus-5.png'),
  'paus-6': require('../../assets/images/cartas/truco/paus-6.png'),
  'paus-7': require('../../assets/images/cartas/truco/paus-7.png'),
  'paus-J': require('../../assets/images/cartas/truco/paus-J.png'),
  'paus-Q': require('../../assets/images/cartas/truco/paus-Q.png'),
  'paus-K': require('../../assets/images/cartas/truco/paus-K.png'),
};

export const CARD_BACK_IMAGE = require('../../assets/images/cartas/verso-carta.jpg');

/** As 28 peças do dominó double-six, chave "menor-maior" (ex: "2-5"). */
export const DOMINO_TILE_IMAGES: Record<string, number> = {
  '0-0': require('../../assets/images/domino/pecas/0-0.png'),
  '0-1': require('../../assets/images/domino/pecas/0-1.png'),
  '0-2': require('../../assets/images/domino/pecas/0-2.png'),
  '0-3': require('../../assets/images/domino/pecas/0-3.png'),
  '0-4': require('../../assets/images/domino/pecas/0-4.png'),
  '0-5': require('../../assets/images/domino/pecas/0-5.png'),
  '0-6': require('../../assets/images/domino/pecas/0-6.png'),
  '1-1': require('../../assets/images/domino/pecas/1-1.png'),
  '1-2': require('../../assets/images/domino/pecas/1-2.png'),
  '1-3': require('../../assets/images/domino/pecas/1-3.png'),
  '1-4': require('../../assets/images/domino/pecas/1-4.png'),
  '1-5': require('../../assets/images/domino/pecas/1-5.png'),
  '1-6': require('../../assets/images/domino/pecas/1-6.png'),
  '2-2': require('../../assets/images/domino/pecas/2-2.png'),
  '2-3': require('../../assets/images/domino/pecas/2-3.png'),
  '2-4': require('../../assets/images/domino/pecas/2-4.png'),
  '2-5': require('../../assets/images/domino/pecas/2-5.png'),
  '2-6': require('../../assets/images/domino/pecas/2-6.png'),
  '3-3': require('../../assets/images/domino/pecas/3-3.png'),
  '3-4': require('../../assets/images/domino/pecas/3-4.png'),
  '3-5': require('../../assets/images/domino/pecas/3-5.png'),
  '3-6': require('../../assets/images/domino/pecas/3-6.png'),
  '4-4': require('../../assets/images/domino/pecas/4-4.png'),
  '4-5': require('../../assets/images/domino/pecas/4-5.png'),
  '4-6': require('../../assets/images/domino/pecas/4-6.png'),
  '5-5': require('../../assets/images/domino/pecas/5-5.png'),
  '5-6': require('../../assets/images/domino/pecas/5-6.png'),
  '6-6': require('../../assets/images/domino/pecas/6-6.png'),
};

export const DOMINO_TILE_BACK = require('../../assets/images/domino/pecas-domino-verso.png');

/** Faces do dado da marca, 1 a 6. */
export const DIE_FACE_IMAGES: Record<number, number> = {
  1: require('../../assets/images/dados/marca/face-1.png'),
  2: require('../../assets/images/dados/marca/face-2.png'),
  3: require('../../assets/images/dados/marca/face-3.png'),
  4: require('../../assets/images/dados/marca/face-4.png'),
  5: require('../../assets/images/dados/marca/face-5.png'),
  6: require('../../assets/images/dados/marca/face-6.png'),
};

/**
 * Dado do Bac Bo em 6 faces + o quadro borrado da rolagem. As seis faces foram
 * geradas com o dado exatamente na mesma posição (conferido: 0px de variação), então
 * dá pra trocar em sequência rápida que a animação não treme.
 */
export const BACBO_DIE_IMAGES: Record<number, number> = {
  1: require('../../assets/images/bacbo/bacbo-dado-face-1.png'),
  2: require('../../assets/images/bacbo/bacbo-dado-face-2.png'),
  3: require('../../assets/images/bacbo/bacbo-dado-face-3.png'),
  4: require('../../assets/images/bacbo/bacbo-dado-face-4.png'),
  5: require('../../assets/images/bacbo/bacbo-dado-face-5.png'),
  6: require('../../assets/images/bacbo/bacbo-dado-face-6.png'),
};

export const BACBO_DIE_BLURRED = require('../../assets/images/bacbo/bacbo-dado-borrado.png');
export const BACBO_SHAKER = {
  vazio: require('../../assets/images/bacbo/bacbo-agitador-vazio.png'),
  player: require('../../assets/images/bacbo/bacbo-agitador-brilho-player.png'),
  banker: require('../../assets/images/bacbo/bacbo-agitador-brilho-banker.png'),
};

/** Ícones de careta do truco — a chave é o `id` do sinal em truco.config.ts. */
export const TRUCO_SIGNAL_IMAGES: Record<string, number> = {
  zap: require('../../assets/images/sinais/icones/zap.png'),
  copas: require('../../assets/images/sinais/icones/copas.png'),
  espadilha: require('../../assets/images/sinais/icones/espadilha.png'),
  ourito: require('../../assets/images/sinais/icones/ourito.png'),
  'duas-manilhas': require('../../assets/images/sinais/icones/duas-manilhas.png'),
  'mao-boa': require('../../assets/images/sinais/icones/mao-boa.png'),
  'mao-ruim': require('../../assets/images/sinais/icones/mao-ruim.png'),
  'pede-truco': require('../../assets/images/sinais/icones/pede-truco.png'),
  'nao-pede': require('../../assets/images/sinais/icones/nao-pede.png'),
};

/** Molduras e marcadores do placar de histórico. */
export const ROADMAP_IMAGES = {
  painelGrande: require('../../assets/images/placar/placar-painel-grande.png'),
  painelPequeno: require('../../assets/images/placar/placar-painel-pequeno.png'),
  legenda: require('../../assets/images/placar/placar-legenda.png'),
};

/**
 * As contas do placar — os marcadores de vidro que vão nas casas da grade.
 *
 * Isto é arte, não desenho de código. Uma versão anterior deste app fazia os
 * marcadores com View e borda arredondada e deixava estes dezesseis arquivos parados
 * na pasta, com um comentário explicando que era melhor assim. Não era: um círculo
 * chapado de CSS ao lado de uma moldura dourada com brasão não parece a mesma mesa.
 */
export const MARCADORES_DO_PLACAR = {
  banca: require('../../assets/images/placar/marcadores/banca.png'),
  jogador: require('../../assets/images/placar/marcadores/jogador.png'),
  empate: require('../../assets/images/placar/marcadores/empate.png'),
  bancaPar: require('../../assets/images/placar/marcadores/banca-par.png'),
  jogadorPar: require('../../assets/images/placar/marcadores/jogador-par.png'),
  bancaVazado: require('../../assets/images/placar/marcadores/banca-vazado.png'),
  jogadorVazado: require('../../assets/images/placar/marcadores/jogador-vazado.png'),
  quadradoVermelho: require('../../assets/images/placar/marcadores/quadrado-vermelho.png'),
  quadradoAzul: require('../../assets/images/placar/marcadores/quadrado-azul.png'),
  riscoVermelho: require('../../assets/images/placar/marcadores/risco-vermelho.png'),
  riscoAzul: require('../../assets/images/placar/marcadores/risco-azul.png'),
  riscoVerde: require('../../assets/images/placar/marcadores/risco-verde.png'),
  trianguloCima: require('../../assets/images/placar/marcadores/triangulo-cima.png'),
  trianguloBaixo: require('../../assets/images/placar/marcadores/triangulo-baixo.png'),
  anelAtual: require('../../assets/images/placar/marcadores/anel-atual.png'),
  atualDourado: require('../../assets/images/placar/marcadores/atual-dourado.png'),
} as const;

/** Visual do Stock Market. */
export const STOCK_IMAGES = {
  painelGrafico: require('../../assets/images/stock/stock-painel-grafico.png'),
  botaoAlta: require('../../assets/images/stock/botoes/alta.png'),
  botaoAltaAceso: require('../../assets/images/stock/botoes/alta-aceso.png'),
  botaoBaixa: require('../../assets/images/stock/botoes/baixa.png'),
  botaoBaixaAceso: require('../../assets/images/stock/botoes/baixa-aceso.png'),
  tickerAlta: require('../../assets/images/stock/ticker/alta.png'),
  tickerBaixa: require('../../assets/images/stock/ticker/baixa.png'),
  tickerNeutro: require('../../assets/images/stock/ticker/neutro.png'),
  tickerExtremo: require('../../assets/images/stock/ticker/extremo.png'),
};

/** Ícones de chat. */
export const CHAT_ICONS = {
  chat: require('../../assets/images/icones/chat/chat.png'),
  dupla: require('../../assets/images/icones/chat/chat-dupla.png'),
  mudo: require('../../assets/images/icones/chat/chat-mudo.png'),
  aviso: require('../../assets/images/icones/chat/aviso.png'),
};
