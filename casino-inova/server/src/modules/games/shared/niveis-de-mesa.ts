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
import { apostaMaximaSegura, problemaComOTeto } from '../../../comum/teto-de-fichas';

export interface NivelDeMesa {
  /**
   * O identificador do degrau. É texto livre porque a escada é GERADA: travar num
   * conjunto fixo de nomes traria de volta o defeito que a fórmula resolveu — a escada
   * acabaria no último nome escrito.
   */
  id: string;
  nome: string;
  /** Saldo a partir do qual este nível é o nível da pessoa. */
  saldoDeEntrada: number;
  minimo: number;
  maximo: number;
  /**
   * As fichas do trilho neste nível, do menor pro maior.
   *
   * A menor é o mínimo da mesa e a maior é o máximo: o trilho é a faixa inteira do
   * nível, e não uma amostra dela. Assim não existe aposta possível que não caiba nas
   * fichas mostradas — quem quiser apostar o máximo pega a última e encosta uma vez.
   */
  fichas: number[];
}

/**
 * A ESCADA É CALCULADA, e não escrita à mão.
 *
 * Ela era uma lista de seis níveis digitados um a um, e o defeito disso apareceu na
 * prática: quem chegou a noventa e nove BILHÕES caía no último degrau (que entra com
 * 500 milhões) e continuava com o mesmo mínimo de cinco milhões e as mesmas fichas de
 * até cem milhões. Pra montar a aposta mínima ele precisava empilhar ficha atrás de
 * ficha. Toda vez que a banca de alguém crescesse mais do que a lista previa, o mesmo
 * problema voltaria — e uma lista sempre acaba antes.
 *
 * A REGRA, EM UMA LINHA: cada degrau entra com dez vezes o anterior, a aposta mínima é
 * 1% da entrada e a máxima é 20 vezes a mínima. Nada mais.
 *
 *   entrada    mínimo    máximo
 *   ────────────────────────────
 *   50 mil        500     10 mil
 *   500 mil     5 mil    100 mil
 *   5 mi       50 mil       1 mi
 *   50 mi     500 mil      10 mi
 *   500 mi      5 mi      100 mi
 *   5 bi       50 mi        1 bi
 *   50 bi     500 mi       10 bi
 *   500 bi      5 bi      100 bi
 *   5 tri      50 bi        1 tri
 *
 * A ESCADA NÃO ACABA. Ela é gerada até um teto absurdo de propósito: nenhuma banca vai
 * lá, e por isso nenhuma banca fica presa no último degrau.
 *
 * AS FICHAS SAEM DA MESMA CONTA. São cinco, sempre, em 1, 2, 5, 10 e 20 vezes o mínimo
 * — e vinte vezes o mínimo é exatamente o máximo. Então a menor ficha É a aposta mínima
 * (um toque basta) e a maior É o teto da mesa (um toque também). Nunca mais empilhar.
 *
 * E COMO TUDO SAI DO SALDO, a escada acompanha sozinha: quem tem noventa e nove bilhões
 * e perde noventa e oito desce de degrau na hora, e as fichas que aparecem no trilho
 * mudam junto.
 */
const NOMES_DOS_DEGRAUS = [
  'Bronze',
  'Prata',
  'Ouro',
  'Diamante',
  'Rubi',
  'Safira',
  'Esmeralda',
  'Ônix',
  'Platina',
  'Titânio',
  'Cristal',
  'Eclipse',
];

/** As fichas de um degrau: a menor é a aposta mínima, a maior é o teto da mesa. */
const MULTIPLOS_DA_FICHA = [1, 2, 5, 10, 20];

