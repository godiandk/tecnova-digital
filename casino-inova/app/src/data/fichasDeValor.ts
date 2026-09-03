import { PLAYER_CHIP_IMAGES, PLAYER_COLOR_LABELS, PlayerColor } from './chipImages';

/**
 * A FICHA: de quem ela é, e quanto ela vale.
 *
 * Numa mesa de cassino essas são duas informações separadas, carregadas por duas coisas
 * diferentes da mesma ficha, e é isso que faz uma mesa cheia funcionar:
 *
 *   A COR DO CORPO diz DE QUEM É. Quando você senta numa mesa, o dealer te entrega
 *   fichas de uma cor que ninguém mais tem naquela mesa. Aí várias pessoas podem apostar
 *   na mesma casa e, na hora de pagar, ninguém discute de quem é o quê — dá pra ver.
 *   Quem escolhe a cor é o servidor, em PLAYER_COLORS: são quinze, e por isso a mesa tem
 *   no máximo quinze lugares.
 *
 *   A CHAPA NO MEIO diz QUANTO VALE. Fica escrito, em número, num disco escuro no centro
 *   da ficha. Tem que ser assim porque a cor já está ocupada dizendo de quem é: se a cor
 *   dissesse também o valor, um jogador com quinze denominações precisaria de quinze
 *   cores, e a mesa acabaria na primeira pessoa.
 *
 * Isso não é invenção nossa: é exatamente o sistema da roleta de cassino físico, onde
 * cada jogador recebe fichas sem valor impresso, numa cor só dele, e o valor é acertado
 * na mesa. Aqui o valor vai impresso porque a tela permite, e o resultado é melhor:
 * dá pra ler de quem é E quanto vale de uma olhada só.
 */
export interface Denominacao {
  valor: number;
  /** A cor da CHAPA — convenção de cassino, e igual pra todo mundo na mesa. */
  chapa: string;
}

/**
 * As denominações e a cor da chapa de cada uma.
 *
 * Vermelho 5, verde 25 e preto 100 é a convenção que vale em qualquer mesa do mundo.
 * Acima disso cada casa faz de um jeito, então seguimos o que a arte tem: azul pro 500 e
 * ouro pro 1000. Quem já jogou reconhece; quem nunca jogou aprende algo que vale fora
 * daqui também.
 *
 * A chapa é sempre escura por baixo do número, seja qual for a cor do jogador — um
 * número dourado sobre disco preto lê igual em cima de ficha branca ou de ficha vinho, e
 * é o que garante que a denominação não some quando a cor do jogador é clara.
 */
export const DENOMINACOES: Denominacao[] = [
  { valor: 5, chapa: '#C4342C' },
  { valor: 25, chapa: '#1E7A46' },
  { valor: 100, chapa: '#14181B' },
  { valor: 500, chapa: '#2B4E8C' },
  { valor: 1000, chapa: '#B8892E' },
];

export function corDaChapa(valor: number): string {
  let escolhida = DENOMINACOES[0];
  for (const d of DENOMINACOES) if (d.valor <= valor) escolhida = d;
  return escolhida.chapa;
}

/** A arte da ficha de uma pessoa. Sem cor conhecida, cai na primeira — nunca quebra. */
export function arteDaFicha(cor: PlayerColor | undefined) {
  return PLAYER_CHIP_IMAGES[cor ?? 'branco'] ?? PLAYER_CHIP_IMAGES.branco;
}

/** "duas de 100 e uma de 25" — pra quem ouve a mesa em vez de ver. */
export function pilhaEmPalavras(fichas: number[]): string {
  if (fichas.length === 0) return 'nenhuma ficha';
  const contagem = new Map<number, number>();
  for (const f of fichas) contagem.set(f, (contagem.get(f) ?? 0) + 1);
  const partes = [...contagem.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([valor, n]) => `${n === 1 ? 'uma' : n} de ${valor.toLocaleString('pt-BR')}`);
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/** As quinze cores, na mesma ordem de PLAYER_COLORS no servidor. */
export const CORES_DE_JOGADOR = Object.keys(PLAYER_COLOR_LABELS) as PlayerColor[];

/**
 * A cor de quem está jogando sozinho contra a casa.
 *
 * Numa mesa compartilhada quem dá a cor é o SERVIDOR, que sabe quem já sentou e não
 * repete — é o único jeito de garantir que duas pessoas na mesma mesa não fiquem com a
 * mesma cor. Nas mesas de um jogador só contra a casa não existe essa disputa, e aí a
 * cor sai do identificador da própria pessoa: assim ela é sempre a mesma pra quem entra,
 * partida após partida, em vez de sortear uma cor diferente a cada rodada.
 *
 * Sem identificador (visitante que ainda não criou conta) a resposta é `undefined`, e
 * quem desenha cai na primeira cor. Não inventamos identidade pra quem não tem.
 */
export function corDoJogador(id: string | undefined): PlayerColor | undefined {
  if (!id) return undefined;
  let soma = 0;
  for (let i = 0; i < id.length; i += 1) soma = (soma * 31 + id.charCodeAt(i)) >>> 0;
  return CORES_DE_JOGADOR[soma % CORES_DE_JOGADOR.length];
}

/**
 * Um valor virado em fichas, da maior pra menor — do jeito que o caixa troca.
 *
 * Serve pra desenhar a pilha de quem a gente não viu apostar. As apostas que chegam do
 * servidor vêm como um número só ("450 no Grande"), não como a lista de fichas que a
 * pessoa encostou, então a pilha dela é reconstruída aqui. A da gente não passa por
 * isto enquanto não é confirmada: essa a gente viu montar, e mostra as fichas que foram
 * postas de verdade.
 */
export function decomporEmFichas(valor: number): number[] {
  const fichas: number[] = [];
  let resto = valor;
  for (const { valor: unidade } of [...DENOMINACOES].reverse()) {
    while (resto >= unidade) {
      fichas.push(unidade);
      resto -= unidade;
    }
  }
  // A pilha é desenhada de baixo pra cima, e no feltro a maior fica embaixo.
  return fichas.reverse();
}
