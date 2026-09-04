/**
 * QUANTO UM NÚMERO OCUPA DE LARGURA, em múltiplos do corpo da letra.
 *
 * Isto existe porque a Poppins **não tem dígitos de largura fixa**. Medido no próprio
 * arquivo da fonte (Poppins_700Bold.ttf), o "1" ocupa 0,376 do corpo e o "0" ocupa
 * 0,652 — quase o dobro. Então "1mi" e "500mi" têm o mesmo tanto de letras e larguras
 * bem diferentes: 1,73 contra 3,31.
 *
 * Era isso que cortava a chapa da ficha. O tamanho da letra era escolhido por uma
 * tabela de CONTAGEM DE LETRAS, que trata "1mi" e "500mi" como iguais; o "500mi" não
 * cabia e a tela o entregava como "50…" — que é pior do que abreviar, porque quem lê
 * não sabe se são cinquenta ou quinhentos milhões.
 *
 * Com a largura de verdade dá pra resolver o tamanho da letra por conta, em vez de
 * adivinhar: o corpo é o maior que ainda cabe no espaço que existe.
 *
 * Os números são as larguras de avanço lidas do arquivo da fonte, divididas pelo corpo.
 * Se a fonte do jogo mudar, esta tabela tem que ser medida de novo — o comentário fica
 * aqui pra que isso não vire um mistério daqui a um ano.
 */
const AVANCO: Record<string, number> = {
  '0': 0.652,
  '1': 0.376,
  '2': 0.571,
  '3': 0.605,
  '4': 0.677,
  '5': 0.65,
  '6': 0.637,
  '7': 0.535,
  '8': 0.648,
  '9': 0.615,
  ',': 0.287,
  '.': 0.282,
  '?': 0.538,
  k: 0.618,
  m: 1.059,
  i: 0.295,
  b: 0.679,
  t: 0.406,
  r: 0.428,
  a: 0.679,
  u: 0.674,
  q: 0.679,
};

/** Largura desconhecida: usa a do "0", a mais larga dos dígitos. Erra pra sobrar espaço. */
const AVANCO_PADRAO = 0.652;

/** A altura da tinta de um dígito, em múltiplos do corpo. Medida no mesmo arquivo. */
export const ALTURA_DO_DIGITO = 0.745;

/** Quanto o texto ocupa de largura, em múltiplos do corpo da letra. */
export function larguraEmCorpos(texto: string): number {
  let total = 0;
  for (const letra of texto) total += AVANCO[letra] ?? AVANCO_PADRAO;
  return total;
}
