import { colorOf, POCKET_COUNT, RouletteBet, TOTAL_MULTIPLIER } from './roulette.config';

export interface SpinResult {
  pocket: number;
  color: ReturnType<typeof colorOf>;
  win: boolean;
  totalReturn: number;
}

export function spinWheel(random: () => number = Math.random): number {
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
    default:
      return false;
  }
}

export function spin(bet: RouletteBet, amount: number, random: () => number = Math.random): SpinResult {
  const pocket = spinWheel(random);
  const win = isWinningBet(bet, pocket);
  const totalReturn = win ? amount * TOTAL_MULTIPLIER[bet.type] : 0;
  return { pocket, color: colorOf(pocket), win, totalReturn };
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
