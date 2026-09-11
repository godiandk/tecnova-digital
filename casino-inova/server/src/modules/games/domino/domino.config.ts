/** Jogo de dominó "block" clássico (double-six): 28 peças, sem comprar do monte quando não tem jogada — só passa a vez. */
export interface Tile {
  a: number;
  b: number;
}

export function buildTileSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) {
      tiles.push({ a, b });
    }
  }
  return tiles;
}

export const HAND_SIZE = 7;
/**
 * O BUY-IN NÃO É MAIS UM PAR DE NÚMEROS FIXOS. Era `100 a 5.000`, igual pra quem acabou de
 * criar a conta e pra quem tem cinco quatrilhões — e a mesa entre jogadores era o único
 * canto do jogo que ignorava a escada de degraus inteira.
 *
 * Agora a faixa sai do degrau econômico de quem vai sentar: ver `faixaDeEntrada` e
 * `problemaComAEntrada` em `games/shared/niveis-de-mesa.ts`. As constantes foram embora
 * em vez de virarem valor padrão, porque um padrão silencioso aqui é exatamente como o
 * defeito durou tanto: o número existia, parecia certo, e ninguém o lia contra o saldo.
 */
/** A partida inteira (até alguém bater ou o jogo travar) vale como uma aposta só, igual ao truco. */
export const MATCH_WIN_TOTAL_MULTIPLIER = 2;