function degrau(indice: number): NivelDeMesa {
  /*
   * O Bronze é o degrau de quem entra com zero, então ele não tem "saldo de entrada"
   * pra ancorar a conta. Ele é ancorado na banca de boas-vindas (10 mil fichas), com a
   * mesma proporção dos outros: mínimo em 0,5% e máximo em 20 vezes o mínimo.
   */
  if (indice === 0) {
    return {
      id: 'bronze',
      nome: NOMES_DOS_DEGRAUS[0],
      saldoDeEntrada: 0,
      minimo: 50,
      maximo: 1_000,
      fichas: MULTIPLOS_DA_FICHA.map((m) => 50 * m),
    };
  }

  // 50 mil, 500 mil, 5 milhões, 50 milhões... cada um dez vezes o anterior.
  const entrada = 5 * 10 ** (indice + 3);
  const minimo = entrada / 100;
  return {
    id: NOMES_DOS_DEGRAUS[indice]
      ? (NOMES_DOS_DEGRAUS[indice].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') as NivelDeMesa['id'])
      : (`degrau-${indice}` as NivelDeMesa['id']),
    nome: NOMES_DOS_DEGRAUS[indice] ?? `Mesa ${indice}`,
    saldoDeEntrada: entrada,
    minimo,
    /*
     * `maximo` sobrou como REFERÊNCIA da faixa do degrau — é ele que define as fichas —
     * e não como trava. A conferência da aposta não usa mais teto: ver
     * `problemaComAAposta`.
     */
    maximo: minimo * 20,
    fichas: MULTIPLOS_DA_FICHA.map((m) => minimo * m),
  };
}

/**
 * Doze degraus: do zero até uma entrada de 500 trilhões.
 *
 * O teto é absurdo de propósito. Ele não é uma promessa de que alguém vai chegar lá —
 * é a garantia de que ninguém fica preso no último degrau, que foi exatamente o que
 * aconteceu com a lista escrita à mão.
 */
export const NIVEIS_DE_MESA: NivelDeMesa[] = Array.from({ length: 12 }, (_, i) => degrau(i));

/**
 * O NÍVEL TAMBÉM ABRE MESA — e é isto que impede comprar passagem pro degrau de cima.
 *
 * O PROBLEMA, medido: a escada era só de saldo. Quem comprasse fichas subia de mesa na
 * hora, e com o pacote de R$ 149,90 por mês subia UM DEGRAU POR MÊS — R$ 1.800 chegavam
 * ao Eclipse em um ano, e depois não havia mais nada pra comprar. O jogo acabava pra
 * quem pagou, e a progressão de nível não significava nada.
 *
 * A REGRA NOVA: o degrau da pessoa é o MENOR entre o que o saldo banca e o que o nível
 * liberou. Comprar fichas passa a dar MAIS RODADAS NA MESA DELA, e não passagem pra mesa
 * de cima. O freio é a progressão, e progressão não se compra (ver `progressao/niveis.ts`:
 * o XP sai da aposta em unidades da mesa, então mesa alta não rende XP a mais).
 *
 * OS DOIS LADOS SÃO NECESSÁRIOS. Só saldo é a economia velha, com a catraca. Só nível
 * deixaria alguém sentar numa mesa que não consegue pagar — e uma mesa que a pessoa não
 * banca é uma mesa em que ela some na primeira aposta.
 *
 * OS NÍVEIS DE ABERTURA saem da curva de XP e não do gosto: cada um é onde o jogador
 * regular alcança aquele degrau numa janela que faz sentido (tabela em docs/economia.md,
 * seção D). O Eclipse abre no 10.000, que é o `NIVEL_MAXIMO` — os dois fins coincidem de
 * propósito: a última mesa abre exatamente quando a escada de níveis acaba.
 */
export const NIVEL_PARA_ABRIR_O_DEGRAU = [1, 20, 50, 100, 200, 400, 700, 1_200, 2_000, 3_500, 6_000, 10_000];

/** O degrau mais alto que este NÍVEL já liberou. */
export function degrauDoNivel(nivel: number): NivelDeMesa {
  const n = Number.isFinite(nivel) ? Math.floor(nivel) : 1;
  let escolhido = NIVEIS_DE_MESA[0];
  for (let i = 0; i < NIVEIS_DE_MESA.length; i += 1) {
    if (n >= (NIVEL_PARA_ABRIR_O_DEGRAU[i] ?? Number.POSITIVE_INFINITY)) escolhido = NIVEIS_DE_MESA[i];
  }
  return escolhido;
}

/**
 * O DEGRAU ECONÔMICO — o único que manda. Mesa, aposta, recompensa e loja saem daqui.
 *
 * `min(o que o saldo banca, o que o nível liberou)`, e o `min` é sobre a POSIÇÃO na
 * escada e não sobre o mínimo em fichas: dá a mesma resposta hoje, e dá a resposta certa
 * no dia em que alguém mexer na escada e ela deixar de ser crescente.
 */
/**
 * O DEGRAU MAIS ALTO QUE AINDA CABE NA CONTA EXATA, para um jogo que paga até tanto.
 *
 * A CONFERÊNCIA DE PRECISÃO ENCONTROU ISTO, e é um defeito de produto, não de conta: no
 * Eclipse a aposta mínima é 5 trilhões, e o caça-níqueis pode pagar 80.000x a aposta. Oito
 * vezes dez elevado a dezesseis não cabe em ficha exata — então a mesa mais alta do jogo
 * mais popular ficava impossível de jogar: o mínimo era MAIOR que o máximo aritmético, e
 * nenhuma aposta era legal. A tela mostraria fichas, e o servidor recusaria todas.
 *
 * TRÊS SAÍDAS EXISTIAM, E DUAS ERAM RUINS. Encurtar a escada mexe na economia, que não é
 * decisão de quem conserta aritmética. Baixar o prêmio máximo do caça-níqueis mexe no
 * pagamento, que é promessa publicada ao jogador. A terceira é esta: o TRILHO de fichas
 * daquele jogo para de subir onde a conta para de ser exata, e desce pro degrau mais alto
 * que cabe inteiro — com as fichas redondas da própria escada, sem inventar denominação.
 *
 * O QUE O JOGADOR VÊ: no caça-níqueis as fichas dele param em 100 bilhões, e não em 100
 * trilhões. Na banca francesa, na roleta e no blackjack elas não param — esses jogos pagam
 * pouco o bastante pra escada inteira caber. A diferença é explicada pela mesma frase que
 * `problemaComOTeto` escreve: é o prêmio máximo da mesa que manda no tamanho da ficha.
 *
 * Sem `maiorMultiplicador`, devolve o degrau como está: quem não diz quanto paga não tem
 * como ter teto calculado.
 */
export function degrauQueCabeNaConta(degrau: NivelDeMesa, maiorMultiplicador?: number): NivelDeMesa {
  if (maiorMultiplicador === undefined) return degrau;
  const maximoSeguro = apostaMaximaSegura(maiorMultiplicador);
  let i = NIVEIS_DE_MESA.indexOf(degrau);
  if (i < 0) return degrau;
  while (i > 0 && NIVEIS_DE_MESA[i].maximo > maximoSeguro) i -= 1;
  return NIVEIS_DE_MESA[i];
}

export function degrauEconomico(saldo: number, nivel: number): NivelDeMesa {
  const porSaldo = NIVEIS_DE_MESA.indexOf(nivelPara(saldo));
  const porNivel = NIVEIS_DE_MESA.indexOf(degrauDoNivel(nivel));
  return NIVEIS_DE_MESA[Math.min(porSaldo, porNivel)];
}

/**
 * A aposta cabe no nível de quem está apostando?
 *
 * Devolve a mensagem do problema, ou `null` quando está tudo certo. Não lança exceção
 * de propósito: este arquivo é regra de economia e não conhece HTTP — quem chama é que
 * decide se vira 400, se vira aviso na tela ou se vira nada.
 *
 * ESTE LUGAR EXISTE PORQUE A REGRA ESTAVA COPIADA EM SEIS JOGOS, cada um com o próprio
 * par de números fixos no arquivo de configuração. Seis cópias significam seis lugares
 * pra esquecer de atualizar, e foi o que aconteceu: a escada de níveis foi construída e
 * conferida, e nenhum dos seis a lia. Quem tinha cem milhões continuava limitado a
 * cinco mil por aposta em todas as mesas.
 */
export function problemaComAAposta(
  valor: number,
  saldo: number,
  nivelDoJogador: number,
  maiorMultiplicador?: number,
): string | null {
  const nivel = degrauQueCabeNaConta(degrauEconomico(saldo, nivelDoJogador), maiorMultiplicador);
  if (!Number.isFinite(valor) || !Number.isInteger(valor)) {
    return 'Ficha não se parte — a aposta precisa ser um número inteiro.';
  }
  if (valor <= 0) return 'A aposta precisa ser maior que zero.';
  if (valor < nivel.minimo) {
    return `Na mesa ${nivel.nome}, a aposta mínima é ${nivel.minimo.toLocaleString('pt-BR')} fichas.`;
  }
  /*
   * NÃO EXISTE APOSTA MÁXIMA, e isso é decisão do dono do jogo.
   *
   * Numa mesa de verdade o teto existe pra proteger a CASA: ela não pode arriscar mais
   * do que tem em caixa. Aqui a casa não tem caixa que possa quebrar — as fichas não
   * viram dinheiro, não há saque, e nenhum jogo paga dinheiro de verdade (está nos
   * termos). Então o teto não protegeria ninguém de nada.
   *
   * O QUE CONTINUA VALENDO, e é o que importa: a aposta nunca passa do saldo (a
   * carteira recusa débito que deixaria o saldo negativo), o mínimo continua sendo
   * definido pelo degrau, e as chances de cada jogo continuam publicadas na tela antes
   * de apostar. Nada aqui mexe em quanto o jogo paga.
   *
   * O que a ausência de teto significa na prática, dito sem rodeio: uma aposta só pode
   * zerar a conta. É escolha de quem joga, e é a mesma escolha que existe em qualquer
   * mesa alta — a diferença é que aqui o que se perde é ficha de jogo.
   */
  if (valor > saldo) {
    return `Você tem ${saldo.toLocaleString('pt-BR')} fichas — a aposta não pode passar disso.`;
  }
  /*
   * O ÚNICO TETO QUE EXISTE, e ele não é de negócio: é de aritmética.
   *
   * Ficha é inteiro em ponto flutuante de 64 bits, exata até 2^53 − 1. Uma aposta
   * gigante numa mesa que paga muito calcularia um prêmio acima dessa linha — e aí a
   * conta erra em silêncio, ou a carteira recusa o crédito DEPOIS de a aposta já ter
   * sido debitada. As duas saídas são a mesma cena: "você ganhou" na tela e o saldo
   * parado. Recusar a aposta ANTES é a única que não machuca ninguém.
   *
   * Ver `comum/teto-de-fichas.ts` pra representação escolhida e pro porquê de não ser
   * BigInt. Onde o limite morde depende do jogo: no caça-níqueis, que paga até 80.000x, ele
   * aparece em 112 bilhões; na roleta, que paga 36x, só perto de 250 trilhões.
   */
  if (maiorMultiplicador !== undefined) {
    const teto = problemaComOTeto(valor, maiorMultiplicador);
    if (teto) return teto;
  }
  return null;
}

/** O nível de quem tem este saldo: o mais alto em que ele entra. */
export function nivelPara(saldo: number): NivelDeMesa {
  let escolhido = NIVEIS_DE_MESA[0];
  for (const nivel of NIVEIS_DE_MESA) if (saldo >= nivel.saldoDeEntrada) escolhido = nivel;
  return escolhido;
}

/** Onde a pessoa pode jogar: o degrau econômico dela e o logo abaixo. */
export function niveisDisponiveis(saldo: number, nivelDoJogador: number): NivelDeMesa[] {
  const meu = degrauEconomico(saldo, nivelDoJogador);
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
export function podeJogarNo(saldo: number, nivelDoJogador: number, id: string): boolean {
  return niveisDisponiveis(saldo, nivelDoJogador).some((n) => n.id === id);
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

export function mesasDeEntradaDisponiveis(saldo: number, nivelDoJogador: number): MesaDeEntrada[] {
  const permitidos = new Set(niveisDisponiveis(saldo, nivelDoJogador).map((n) => n.id));
  return MESAS_DE_ENTRADA.filter((m) => permitidos.has(m.nivel) && saldo >= m.saldoMinimo);
}

/**
 * A FAIXA DE ENTRADA DAS MESAS ENTRE JOGADORES — truco, dominó e pôquer.
 *
 * ESTES TRÊS JOGOS IGNORAVAM A ESCADA INTEIRA. O buy-in era `100 a 5.000`, escrito à mão
 * em três arquivos de configuração e conferido em cinco lugares, igual pra todo mundo: o
 * jogador Eclipse, com quinhentos trilhões no bolso, entrava numa partida de truco de
 * cinco mil fichas — 0,000000001% da banca dele. Uma partida inteira que não muda nada é uma
 * partida que não vale a pena jogar, que é o mesmo defeito que a escada veio resolver nas
 * mesas contra a casa.
 *
 * A FAIXA SAI DO DEGRAU ECONÔMICO, e os dois extremos têm significado:
 *
 *   mínimo — a aposta mínima do degrau mais barato em que a pessoa pode sentar. Ela pode
 *            descer um degrau (a mesma regra das outras mesas), e o piso acompanha.
 *   máximo — a ficha maior do degrau dela, que é 20x o mínimo. Uma partida custa, no
 *            máximo, o que uma rodada cara custa numa mesa contra a casa.
 *
 * No Bronze isso dá 50 a 1.000, no lugar dos 100 a 5.000 de antes — e no Eclipse dá 500
 * trilhões a 100 quatrilhões, que é o ponto.
 */
export interface FaixaDeEntrada {
  minimo: number;
  maximo: number;
}

export function faixaDeEntrada(saldo: number, nivelDoJogador: number): FaixaDeEntrada {
  const onde = niveisDisponiveis(saldo, nivelDoJogador);
  return { minimo: onde[0].minimo, maximo: onde[onde.length - 1].maximo };
}

/**
 * A entrada cabe em quem vai sentar? Devolve a mensagem do problema, ou `null`.
 *
 * Mesma forma de `problemaComAAposta`, e pela mesma razão: isto é regra de economia e não
 * conhece HTTP. Quem chama decide se vira 400 ou aviso na tela.
 */
export function problemaComAEntrada(buyIn: number, saldo: number, nivelDoJogador: number): string | null {
  const faixa = faixaDeEntrada(saldo, nivelDoJogador);
  if (!Number.isFinite(buyIn) || !Number.isInteger(buyIn)) {
    return 'Ficha não se parte — a entrada precisa ser um número inteiro.';
  }
  if (buyIn < faixa.minimo || buyIn > faixa.maximo) {
    return `A entrada precisa estar entre ${faixa.minimo.toLocaleString('pt-BR')} e ${faixa.maximo.toLocaleString('pt-BR')} fichas.`;
  }
  /*
   * O SALDO PRECISA COBRIR A ENTRADA INTEIRA, e isto não é o mesmo que a faixa: quem
   * acabou de cair pro fundo de um degrau tem o mínimo daquele degrau na faixa e pode não
   * ter fichas pra pagar. Sem esta linha, o débito falharia DEPOIS de a mesa ser criada.
   */
  if (buyIn > saldo) {
    return `Você tem ${saldo.toLocaleString('pt-BR')} fichas — a entrada não pode passar disso.`;
  }
  /*
   * O TETO DA ARITMÉTICA numa mesa de entrada: o prêmio máximo é o bolo inteiro, que é a
   * entrada vezes o número de jogadores. `MAIOR_MESA` é folgado de propósito — nenhuma
   * mesa deste catálogo passa de seis lugares, e é melhor o teto sobrar do que faltar.
   * Ver `comum/teto-de-fichas.ts`.
   */
  const teto = problemaComOTeto(buyIn, MAIOR_MESA);
  if (teto) return teto;
  return null;
}

/** Quantos lugares a maior mesa de entrada tem. O bolo é a entrada vezes isto. */
export const MAIOR_MESA = 10;

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
