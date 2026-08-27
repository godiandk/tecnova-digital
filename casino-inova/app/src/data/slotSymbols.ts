/**
 * Os nove símbolos do caça-níqueis, recortados de simbolos-slot.png.
 *
 * A chave é o id que o SERVIDOR manda no resultado do giro — trocar um nome aqui sem
 * trocar em server/src/modules/games/slots/slots.config.ts quebra o sorteio na tela.
 */
export const SLOT_SYMBOLS: Record<string, number> = {
  sete: require('../../assets/images/slots/simbolos/simbolo-sete.png'),
  sino: require('../../assets/images/slots/simbolos/simbolo-sino.png'),
  ferradura: require('../../assets/images/slots/simbolos/simbolo-ferradura.png'),
  barras: require('../../assets/images/slots/simbolos/simbolo-barras.png'),
  diamante: require('../../assets/images/slots/simbolos/simbolo-diamante.png'),
  coroa: require('../../assets/images/slots/simbolos/simbolo-coroa.png'),
  moeda: require('../../assets/images/slots/simbolos/simbolo-moeda.png'),
  estrela: require('../../assets/images/slots/simbolos/simbolo-estrela.png'),
  jackpot: require('../../assets/images/slots/simbolos/simbolo-jackpot.png'),
};

export const IDS_DOS_SIMBOLOS = Object.keys(SLOT_SYMBOLS);
