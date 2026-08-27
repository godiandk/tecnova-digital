import { COMMISSION, MAX_CHANGE_PERCENT, StockDirection, TICKS_PER_ROUND } from './stock-market.config';

export interface StockBet {
  direction: StockDirection;
  amount: number;
}

export interface StockRound {
  /** O caminho que a cotação fez, em pontos percentuais, ponto a ponto (pro gráfico). */
  path: number[];
  /** Onde fechou, em pontos percentuais, entre -100 e +100. */
  closePercent: number;
}

export interface StockBetResult extends StockBet {
  closePercent: number;
  /** Antes da comissão — o que a simetria do jogo devolve. */
  grossReturn: number;
  commission: number;
  totalReturn: number;
}

/**
 * Passeio aleatório simétrico: cada passo sobe ou desce por um valor sorteado, e o
 * caminho é preso na faixa [-100, +100]. A distribuição é simétrica de propósito —
 * subir e descer são igualmente prováveis, e a casa não torce por lado nenhum.
 *
 * Vale reforçar: mesmo que a distribuição fosse outra, o RTP continuaria 99%, porque
 * o pagamento é linear e simétrico no movimento (ver verify-rtp.ts). Nada aqui está
 * calibrado pra fazer o jogador perder — a única vantagem da casa é a comissão.
 */
export function runRound(random: () => number = Math.random): StockRound {
  const path: number[] = [0];
  let current = 0;

  for (let tick = 0; tick < TICKS_PER_ROUND; tick += 1) {
    // Passo simétrico em torno de zero: mesma chance de subir e de descer.
    const step = (random() * 2 - 1) * (MAX_CHANGE_PERCENT / 8);
    current = Math.max(-MAX_CHANGE_PERCENT, Math.min(MAX_CHANGE_PERCENT, current + step));
    path.push(Number(current.toFixed(2)));
  }

  return { path, closePercent: path[path.length - 1] };
}

/**
 * Quem apostou em ALTA recebe (1 + fechamento/100) vezes a aposta; quem apostou em
 * BAIXA recebe (1 - fechamento/100). Fechou em +25%: a alta leva 1,25x e a baixa
 * 0,75x. Fechou em -40%: a alta leva 0,60x e a baixa 1,40x.
 *
 * Repare que os dois multiplicadores somam sempre 2 — é isso que faz o jogo ser de
 * soma zero antes da comissão, e é de onde sai o RTP de 99% exato.
 */
export function resolveBet(round: StockRound, bet: StockBet): StockBetResult {
  const signedChange = bet.direction === 'alta' ? round.closePercent : -round.closePercent;
  const multiplier = 1 + signedChange / 100;

  const grossReturn = bet.amount * multiplier;
  const commission = grossReturn * COMMISSION;
  const totalReturn = Math.floor(grossReturn - commission);

  return {
    ...bet,
    closePercent: round.closePercent,
    grossReturn: Number(grossReturn.toFixed(2)),
    commission: Number(commission.toFixed(2)),
    totalReturn,
  };
}

/**
 * RTP exato: 1 - comissão. Não depende da distribuição do movimento, nem da direção
 * escolhida, nem do tamanho da aposta — a prova está em verify-rtp.ts.
 */
export function theoreticalRtp(): number {
  return 1 - COMMISSION;
}
