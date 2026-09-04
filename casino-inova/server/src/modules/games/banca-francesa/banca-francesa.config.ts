/**
 * Banca Francesa "de verdade" (também chamada "Grande e Pequena", jogo tradicional
 * dos casinos portugueses): 3 dados de 6 faces, aposta-se na SOMA dos 3 dados, não
 * num número específico. Regras conferidas em observador.pt, BacanaPlay, 888.pt e na
 * Wikipédia em português (agosto/2026).
 *
 * Cinco lugares de aposta, porque a mesa tem CENTRO e LINHA:
 * - Ases: soma = 3 (só sai com os 3 dados mostrando 1). Paga 61 por 1. Só tem centro:
 *   uma aposta que já paga 61 por 1 não precisa de versão de risco reduzido.
 * - Centro do Pequeno: soma 5, 6 ou 7. Paga 1 por 1 e, perdendo, perde tudo.
 * - Centro do Grande: soma 14, 15 ou 16. Idem.
 * - Linha do Pequeno e Linha do Grande: a ficha vai EM CIMA do traço do arco, não
 *   dentro dele. Ganhando, ganha METADE do valor apostado; perdendo, perde só metade.
 *   É a mesma aposta do centro com metade do risco e metade do prêmio — na prática,
 *   apostar 100 na linha é apostar 50 no centro e guardar 50.
 *
 * Qualquer outra soma (4, 8 a 13, 17 ou 18) é NULA: os dados são relançados e as
 * apostas continuam em pé até sair um resultado decisivo — por isso o RTP de cada
 * aposta é calculado condicionado a um lançamento decisivo, não sobre todas as 216
 * combinações possíveis dos 3 dados.
 */
export const DICE_COUNT = 3;
export const FACES = 6;

export type ApostaDeCentro = 'ases' | 'pequeno' | 'grande';
export type ApostaDeLinha = 'linha-pequeno' | 'linha-grande';
export type BancaFrancesaBetType = ApostaDeCentro | ApostaDeLinha;

export const BET_TYPES: BancaFrancesaBetType[] = ['ases', 'pequeno', 'grande', 'linha-pequeno', 'linha-grande'];

/** Cada linha acompanha um arco: é a mesma soma, com metade do risco. */
export const ARCO_DA_LINHA: Record<ApostaDeLinha, 'pequeno' | 'grande'> = {
  'linha-pequeno': 'pequeno',
  'linha-grande': 'grande',
};

export function ehApostaDeLinha(tipo: BancaFrancesaBetType): tipo is ApostaDeLinha {
  return tipo === 'linha-pequeno' || tipo === 'linha-grande';
}

/** Somas que cada aposta cobre — usado tanto pra resolver quanto pra descrever a mesa no app. */
export const WINNING_SUMS: Record<ApostaDeCentro, number[]> = {
  ases: [3],
  pequeno: [5, 6, 7],
  grande: [14, 15, 16],
};

/**
 * Retorno TOTAL sobre a aposta (aposta devolvida + prêmio), não só o prêmio.
 * Ases "paga 61 para 1" nas casas portuguesas → prêmio de 61x, retorno total 62x.
 * Grande e Pequeno "pagam 1 para 1" → retorno total 2x.
 * As linhas não entram aqui porque o retorno delas não é múltiplo da aposta cheia:
 * ganhando devolvem 1,5x (a aposta mais metade dela) e perdendo devolvem 0,5x. Ver
 * resolveBets em banca-francesa.engine.ts.
 */
export const TOTAL_RETURN_MULTIPLIER: Record<ApostaDeCentro, number> = {
  ases: 62,
  pequeno: 2,
  grande: 2,
};

