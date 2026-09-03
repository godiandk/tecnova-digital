/**
 * OS NÍVEIS DE MESA — quanto se aposta, conforme o tamanho da banca.
 *
 * O problema que isto resolve é real: com um mínimo fixo de 50 fichas, quem tem um
 * milhão aposta 50 e a banca dele nunca se mexe. Não é só questão de negócio — é
 * questão de jogo. Uma aposta que não muda nada no saldo não tem peso nenhum, e uma
 * mesa em que ninguém sente a aposta não é uma mesa, é uma tela girando sozinha.
 *
 * A SOLUÇÃO É NÍVEL DE MESA, NÃO PORCENTAGEM DIRETA, e a diferença importa:
 *
 * 1. Porcentagem pura não faz o que promete. Se o mínimo fosse sempre 5% do saldo, o
 *    saldo cairia geometricamente e NUNCA chegaria a zero — 5% de um número que
 *    encolhe encolhe junto. A pessoa acabaria com uma banca minúscula apostando
 *    migalhas, que é exatamente o estado que se queria evitar.
 *
 * 2. Nível é como cassino de verdade funciona. Não existe "a mesa cobra 3% do seu
 *    bolso": existe a mesa de 5, a de 100 e a de 1.000, e cada uma diz o preço na
 *    placa antes de você sentar. Quem chega sabe quanto custa a rodada.
 *
 * 3. Cada nível é uma faixa proporcional a quem entra nele: o mínimo é 1% do saldo de
 *    entrada e o máximo é 20%. Então a aposta pesa o mesmo pra quem tem cinquenta mil
 *    e pra quem tem cinco milhões — que é o "referente ao que ela tem" com número.
 *
 *    O teto em 20% não é enfeite. Numa versão anterior o máximo era o saldo de entrada
 *    inteiro, e o verify-niveis.ts mostrou o que isso queria dizer: uma aposta só podia
 *    zerar quem tivesse acabado de chegar no nível. Vinte por cento continua sendo uma
 *    aposta que se sente, e ainda deixa a pessoa errar cinco vezes antes de acabar.
 *
 * O JOGADOR JOGA NO NÍVEL DELE, E PODE DESCER UM. Só um. Descer um degrau é o espaço
 * pra jogar mais barato num dia ruim ou pra aprender um jogo novo sem arriscar a banca
 * inteira; descer três seria voltar a apostar 50 com um milhão no bolso, que é o
 * problema de novo. Esse degrau custa pouco e evita o único jeito de isto ficar
 * injusto: alguém preso num mínimo que não cabe no bolso dele.
 */
export interface NivelDeMesa {
  id: 'bronze' | 'prata' | 'ouro' | 'diamante';
  nome: string;
  /** Saldo a partir do qual este nível é o nível da pessoa. */
  saldoDeEntrada: number;
  minimo: number;
  maximo: number;
  /** As fichas do trilho neste nível — cinco valores, do menor pro maior. */
  fichas: number[];
}

export const NIVEIS_DE_MESA: NivelDeMesa[] = [
  {
    id: 'bronze',
    nome: 'Bronze',
    // O Bronze entra com zero, então a faixa dele é ancorada na banca inicial de
    // 10.000 fichas: 0,5% de mínimo e 20% de máximo.
    saldoDeEntrada: 0,
    minimo: 50,
    maximo: 2_000,
    fichas: [5, 25, 100, 500, 1_000],
  },
  {
    id: 'prata',
    nome: 'Prata',
    saldoDeEntrada: 50_000,
    minimo: 500,
    maximo: 10_000,
    fichas: [100, 500, 1_000, 5_000, 10_000],
  },
  {
    id: 'ouro',
    nome: 'Ouro',
    saldoDeEntrada: 500_000,
    minimo: 5_000,
    maximo: 100_000,
    fichas: [1_000, 5_000, 10_000, 50_000, 100_000],
  },
  {
    id: 'diamante',
    nome: 'Diamante',
    saldoDeEntrada: 5_000_000,
    minimo: 50_000,
    maximo: 1_000_000,
    fichas: [10_000, 50_000, 100_000, 500_000, 1_000_000],
  },
];

/** O nível de quem tem este saldo: o mais alto em que ele entra. */
export function nivelPara(saldo: number): NivelDeMesa {
  let escolhido = NIVEIS_DE_MESA[0];
  for (const nivel of NIVEIS_DE_MESA) if (saldo >= nivel.saldoDeEntrada) escolhido = nivel;
  return escolhido;
}

