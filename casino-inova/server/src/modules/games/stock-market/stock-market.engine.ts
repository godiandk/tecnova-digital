import { COMMISSION, MAX_CHANGE_PERCENT, StockDirection, TICKS_PER_ROUND } from './stock-market.config';
import { fracao } from '../shared/rng';

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
export function runRound(random: () => number = fracao): StockRound {
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
 * O PAGAMENTO, EM CONTA DE INTEIRO — sem ponto flutuante em dinheiro.
 *
 * Quem apostou em ALTA recebe (1 + fechamento/100) vezes a aposta; quem apostou em
 * BAIXA recebe (1 - fechamento/100). Fechou em +25%: a alta leva 1,25x e a baixa
 * 0,75x. Os dois multiplicadores somam sempre 2 — é isso que faz o jogo ser de soma
 * zero antes da comissão.
 *
 * POR QUE A CONTA MUDOU. A versão anterior fazia tudo em `number`:
 *
 *     const grossReturn = bet.amount * multiplier;      // 174.7449...
 *     const commission  = grossReturn * COMMISSION;     //   1.7474...
 *     const totalReturn = Math.floor(grossReturn - commission);   // 172
 *
 * e mostrava na tela `grossReturn.toFixed(2)` e `commission.toFixed(2)`. O jogador lia
 * "retorno 174,74 menos comissão 1,75", fazia a conta, chegava em 172,99 — e recebia
 * 172. Os números da tela não fechavam com o que entrava na carteira, e nenhum deles
 * estava errado sozinho: o erro era mostrar decimais de uma conta cujo resultado é
 * inteiro.
 *
 * E o `Math.floor` no fim tinha um efeito que ninguém declarou: ele fica com a fração
 * em TODA rodada, sempre pro mesmo lado. Isso é vantagem da casa além da comissão de
 * 1%, e desmentia o "RTP exato de 99%" escrito aqui em cima.
 *
 * COMO É AGORA. Tudo em centésimos de ponto percentual, com inteiros:
 *
 *   - o fechamento vira `pontos` (25,37% -> 2537)
 *   - o multiplicador vira `10000 + pontos` em partes de dez mil
 *   - o retorno bruto é `aposta × multiplicador ÷ 10000`
 *   - a comissão é 1% do bruto
 *
 * As duas divisões arredondam PARA O MAIS PRÓXIMO, e não pra baixo. É a política de
 * arredondamento do cassino: o resto cai metade pra cada lado, então ele não vira
 * vantagem de ninguém — diferente de truncar, que favorece a casa em toda rodada. A
 * regra fica escrita na tela junto do resultado.
 *
 * A conta usa BigInt porque `aposta × 10000` estoura o inteiro seguro do JavaScript a
 * partir de mais ou menos novecentos bilhões de fichas — e esta escada de mesas vai
 * muito além disso.
 */

/** Partes em que o multiplicador é medido. 10000 = 1,0000x. */
const PARTES_DO_MULTIPLICADOR = 10_000n;
/** A comissão, nas mesmas partes: 100 de 10000 = 1%. */
const PARTES_DA_COMISSAO = 100n;

/** Divide arredondando pro inteiro mais próximo (meio pra cima), em BigInt. */
function dividirArredondando(valor: bigint, divisor: bigint): bigint {
  return (valor * 2n + divisor) / (divisor * 2n);
}

export function resolveBet(round: StockRound, bet: StockBet): StockBetResult {
  const signedChange = bet.direction === 'alta' ? round.closePercent : -round.closePercent;

  /*
   * O fechamento tem duas casas decimais (o motor faz `toFixed(2)`), então multiplicar
   * por 100 e arredondar devolve o inteiro exato que ele representa — sem herdar o
   * erro do binário.
   */
  const pontos = BigInt(Math.round(signedChange * 100));
  const multiplicador = PARTES_DO_MULTIPLICADOR + pontos;

  const aposta = BigInt(bet.amount);
  const bruto = dividirArredondando(aposta * multiplicador, PARTES_DO_MULTIPLICADOR);
  const comissao = dividirArredondando(bruto * PARTES_DA_COMISSAO, PARTES_DO_MULTIPLICADOR);
  const liquido = bruto - comissao;

  return {
    ...bet,
    closePercent: round.closePercent,
    /* Os três já são fichas inteiras, e a conta fecha na tela: bruto − comissão = total. */
    grossReturn: Number(bruto),
    commission: Number(comissao),
    totalReturn: Number(liquido),
  };
}

/**
 * RTP exato: 1 - comissão. Não depende da distribuição do movimento, nem da direção
 * escolhida, nem do tamanho da aposta — a prova está em verify-rtp.ts.
 */
export function theoreticalRtp(): number {
  return 1 - COMMISSION;
}