/**
 * OS LIMITES POR TIPO DE APOSTA, em múltiplos do mínimo da mesa.
 *
 * A mesa de verdade não tem um teto só: ela tem um teto por casa, e o das Ases é muito
 * mais baixo que o dos arcos. O motivo é o pagamento — uma casa que paga 61 por 1
 * expõe a banca a sessenta e uma vezes o que a casa que paga 1 por 1 expõe. Numa mesa
 * de mínimo 50, o teto de Ases fica em 300 e o dos arcos em 10.000.
 *
 * Isto é um recuo em relação ao "sem teto" que valeu por um tempo aqui, e o recuo é
 * deliberado: com teto, a tela precisa DIZER o teto. A regra antiga permitia cobrir a
 * mesa inteira num toque e a tela anunciava "sem teto" — o que era verdade. Anunciar
 * "sem teto" com um limite no servidor seria mentira, e é o erro que este arquivo
 * existe pra não deixar acontecer: os dois números saem daqui, e a mesma função que
 * recusa a aposta é a que a tela lê pra escrever o limite.
 */
export const TETO_EM_MINIMOS: Record<BancaFrancesaBetType, number> = {
  ases: 6,
  pequeno: 200,
  grande: 200,
  'linha-pequeno': 200,
  'linha-grande': 200,
};

/**
 * O PISO POR TIPO, também em múltiplos do mínimo.
 *
 * A linha vale METADE do que está escrito na ficha — quem põe 100 na linha está
 * arriscando 50. Então o mínimo da mesa só é respeitado de verdade se a ficha na linha
 * for pelo menos o DOBRO do mínimo: com mínimo 50, a menor ficha que pode ir na linha
 * é 100, que arrisca os 50 exigidos. Sem esta regra, uma ficha de 50 na linha
 * arriscaria 25 numa mesa de mínimo 50 — aposta abaixo do mínimo entrando pela porta
 * dos fundos.
 */
export const PISO_EM_MINIMOS: Record<BancaFrancesaBetType, number> = {
  ases: 1,
  pequeno: 1,
  grande: 1,
  'linha-pequeno': 2,
  'linha-grande': 2,
};

/** Quanto vale, em fichas, o piso e o teto de um tipo numa mesa deste mínimo. */
export function limitesDaCasa(tipo: BancaFrancesaBetType, minimoDaMesa: number) {
  return {
    minimo: minimoDaMesa * PISO_EM_MINIMOS[tipo],
    maximo: minimoDaMesa * TETO_EM_MINIMOS[tipo],
  };
}

/**
 * O RISCO EFETIVO de uma aposta — quanto ela pode custar de verdade.
 *
 * No centro é o valor cheio. Na linha é a metade, porque a linha perde metade. É este
 * número que a tela mostra como "risco", e é ele que a soma das apostas usa pra dizer
 * quanto o jogador pode perder na rodada — mostrar o valor cheio da linha ali seria
 * assustar com um número que não existe.
 */
export function riscoDaAposta(tipo: BancaFrancesaBetType, valor: number): number {
  return ehApostaDeLinha(tipo) ? valor / 2 : valor;
}

export const MIN_BET = 50;
/** Quantas apostas diferentes dá pra fazer na mesma rodada — uma por lugar da mesa. */
export const MAX_SIMULTANEOUS_BETS = BET_TYPES.length;

/**
 * Quanto tempo a mesa espera, depois de um lançamento NULO, antes de lançar de novo.
 *
 * Um lançamento nulo (4, 8 a 13, 17, 18) não decide nada e as apostas ficam em pé —
 * mas "ficam em pé" não pode significar "ficam presas". Nesta janela dá pra aumentar,
 * mudar de lugar ou RETIRAR tudo, e retirar não custa nada: na mesa compartilhada a
 * ficha só sai do saldo quando o lançamento decide. Quem desistir no meio sai como
 * entrou.
 *
 * 12 segundos porque é o meio da faixa que o cassino físico usa (10 a 15) — tempo de
 * ler os dados na tigela, decidir e tocar, sem virar espera. É PRAZO DO SERVIDOR: o
 * app recebe o instante em que acaba e anima sozinho, e o relógio dele chegar a zero
 * não lança nada. Atrasar o celular não estende o prazo de ninguém.
 */
export const JANELA_ENTRE_LANCAMENTOS_MS = 12_000;