/** Onde a pessoa pode jogar: o nível dela e o degrau logo abaixo. */
export function niveisDisponiveis(saldo: number): NivelDeMesa[] {
  const meu = nivelPara(saldo);
  const i = NIVEIS_DE_MESA.indexOf(meu);
  return i === 0 ? [meu] : [NIVEIS_DE_MESA[i - 1], meu];
}

export function nivelPorId(id: string): NivelDeMesa | undefined {
  return NIVEIS_DE_MESA.find((n) => n.id === id);
}

/**
 * O nível vale pra esta pessoa? Recusar aqui é o que impede alguém de mandar
 * "nivel: bronze" na requisição com cinco milhões no bolso.
 */
export function podeJogarNo(saldo: number, id: string): boolean {
  return niveisDisponiveis(saldo).some((n) => n.id === id);
}

/**
 * AS MESAS DE ENTRADA — os jogos em que se joga contra gente, não contra a casa.
 *
 * Truco, dominó e pôquer não têm banca: ninguém aposta num resultado que a casa paga.
 * O dinheiro vem dos próprios jogadores, e por isso a conta é outra — não existe RTP
 * nem vantagem da casa pra divulgar, existe bolo.
 *
 * COMO FUNCIONA. Cada lugar da mesa paga a MESMA entrada pra sentar. Quatro pessoas a
 * dez mil formam um bolo de quarenta mil. A dupla que ganha divide o bolo: vinte mil
 * pra cada. Quem ganhou pôs dez e levou vinte — apostou dez, ganhou dez. Quem perdeu
 * perdeu os dez, e foram exatamente esses dez que a dupla adversária levou. Nada é
 * criado, nada some: o que sai de um bolso entrou no outro.
 *
 * E É POR ISSO QUE ESTES JOGOS NÃO TÊM RTP. Num jogo contra a casa, divulgar quanto
 * volta é obrigação, porque a casa tem vantagem embutida e o jogador precisa saber
 * qual é. Aqui a casa não participa: o retorno de cada pessoa depende de quem joga
 * melhor, e o único número honesto a declarar é que a casa não tira nada do bolo.
 *
 * A SALA DIZ O PREÇO NA PORTA. Cada nível tem sua entrada, e o nível é o mesmo do
 * jogo contra a casa: quem tem cinco milhões joga na mesa de um milhão de entrada,
 * podendo descer um degrau. É o "sala só pra quem tem um milhão", com a diferença de
 * que aqui o número está escrito antes de entrar, não descoberto depois.
 */
export interface MesaDeEntrada {
  nivel: NivelDeMesa['id'];
  nome: string;
  /** O que cada lugar paga pra sentar. */
  entrada: number;
  /** Saldo necessário pra sentar: a entrada, e nada além dela. */
  saldoMinimo: number;
}

export const MESAS_DE_ENTRADA: MesaDeEntrada[] = NIVEIS_DE_MESA.map((n) => ({
  nivel: n.id,
  nome: n.nome,
  // A entrada é 20x o mínimo da mesa do mesmo nível: uma partida inteira de truco ou
  // dominó vale mais ou menos vinte rodadas de um jogo de mesa, então o peso no bolso
  // fica parecido entre os dois jeitos de jogar.
  entrada: n.minimo * 20,
  saldoMinimo: n.minimo * 20,
}));

export function mesasDeEntradaDisponiveis(saldo: number): MesaDeEntrada[] {
  const permitidos = new Set(niveisDisponiveis(saldo).map((n) => n.id));
  return MESAS_DE_ENTRADA.filter((m) => permitidos.has(m.nivel) && saldo >= m.saldoMinimo);
}

/**
 * Como o bolo é dividido.
 *
 * Devolve quanto cada vencedor recebe, em ficha inteira, e a conta fecha sempre: a
 * soma do que sai é exatamente a soma do que entrou. Se a divisão não for exata, a
 * sobra vai pros primeiros vencedores da lista, uma ficha pra cada — é o jeito de
 * dividir sem inventar nem sumir com meia ficha, que num livro-caixa de inteiros é a
 * única forma de estar certo.
 */
export function dividirOBolo(entrada: number, jogadores: number, vencedores: number): number[] {
  if (vencedores <= 0 || jogadores <= 0) return [];
  const bolo = entrada * jogadores;
  const base = Math.floor(bolo / vencedores);
  const sobra = bolo - base * vencedores;
  return Array.from({ length: vencedores }, (_, i) => base + (i < sobra ? 1 : 0));
}
