import { CartaComNaipe, Naipe, NAIPES } from './naipes';
import { fracao } from './rng';

/**
 * A sapata: oito baralhos de 52 cartas embaralhados juntos, distribuídos SEM reposição,
 * com cartão de corte — que é como a mesa de blackjack e de bacará funciona de verdade.
 *
 * Antes, blackjack e bacará sorteavam cada carta com reposição, de um baralho "infinito".
 * Era honesto e o RTP era calculável, mas não era o jogo: num baralho infinito nenhuma
 * carta acaba, tirar um Ás não deixa o próximo Ás mais raro, e a mesa nunca embaralha.
 * A diferença aparece nos números — o bacará de baralho infinito dava 98,68% no jogador
 * contra os 98,76% da sapata de 8 — e aparece no jogo: sem remoção de carta, não existe
 * o efeito que faz a mão seguinte depender do que já saiu.
 *
 * Nada aqui é ajustável a favor da casa. A sapata é embaralhada uma vez, e depois só
 * entrega a carta de cima. Não existe "escolher a próxima carta" nesta classe, e é de
 * propósito: se existisse, existiria o lugar onde alguém poderia trapacear.
 */

/** Quantos baralhos vão na sapata. Oito é o padrão de blackjack e bacará de cassino. */
export const BARALHOS_NA_SAPATA = 8;

/**
 * Quanto da sapata é usado antes de embaralhar de novo. 0,75 = joga 75% e embaralha com
 * 25% ainda dentro — é onde o cartão de corte costuma ficar numa mesa de verdade.
 */
export const PENETRACAO = 0.75;

export class Sapata<R extends string> {
  private cartas: CartaComNaipe<R>[] = [];
  /** Onde o cartão de corte está: passou daqui, embaralha antes da próxima rodada. */
  private limite = 0;
  private embaralhadaAgora = false;

  constructor(
    private readonly valores: readonly R[],
    private readonly random: () => number = fracao,
    private readonly baralhos: number = BARALHOS_NA_SAPATA,
  ) {
    this.embaralhar();
  }

  /** Monta os baralhos do zero e embaralha. Chamado no começo e ao passar do corte. */
  embaralhar() {
    const novas: CartaComNaipe<R>[] = [];
    for (let baralho = 0; baralho < this.baralhos; baralho += 1) {
      for (const naipe of NAIPES) {
        for (const rank of this.valores) {
          novas.push({ rank, naipe: naipe as Naipe });
        }
      }
    }
    // Fisher-Yates: cada permutação com a mesma probabilidade. Não tem viés de posição.
    for (let i = novas.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [novas[i], novas[j]] = [novas[j], novas[i]];
    }
    this.cartas = novas;
    this.limite = Math.floor(novas.length * (1 - PENETRACAO));
    this.embaralhadaAgora = true;
  }

  /**
   * Embaralha se o cartão de corte já passou. Chamado ENTRE rodadas, nunca no meio de
   * uma: embaralhar com cartas na mesa mudaria o jogo em andamento.
   */
  embaralharSePassouDoCorte(): boolean {
    if (this.cartas.length > this.limite) return false;
    this.embaralhar();
    return true;
  }

  /** A carta de cima. Se a sapata acabar no meio de uma mão, embaralha pra não travar. */
  comprar(): CartaComNaipe<R> {
    if (this.cartas.length === 0) this.embaralhar();
    this.embaralhadaAgora = false;
    return this.cartas.pop()!;
  }

  comprarVarias(quantas: number): CartaComNaipe<R>[] {
    return Array.from({ length: quantas }, () => this.comprar());
  }

  /** Quantas cartas ainda dá pra jogar antes do corte — é o que a mesa mostra. */
  get cartasAteOCorte(): number {
    return Math.max(0, this.cartas.length - this.limite);
  }

  get cartasRestantes(): number {
    return this.cartas.length;
  }

  get foiEmbaralhadaAgora(): boolean {
    return this.embaralhadaAgora;
  }
}
