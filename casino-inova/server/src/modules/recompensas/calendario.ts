import { nivelPara } from '../games/shared/niveis-de-mesa';

/**
 * O CALENDÁRIO DE TRINTA DIAS — a ficha que se ganha por voltar.
 *
 * Isto existe por uma razão de jogo, e ela foi decidida junto com a retirada do teto de
 * aposta: sem teto, uma aposta pode zerar a conta. Quem zera precisa de um caminho de
 * volta que não seja comprar ficha — senão o jogo acabou pra essa pessoa. O calendário é
 * esse caminho: amanhã tem ficha, de graça, e dá pra jogar de novo.
 *
 * TRÊS DECISÕES, e o motivo de cada uma:
 *
 * 1. O PRÊMIO É CALCULADO SOBRE O DEGRAU DA PESSOA, e não um número fixo. Dez mil fichas
 *    é uma banca inteira pra quem começou e é troco pra quem tem noventa e nove bilhões
 *    — o mesmo prêmio seria generoso demais num caso e insultuoso no outro. Como o
 *    prêmio é múltiplo do MÍNIMO da mesa em que a pessoa joga, ele sempre vale a mesma
 *    coisa em rodadas: o dia 1 paga dez rodadas, o dia 30 paga quinhentas.
 *
 *    E quem zerou a conta cai no degrau Bronze, então recebe o prêmio de Bronze — que é
 *    exatamente o suficiente pra sentar numa mesa Bronze e jogar. É o piso funcionando.
 *
 * 2. O CALENDÁRIO INTEIRO FICA À VISTA, com o valor de cada dia. Não existe "prêmio
 *    surpresa", não existe caixa que pode vir vazia, e o dia 30 não é um mistério que
 *    prende. A pessoa sabe hoje o que vai ganhar no dia 19, e decide se vale a pena.
 *
 * 3. PERDER UM DIA VOLTA PRO DIA 1, E ISSO É DITO ANTES. É a regra que faz a sequência
 *    significar alguma coisa. O que ela não pode ser é uma pegadinha: a tela mostra a
 *    regra, mostra em que dia a pessoa está e mostra até quando ela tem pra coletar —
 *    com hora marcada, não com um relógio correndo pra criar aflição.
 */

/** O calendário tem um mês. Depois do dia 30, recomeça no 1. */
export const DIAS_DO_CALENDARIO = 30;

/**
 * Quantas vezes o mínimo da mesa cada dia paga.
 *
 * A conta é uma reta com quatro marcos. A reta (8 + 2×dia) faz o prêmio crescer todo
 * dia, pra que o dia seguinte valha sempre mais que o anterior. Os marcos nas semanas —
 * 7, 14, 21 e o fechamento no 30 — são o que dá formato ao mês: pular um deles custa
 * caro, e é isso que faz alguém voltar na quinta-feira.
 *
 * Nada aqui é aleatório. O mesmo dia paga o mesmo múltiplo pra todo mundo, sempre.
 */
const MARCOS: Record<number, number> = { 7: 60, 14: 120, 21: 200, 30: 500 };

export function multiplicadorDoDia(dia: number): number {
  const d = Math.max(1, Math.min(DIAS_DO_CALENDARIO, Math.round(dia)));
  return MARCOS[d] ?? 8 + 2 * d;
}

/** Um marco é dia de semana fechada — a tela o desenha maior. */
export function ehMarco(dia: number): boolean {
  return MARCOS[dia] !== undefined;
}

/**
 * O prêmio do dia, em fichas, pra quem tem este saldo.
 *
 * Sai sempre inteiro: ficha não se parte, e o livro-caixa é de inteiros.
 */
export function premioDoDia(dia: number, saldo: number): number {
  return Math.round(nivelPara(saldo).minimo * multiplicadorDoDia(dia));
}

/** O calendário inteiro pra quem tem este saldo — os trinta dias, com valor e marco. */
export function calendarioPara(saldo: number): Array<{ dia: number; premio: number; marco: boolean }> {
  return Array.from({ length: DIAS_DO_CALENDARIO }, (_, i) => ({
    dia: i + 1,
    premio: premioDoDia(i + 1, saldo),
    marco: ehMarco(i + 1),
  }));
}

/** O começo do dia (UTC) a que este instante pertence. É a fronteira que vale pra tudo. */
export function inicioDoDia(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

/** Quantos dias inteiros separam dois dias. Zero é o mesmo dia. */
export function diasEntre(de: Date, ate: Date): number {
  const UM_DIA = 24 * 60 * 60 * 1000;
  return Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / UM_DIA);
}

export interface EstadoDaSequencia {
  /** O dia do calendário que está pra ser coletado agora (1 a 30). */
  diaAtual: number;
  /** Dá pra coletar agora? Falso quando já coletou hoje. */
  podeColetar: boolean;
  /** Quando o próximo dia abre. É um instante, não uma contagem regressiva. */
  proximaAbertura: Date;
  /** A sequência foi perdida desde a última coleta? A tela diz isso sem rodeio. */
  sequenciaPerdida: boolean;
}

/**
 * Em que dia do calendário a pessoa está, a partir de quando ela coletou por último.
 *
 * `ultimaColeta` nulo é quem nunca coletou: dia 1, aberto.
 *
 * A regra em três linhas, e ela é a mesma que a tela mostra escrita:
 *   coletou hoje       -> espera até amanhã, no mesmo dia do calendário
 *   coletou ontem      -> abre o dia seguinte da sequência (ou volta ao 1 depois do 30)
 *   faz mais de um dia -> a sequência caiu; recomeça no dia 1
 */
export function estadoDaSequencia(
  ultimaColeta: Date | null,
  ultimoDia: number,
  agora: Date,
): EstadoDaSequencia {
  const amanha = new Date(inicioDoDia(agora));
  amanha.setUTCDate(amanha.getUTCDate() + 1);

  if (!ultimaColeta) {
    return { diaAtual: 1, podeColetar: true, proximaAbertura: inicioDoDia(agora), sequenciaPerdida: false };
  }

  const distancia = diasEntre(ultimaColeta, agora);

  if (distancia === 0) {
    // Já coletou hoje. O dia atual continua sendo o que ela coletou; o próximo abre amanhã.
    return { diaAtual: ultimoDia, podeColetar: false, proximaAbertura: amanha, sequenciaPerdida: false };
  }

  if (distancia === 1) {
    // Voltou no dia seguinte: a sequência segue. Depois do dia 30, o calendário reinicia.
    const proximo = ultimoDia >= DIAS_DO_CALENDARIO ? 1 : ultimoDia + 1;
    return {
      diaAtual: proximo,
      podeColetar: true,
      proximaAbertura: inicioDoDia(agora),
      sequenciaPerdida: false,
    };
  }

  // Faltou pelo menos um dia inteiro: a sequência caiu e o calendário recomeça.
  return { diaAtual: 1, podeColetar: true, proximaAbertura: inicioDoDia(agora), sequenciaPerdida: true };
}
