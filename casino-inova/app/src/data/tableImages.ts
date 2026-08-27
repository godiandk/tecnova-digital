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
  'bac-bo': require('../../assets/images/mesas/mesa-bac-bo.jpg'),
  'stock-market': require('../../assets/images/mesas/mesa-stock-market.jpg'),
  truco: require('../../assets/images/mesas/mesa-truco.jpg'),
  domino: require('../../assets/images/mesas/mesa-domino.jpg'),
  poker: require('../../assets/images/mesas/mesa-poker.jpg'),
};
