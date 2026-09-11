import { NIVEIS_DE_MESA, type NivelDeMesa } from '../games/shared/niveis-de-mesa';
import { bonusDeNivel } from '../recompensas/calendario';

/**
 * OS PACOTES DA LOJA — quanto de ficha cada preço compra.
 *
 * O QUE ESTAVA ERRADO, medido: os pacotes eram quatro números fixos (5.000, 15.000,
 * 40.000 e 120.000 fichas), iguais para todo mundo, enquanto a mesa em que a pessoa joga
 * multiplica por dez a cada degrau. O resultado é que o MAIOR pacote pago comprava:
 *
 *   Bronze    2.400 apostas mínimas  (uma banca inteira)
 *   Ouro         24 apostas mínimas
 *   Diamante      2 apostas mínimas
 *   Rubi          0 apostas mínimas  (nem uma)
 *
 * Acima do Ouro a loja deixava de ter função econômica: R$ 149,90 compravam duas rodadas.
 * Não é caro nem barato — é irrelevante, que é pior.
 *
 * A REGRA NOVA, em uma linha:
 *
 *   fichas = k(preço) × mínimo(degrau econômico) × bônus de nível
 *
 * `k` é QUANTAS APOSTAS MÍNIMAS o preço compra, e é a única coisa que o preço decide. Foi
 * calibrado para não tirar nada de quem já joga: no Bronze os quatro pacotes entregam
 * exatamente o que entregavam antes.
 *
 * E O DEGRAU É O ECONÔMICO — `min(o que o saldo banca, o que o nível liberou)`. É essa
 * palavra que impede a loja de virar uma catraca: comprar aumenta o saldo, saldo maior
 * subiria o degrau, degrau maior aumentaria o pacote seguinte. Com o freio do nível, o
 * degrau só sobe jogando, e a espiral não fecha. Sem ele, medido: R$ 149,90 por mês
 * subiriam um degrau por mês, e R$ 1.800 chegariam ao Eclipse em um ano — ponto em que
 * não sobra nada para comprar.
 *
 * O BÔNUS DE NÍVEL É O MESMO DA RECOMPENSA DIÁRIA, de propósito: `1 + 0,5 × log10(nível)`,
 * teto 3×. Dois bônus diferentes para a mesma ideia ("tempo de casa vale alguma coisa")
 * seriam duas curvas para manter alinhadas, e uma delas acabaria esquecida.
 */

export interface PrecoDoPacote {
  /** Quantas apostas mínimas este preço compra. É a única coisa que o preço decide. */
  k: number;
  /**
   * O preço em cada moeda, em CENTAVOS e inteiro.
   *
   * Centavos porque dinheiro perto de ponto flutuante é como o extrato vira 9,899999. E
   * uma tabela por moeda, e não uma conversão de câmbio: R$ 9,90 e US$ 1,99 não são o
   * mesmo valor convertido, são dois preços escolhidos para cada mercado — e a loja da
   * Apple e a do Google exigem justamente isso, um preço por região.
   */
  precos: Record<Moeda, number>;
}

export const MOEDAS = ['BRL', 'USD', 'EUR'] as const;
export type Moeda = (typeof MOEDAS)[number];

export const MOEDA_PADRAO: Moeda = 'BRL';

/**
 * Os quatro degraus de preço.
 *
 * `k` calibrado no Bronze (mínimo 50) contra os pacotes de antes:
 *   100 × 50 = 5.000 · 300 × 50 = 15.000 · 800 × 50 = 40.000 · 2.400 × 50 = 120.000
 */
export const PRECOS: Record<string, PrecoDoPacote> = {
  bronze: { k: 100, precos: { BRL: 990, USD: 199, EUR: 199 } },
  prata: { k: 300, precos: { BRL: 2_490, USD: 499, EUR: 499 } },
  ouro: { k: 800, precos: { BRL: 5_990, USD: 1_199, EUR: 1_199 } },
  diamante: { k: 2_400, precos: { BRL: 14_990, USD: 2_999, EUR: 2_999 } },
};

export interface PacoteOferecido {
  id: string;
  /** Quantas fichas entram na carteira, já com o bônus de nível. */
  chips: number;
  /** Quantas apostas mínimas isso compra na mesa da pessoa. É o número que importa. */
  apostasMinimas: number;
  moeda: Moeda;
  precoEmCentavos: number;
  precoEscrito: string;
  /** O degrau usado na conta, para a tela poder dizer de que mesa está falando. */
  degrau: { id: string; nome: string; minimo: number };
  /** Quanto o nível acrescentou, para a tela mostrar o que a progressão rendeu. */
  bonusDeNivel: number;
  /** Fichas que a promoção acrescentou por cima. Zero quando não há promoção. */
  bonusDePromocao: number;
  promocao?: { id: string; nome: string; bonusPercent: number; terminaEm: string };
}

/**
 * Quantas fichas um pacote entrega para esta pessoa.
 *
 * Sai inteiro sempre: ficha não se parte, e o livro-caixa é de inteiros.
 */
export function fichasDoPacote(k: number, degrau: NivelDeMesa, nivelDoJogador: number): number {
  return Math.round(k * degrau.minimo * bonusDeNivel(nivelDoJogador));
}

const SIMBOLO: Record<Moeda, string> = { BRL: 'R$', USD: 'US$', EUR: '€' };
const LOCALIDADE: Record<Moeda, string> = { BRL: 'pt-BR', USD: 'en-US', EUR: 'de-DE' };

export function escreverPreco(centavos: number, moeda: Moeda): string {
  const valor = (centavos / 100).toLocaleString(LOCALIDADE[moeda], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${SIMBOLO[moeda]} ${valor}`;
}

/** A moeda é do pedido, e cai no padrão quando vier coisa que não conhecemos. */
export function moedaValida(valor: string | undefined): Moeda {
  const m = (valor ?? '').toUpperCase();
  return (MOEDAS as readonly string[]).includes(m) ? (m as Moeda) : MOEDA_PADRAO;
}

/** O degrau Bronze, que é a referência quando não há jogador (a vitrine pública). */
export const DEGRAU_DE_VITRINE = NIVEIS_DE_MESA[0];
