/**
 * O Metro (bundler do Expo/RN) exige `require(...)` com caminho estático — não dá
 * pra montar isso num loop a partir de `games.ts`, por isso o mapa é escrito à mão.
 * As chaves são os mesmos `id` de `games.ts`.
 */
export const TABLE_IMAGES: Record<string, number> = {
  slots: require('../../assets/images/mesas/caca-niquel-gabinete-fortuna.jpg'),
  roleta: require('../../assets/images/mesas/mesa-roleta.jpg'),
  blackjack: require('../../assets/images/mesas/mesa-blackjack.jpg'),
  bacara: require('../../assets/images/mesas/mesa-bacara.jpg'),
  'banca-francesa': require('../../assets/images/mesas/mesa-banca-francesa.jpg'),
  // As mesas próprias de Bac Bo e Stock Market ainda não foram geradas (estão nos
  // itens 2 e 32 de docs/prompt-COMPLETO-todas-imagens.md). Até chegarem, apontam
  // pra mesas parecidas — trocar aqui é uma linha quando as imagens existirem.
  'bac-bo': require('../../assets/images/mesas/mesa-bacara.jpg'),
  'stock-market': require('../../assets/images/mesas/mesa-roleta.jpg'),
  truco: require('../../assets/images/mesas/mesa-truco.jpg'),
  domino: require('../../assets/images/mesas/mesa-domino.jpg'),
  poker: require('../../assets/images/mesas/mesa-poker.jpg'),
};