/**
 * Teto de lançamentos com janela numa rodada. Não é regra de jogo: é rede de segurança.
 *
 * Batendo o teto, a mesa lança até decidir de uma vez, sem mais janelas — a rodada
 * TERMINA, ninguém fica com aposta presa. O jogo em si não muda: os dados continuam
 * sendo os mesmos e a rodada é paga igual.
 *
 * O NÚMERO PRECISOU SER MEDIDO, e o primeiro chute estava errado. 153 das 216
 * combinações são nulas, então a chance de uma rodada passar de N lançamentos é
 * (153/216)^N. Em 40 isso dá 1 em 976 mil — parece bastante até lembrar que uma mesa
 * movimentada joga milhares de rodadas, e `verify-janela.ts` de fato achou uma rodada
 * de 42 lançamentos em 500 mil. Um teto que morde jogo de verdade não é rede de
 * segurança, é regra escondida.
 *
 * Em 100 a chance é 1 em 950 trilhões, com a média em 3,43 lançamentos por rodada.
 * Aí sim é só a proteção contra mesa esquecida lançando pra sempre.
 */
export const LANCAMENTOS_MAXIMOS_COM_JANELA = 100;

/**
 * A aposta na linha é dividida ao meio, e o saldo é guardado em número inteiro de
 * fichas (a coluna `amount` do ledger é BIGINT). Metade de um valor ímpar não é
 * inteira, então valor ímpar na linha é recusado.
 *
 * Arredondar seria pior de qualquer lado: pra cima, uma aposta de 55 devolveria mais
 * do que a conta manda e o RTP passaria de 100%; pra baixo, a casa ficaria com meia
 * ficha escondida em toda aposta ímpar. Recusar é a única opção que mantém a conta
 * exata, e o aplicativo avisa antes de deixar confirmar — não é uma regra que morde
 * depois.
 */
export function apostaDeLinhaEhValida(valor: number): boolean {
  return Number.isInteger(valor) && valor % 2 === 0;
}

/**
 * A APOSTA CABE NESTA CASA, NESTA MESA? Devolve o problema, ou `null` quando está certa.
 *
 * É a ÚNICA porta. As duas mesas (a de um jogador e a compartilhada) chamam esta função
 * e mais nenhuma — porque a regra já esteve escrita em duas cópias, e as duas ficaram
 * para trás quando o teto mudou: a mesa recusava aposta por um limite que não existia
 * mais em lugar nenhum. Uma regra de aposta copiada é uma regra que vai divergir.
 *
 * A ordem das conferências é a ordem em que elas ajudam quem está jogando: primeiro o
 * que é da casa (piso, teto, par), depois o que é do bolso (saldo). Assim a mensagem
 * fala do que a pessoa acabou de fazer, e não de dinheiro quando o problema era outro.
 */
export function problemaComApostaDaBanca(
  tipo: BancaFrancesaBetType,
  valor: number,
  minimoDaMesa: number,
): string | null {
  if (!Number.isFinite(valor) || !Number.isInteger(valor)) {
    return 'Ficha não se parte — a aposta precisa ser um número inteiro.';
  }
  if (valor <= 0) return 'A aposta precisa ser maior que zero.';

  const { minimo, maximo } = limitesDaCasa(tipo, minimoDaMesa);
  const nome = NOME_DA_CASA[tipo];

  if (valor < minimo) {
    return ehApostaDeLinha(tipo)
      ? `Na linha a ficha vale metade, então o mínimo em ${nome} é ${minimo.toLocaleString('pt-BR')} — o dobro do mínimo da mesa.`
      : `O mínimo em ${nome} é ${minimo.toLocaleString('pt-BR')} fichas.`;
  }
  if (valor > maximo) {
    return `O máximo em ${nome} é ${maximo.toLocaleString('pt-BR')} fichas.`;
  }
  if (ehApostaDeLinha(tipo) && !apostaDeLinhaEhValida(valor)) {
    return `A aposta em ${nome} é dividida ao meio, então precisa ser um valor par.`;
  }
  return null;
}

/** Como cada casa é chamada em voz alta. Usado nas mensagens e pelo leitor de tela. */
export const NOME_DA_CASA: Record<BancaFrancesaBetType, string> = {
  ases: 'Ases',
  pequeno: 'Pequeno',
  grande: 'Grande',
  'linha-pequeno': 'Linha do Pequeno',
  'linha-grande': 'Linha do Grande',
};
