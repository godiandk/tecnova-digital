/**
 * Os tampos 16:9 para tablet e computador, um por jogo.
 *
 * Como em tableImages.ts, o Metro exige `require` com caminho estático, então o mapa é
 * escrito à mão. As chaves são os mesmos `id` de games.ts.
 *
 * As duas resoluções são a MESMA composição — 1920x1080 e 1600x900 têm a proporção
 * igual, sem deformação. Trocar uma pela outra só muda quantos pixels chegam na tela,
 * nunca onde as coisas estão na mesa. É isso que deixa a ancoragem por fração
 * (ver naMesa, em TampoDaMesa.tsx) valer nas duas.
 */
export interface TampoDoJogo {
  computador: number;
  tablet: number;
}

export const TAMPOS_16X9: Record<string, TampoDoJogo> = {
  slots: {
    computador: require('../../assets/images/tampos-16x9/computador/slots.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/slots.webp'),
  },
  roleta: {
    computador: require('../../assets/images/tampos-16x9/computador/roleta.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/roleta.webp'),
  },
  blackjack: {
    computador: require('../../assets/images/tampos-16x9/computador/blackjack.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/blackjack.webp'),
  },
  bacara: {
    computador: require('../../assets/images/tampos-16x9/computador/bacara.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/bacara.webp'),
  },
  'bac-bo': {
    computador: require('../../assets/images/tampos-16x9/computador/bac-bo.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/bac-bo.webp'),
  },
  'stock-market': {
    computador: require('../../assets/images/tampos-16x9/computador/stock-market.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/stock-market.webp'),
  },
  'banca-francesa': {
    computador: require('../../assets/images/tampos-16x9/computador/banca-francesa.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/banca-francesa.webp'),
  },
  truco: {
    computador: require('../../assets/images/tampos-16x9/computador/truco.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/truco.webp'),
  },
  domino: {
    computador: require('../../assets/images/tampos-16x9/computador/domino.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/domino.webp'),
  },
  poker: {
    computador: require('../../assets/images/tampos-16x9/computador/poker.webp'),
    tablet: require('../../assets/images/tampos-16x9/tablet/poker.webp'),
  },
};
