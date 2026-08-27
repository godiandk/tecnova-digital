export const DEALER_IMAGES = {
  blackjack: require('../../assets/images/dealers/dealer-blackjack.jpg'),
  roleta: require('../../assets/images/dealers/dealer-roleta.jpg'),
  bacara: require('../../assets/images/dealers/dealer-bacara.jpg'),
  poker: require('../../assets/images/dealers/dealer-poker.jpg'),
  slots: require('../../assets/images/dealers/anfitria-slots.png'),
  bancaFrancesaBanqueiro: require('../../assets/images/dealers/banca-francesa-banqueiro.jpg'),
  bancaFrancesaTirador: require('../../assets/images/dealers/banca-francesa-tirador.jpg'),
  bancaFrancesaApontador: require('../../assets/images/dealers/banca-francesa-apontador.jpg'),
  trucoDomino: require('../../assets/images/dealers/anfitriao-truco-domino.jpg'),
} as const;

/**
 * Quem aparece no destaque do salão, por jogo.
 *
 * O herói mostrava a foto da mesa recortada larga, e as fotos de mesa foram feitas em
 * formato de celular em pé — recortadas assim davam um campo de feltro vazio no meio.
 * A anfitriã ou o crupiê do jogo resolve: rosto olhando pra quem chega é o que salão de
 * cassino põe na entrada, e é a arte mais forte que o projeto já tem.
 *
 * Bac Bo e Stock Market ainda não têm figura e caem no cartaz do jogo — ver
 * docs/imagens-que-faltam.md.
 */
export const FIGURA_DO_DESTAQUE: Record<string, number> = {
  blackjack: DEALER_IMAGES.blackjack,
  roleta: DEALER_IMAGES.roleta,
  bacara: DEALER_IMAGES.bacara,
  poker: DEALER_IMAGES.poker,
  slots: DEALER_IMAGES.slots,
  'banca-francesa': DEALER_IMAGES.bancaFrancesaBanqueiro,
  truco: DEALER_IMAGES.trucoDomino,
  domino: DEALER_IMAGES.trucoDomino,
};
