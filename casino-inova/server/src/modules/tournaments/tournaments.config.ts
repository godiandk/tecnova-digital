/**
 * Torneios do Casino Inova.
 *
 * A decisão mais importante deste módulo é COMO se ganha ponto, e ela segue o mesmo
 * princípio do resto do projeto: nada aqui empurra a pessoa a gastar mais.
 *
 * O caminho fácil (e o que boa parte dos cassinos sociais faz) seria pontuar pelo
 * volume apostado, ou pelo saldo líquido em fichas. Os dois premiam quem aposta alto:
 * no saldo líquido, quem aposta 5.000 por rodada oscila cem vezes mais que quem aposta
 * 50, e o topo de um ranking é justamente a ponta de cima dessa oscilação — então o
 * ranking viraria uma lista de quem gastou mais, disfarçada de lista de quem jogou
 * melhor.
 *
 * Aqui a pontuação é PROPORCIONAL: cada rodada vale o quanto voltou em relação ao que
 * foi apostado, não o tamanho da aposta. Apostar 10 fichas ou 10.000 na mesma aposta
 * dá exatamente os mesmos pontos. Quem aposta alto ganha mais fichas, como sempre
 * ganhou — mas não sobe no ranking por isso.
 */

export type TournamentPeriod = 'diario' | 'semanal' | 'mensal';

/**
 * Escala da pontuação. Uma rodada que dobra a aposta (paga 1 pra 1) vale +100 pontos;
 * uma que perde tudo vale -100. Acertar os ases da banca francesa (62x) vale +6.100.
 * É só uma escala legível — a proporção é que importa.
 */
export const POINTS_SCALE = 100;

export interface Tournament {
  id: string;
  name: string;
  /** Frase curta que aparece embaixo do nome. */
  tagline: string;
  period: TournamentPeriod;
  /** Ids dos jogos que contam. Lista vazia = todos os jogos contam. */
  gameIds: string[];
  /**
   * Mínimo de rodadas pra entrar no ranking. Existe pra impedir que uma única rodada
   * de sorte grande decida o torneio — sem isso, quem acertasse um 62x na primeira
   * aposta e parasse de jogar seria imbatível.
   */
  minRounds: number;
  /** Prêmio em fichas por colocação: prizes[0] é do 1º lugar. */
  prizes: number[];
}

export const TOURNAMENTS: Tournament[] = [
  {
    id: 'diario-geral',
    name: 'Corrida do Dia',
    tagline: 'Todos os jogos contam. Zera toda meia-noite.',
    period: 'diario',
    gameIds: [],
    minRounds: 10,
    prizes: [5_000, 3_000, 2_000, 1_000, 1_000, 500, 500, 500, 500, 500],
  },
  {
    id: 'semanal-mesas',
    name: 'Semana das Mesas',
    tagline: 'Só os jogos de mesa: truco, dominó, poker e banca francesa.',
    period: 'semanal',
    gameIds: ['truco', 'domino', 'poker', 'banca-francesa'],
    minRounds: 20,
    prizes: [25_000, 15_000, 10_000, 5_000, 5_000, 2_500, 2_500, 2_500, 2_500, 2_500],
  },
  {
    id: 'mensal-geral',
    name: 'Grande Prêmio do Mês',
    tagline: 'A disputa longa. Todos os jogos, o mês inteiro.',
    period: 'mensal',
    gameIds: [],
    minRounds: 50,
    prizes: [100_000, 60_000, 40_000, 20_000, 20_000, 10_000, 10_000, 10_000, 10_000, 10_000],
  },
];

export function findTournament(id: string): Tournament | undefined {
  return TOURNAMENTS.find((tournament) => tournament.id === id);
}

/**
 * A janela aberta agora, pro período pedido. Não guardamos "instâncias" de torneio:
 * a janela é sempre calculada a partir do relógio, então nunca fica desalinhada e
 * não precisa de ninguém rodando um cron pra virar o dia.
 *
 * Tudo em UTC, igual ao resto do servidor. Quando existir jogador de verdade, isto
 * aqui vira fuso de Brasília — está isolado nesta função de propósito.
 */
export function windowFor(period: TournamentPeriod, now: Date): { startsAt: Date; endsAt: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);

  if (period === 'diario') {
    end.setUTCDate(end.getUTCDate() + 1);
    return { startsAt: start, endsAt: end };
  }

  if (period === 'semanal') {
    // Semana começa na segunda: getUTCDay() devolve 0 pro domingo, que vira 6 aqui.
    const diasDesdeSegunda = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - diasDesdeSegunda);
    const fim = new Date(start);
    fim.setUTCDate(fim.getUTCDate() + 7);
    return { startsAt: start, endsAt: fim };
  }

  const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const fimMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startsAt: inicioMes, endsAt: fimMes };
}
