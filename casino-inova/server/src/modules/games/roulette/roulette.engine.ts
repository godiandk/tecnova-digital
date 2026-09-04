import { colorOf, POCKET_COUNT, RouletteBet, TOTAL_MULTIPLIER } from './roulette.config';
import { fracao } from '../shared/rng';

/** Uma aposta com o valor dela — é assim que ela chega da mesa. */
export interface ApostaComValor extends RouletteBet {
  amount: number;
}

/** O que aconteceu com uma aposta depois que a bola parou. */
export interface ResultadoDaAposta extends ApostaComValor {
  won: boolean;
  totalReturn: number;
}

export function spinWheel(random: () => number = fracao): number {
  return Math.floor(random() * POCKET_COUNT);
}

/** 0 nunca é par, ímpar, vermelho, preto, baixo ou alto — regra padrão de roleta. */
export function isWinningBet(bet: RouletteBet, pocket: number): boolean {
  if (pocket === 0) {
    return bet.type === 'numero' && bet.number === 0;
  }

  switch (bet.type) {
    case 'numero':
      return bet.number === pocket;
    case 'vermelho':
      return colorOf(pocket) === 'vermelho';
    case 'preto':
      return colorOf(pocket) === 'preto';
    case 'par':
      return pocket % 2 === 0;
    case 'impar':
      return pocket % 2 === 1;
    case 'baixo':
      return pocket >= 1 && pocket <= 18;
    case 'alto':
      return pocket >= 19 && pocket <= 36;
    case 'duzia1':
      return pocket >= 1 && pocket <= 12;
    case 'duzia2':
      return pocket >= 13 && pocket <= 24;
    case 'duzia3':
      return pocket >= 25 && pocket <= 36;
    /*
     * As colunas: a fileira da mesa em que o número está impresso. A mesa tem três
     * fileiras de doze, e o número da casa diz em qual delas ele mora — 1, 4, 7... na
     * primeira (resto 1 da divisão por 3), 2, 5, 8... na segunda, e os múltiplos de 3
     * na terceira. O zero não está em fileira nenhuma, e já foi tratado lá em cima.
     */
    case 'coluna1':
      return pocket % 3 === 1;
    case 'coluna2':
      return pocket % 3 === 2;
    case 'coluna3':
      return pocket % 3 === 0;
    default:
      return false;
  }
}

/**
 * Julga TODAS as apostas da rodada contra a casa em que a bola parou.
 *
 * Uma bola, muitas apostas — que é como a roleta é jogada e como a mesa é desenhada.
 * Enquanto a rodada aceitava uma aposta só, a mesa não podia existir: dava pra apostar
 * "vermelho" OU "um número", nunca uma ficha no 17 e outra na 2ª dúzia, que é a jogada
 * mais comum que existe.
 *
 * Cada aposta é resolvida sozinha, com o pagamento dela. Não há interação entre elas:
 * apostar no 17 e no preto ao mesmo tempo paga as duas se o 17 sair, e o retorno é a
 * soma — nada é descontado por "já ter ganhado".
 */
export function resolverApostas(pocket: number, apostas: ApostaComValor[]): ResultadoDaAposta[] {
  return apostas.map((aposta) => {
    const won = isWinningBet(aposta, pocket);
    return { ...aposta, won, totalReturn: won ? aposta.amount * TOTAL_MULTIPLIER[aposta.type] : 0 };
  });
}

/**
 * RTP teórico: 36/37 (~97,30%) para QUALQUER tipo de aposta padrão — é uma
 * propriedade da roleta europeia (a vantagem da casa vem inteira da casa do zero,
 * não de pagamentos assimétricos), não algo ajustado por peso como no slot.
 * P(número) = 1/37, retorno 36x → EV = 36/37. P(vermelho) = 18/37, retorno 2x →
 * EV = 36/37. P(dúzia) = 12/37, retorno 3x → EV = 36/37. Sempre o mesmo valor.
 */
export function theoreticalRtp(): number {
  return (POCKET_COUNT - 1) / POCKET_COUNT;
}
