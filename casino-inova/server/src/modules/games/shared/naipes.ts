import { fracao } from './rng';
/**
 * Naipe pra desenhar a carta na tela.
 *
 * Blackjack e bacará têm baralho INFINITO de propósito: cada valor é sorteado com
 * reposição, não dá pra contar carta, e o naipe não entra em conta nenhuma. Os motores
 * dos dois, por isso, trabalham só com valor.
 *
 * Só que o app tem 52 imagens de carta, e desenhar uma delas sem que ela tenha sido
 * sorteada seria a tela mostrando uma carta que não saiu. Então o naipe é sorteado aqui,
 * no servidor, e mandado junto: a tela desenha a carta que saiu, e não uma parecida.
 *
 * `naipeLivre` evita só uma coisa: a mesma carta aparecer duas vezes na mesma rodada.
 * Repetir VALOR é normal e continua acontecendo (é o que baralho infinito faz), mas ver
 * dois K de ouros idênticos lado a lado parece defeito, e não regra. Isso não mexe em
 * probabilidade nenhuma — o valor já foi sorteado antes desta linha.
 */
export const NAIPES = ['copas', 'ouros', 'espadas', 'paus'] as const;
export type Naipe = (typeof NAIPES)[number];

/** Uma carta na mesa: o valor, que decide tudo, e o naipe, que só decide o desenho. */
export interface CartaComNaipe<R extends string> {
  rank: R;
  naipe: Naipe;
}

/** Um naipe que ainda não saiu com esse valor na mesa; qualquer um se todos já saíram. */
export function naipeLivre<R extends string>(rank: R, naMesa: CartaComNaipe<R>[]): Naipe {
  const usados = new Set(naMesa.filter((carta) => carta.rank === rank).map((carta) => carta.naipe));
  const livres = NAIPES.filter((naipe) => !usados.has(naipe));
  const opcoes = livres.length > 0 ? livres : NAIPES;
  return opcoes[Math.floor(fracao() * opcoes.length)];
}

/** O nome da imagem no app — 'copas-A', 'espadas-10'. */
export function nomeDaCarta<R extends string>(carta: CartaComNaipe<R>): string {
  return `${carta.naipe}-${carta.rank}`;
}

/**
 * Dá naipe a uma lista de valores já sorteada, sem repetir carta.
 *
 * É o caminho do bacará, onde o motor devolve a rodada inteira pronta: os valores já
 * estão decididos, e aqui só se escolhe como desenhar cada um.
 */
export function vestirDeNaipe<R extends string>(
  valores: R[],
  jaNaMesa: CartaComNaipe<R>[] = [],
): CartaComNaipe<R>[] {
  const mesa = [...jaNaMesa];
  return valores.map((rank) => {
    const carta = { rank, naipe: naipeLivre(rank, mesa) };
    mesa.push(carta);
    return carta;
  });
}
