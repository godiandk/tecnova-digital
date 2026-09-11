import { diaDoMes, diasDoMes, diasEntre, diaSeguinte } from '../../comum/dia-do-servidor';
import { NIVEIS_DE_MESA } from '../games/shared/niveis-de-mesa';

/**
 * A RECOMPENSA DIÁRIA — a ficha que se ganha por voltar.
 *
 * Existe por uma razão de jogo, decidida junto com a retirada do teto de aposta: sem teto,
 * uma aposta pode zerar a conta. Quem zera precisa de um caminho de volta que não seja
 * comprar ficha — senão o jogo acabou pra essa pessoa. O calendário é esse caminho: amanhã
 * tem ficha, de graça, e dá pra jogar de novo.
 *
 * A CATRACA QUE ISTO DESMONTA
 *
 * O prêmio era `mínimo da mesa do SALDO ATUAL × multiplicador do dia`, e isso era uma
 * catraca de juros compostos: coletar aumenta o saldo, saldo maior sobe o degrau, degrau
 * maior aumenta o prêmio do dia seguinte. Medido: quem só coletasse, sem jogar UMA rodada,
 * chegava ao degrau Eclipse em 171 dias e a 102,3 QUATRILHÕES de fichas em um ano. Acima
 * do Prata a loja deixava de ter função econômica, e jogar empobrecia em relação a não
 * jogar — a recompensa rendia mais que o jogo.
 *
 * Agora a âncora é o BRONZE, fixa, multiplicada pelo NÍVEL. Isso corta o laço: o prêmio
 * não depende mais de nada que ele próprio faça crescer. Um ano só coletando cai de 102,3
 * quatrilhões para 1,1 milhão de fichas.
 *
 * E O PISO CONTINUA FUNCIONANDO PRA QUEM QUEBROU, que era o bom argumento a favor do
 * saldo: quem zera a conta joga no Bronze, e o prêmio é em fichas de Bronze — dez apostas
 * mínimas no primeiro dia, o suficiente pra sentar e jogar. O que mudou é que o prêmio
 * deixou de pagar MAIS a quem tem mais, que era o efeito que aquela fórmula tinha.
 */

/**
 * A ÂNCORA: a aposta mínima da mesa de entrada, e não o degrau da pessoa.
 *
 * É esta linha que mata a catraca. Ancorar no degrau de quem coleta faria o prêmio crescer
 * junto com o saldo que o prêmio mesmo aumenta, e o laço se fecha de novo.
 */
const ANCORA = NIVEIS_DE_MESA[0].minimo;

/**
 * O BÔNUS DE NÍVEL — o que a progressão vale na recompensa.
 *
 * `1 + 0,5 × log10(nível)`, com teto em 3×: meia vez a mais a cada DÉCADA de nível. Nível
 * 1 paga 1,00×, nível 10 paga 1,50×, nível 100 paga 2,00×, nível 1.000 paga 2,50× e o
 * 10.000 paga 3,00× — que é exatamente onde a escada de níveis acaba.
 *
 * LOGARITMO E NÃO RETA, e a razão é a mesma da curva de XP: com dez mil níveis, uma reta
 * obriga a escolher entre um bônus que não se sente no começo e um bônus absurdo no fim. O
 * logaritmo dá os dois — e desacelera sozinho, então o nível 1.000 não vale dez vezes o
 * nível 100 por ter dez vezes o número.
 *
 * O TETO DE 3× NÃO É ENFEITE: sem ele, o bônus alcançaria a diferença entre degraus (que é
 * de 10×) e o nível voltaria a mexer em QUAL MESA a pessoa joga — que é trabalho do
 * `economicTier`, não da recompensa.
 */
export function bonusDeNivel(nivel: number): number {
  const n = Number.isFinite(nivel) ? Math.max(1, Math.floor(nivel)) : 1;
  return Math.min(TETO_DO_BONUS, 1 + 0.5 * Math.log10(n));
}

export const TETO_DO_BONUS = 3;

/**
 * Quantas vezes a âncora cada dia da SEQUÊNCIA paga.
 *
 * A reta (`8 + 2 × dia`) faz o prêmio crescer todo dia, pra que o dia seguinte valha
 * sempre mais que o anterior. Os marcos — 7, 14, 21 e o fechamento do mês — são o que dá
 * formato ao mês: pular um deles custa caro, e é isso que faz alguém voltar na
 * quinta-feira.
 *
 * O MARCO DE FIM DE MÊS É RELATIVO AO MÊS DE VERDADE, e não ao dia 30. Fevereiro fecha no
 * 28 (ou 29, em ano bissexto), e julho no 31 — e os três pagam o mesmo marco. Antes o
 * marco era a chave `30` numa tabela escrita à mão: em fevereiro ele nunca chegava, e em
 * julho o dia 31 caía de volta na reta e pagava 70 no lugar de 500.
 *
 * Nada aqui é aleatório: o mesmo dia paga o mesmo múltiplo pra todo mundo, sempre, e o
 * calendário inteiro fica à vista antes de a pessoa decidir se vale a pena voltar.
 */
export function multiplicadorDoDia(dia: number, diasDoMesAtual: number): number {
  const total = Math.max(1, Math.round(diasDoMesAtual));
  const d = Math.max(1, Math.min(total, Math.round(dia)));
  if (d >= total) return MARCO_DO_FIM_DO_MES;
  return MARCOS[d] ?? 8 + 2 * d;
}

const MARCOS: Record<number, number> = { 7: 60, 14: 120, 21: 200 };
const MARCO_DO_FIM_DO_MES = 500;

/** Um marco é dia de semana fechada — a tela o desenha maior. */
export function ehMarco(dia: number, diasDoMesAtual: number): boolean {
  return dia >= diasDoMesAtual || MARCOS[dia] !== undefined;
}

/**
 * O prêmio do dia, em fichas, pra quem está neste nível.
 *
 * Sai sempre inteiro: ficha não se parte, e o livro-caixa é de inteiros.
 */
export function premioDoDia(dia: number, nivelDoJogador: number, diasDoMesAtual: number): number {
  return Math.round(ANCORA * multiplicadorDoDia(dia, diasDoMesAtual) * bonusDeNivel(nivelDoJogador));
}

export interface DiaDoCalendario {
  dia: number;
  premio: number;
  marco: boolean;
}

/** O calendário inteiro do mês, pra quem está neste nível. */
export function calendarioPara(nivelDoJogador: number, dia: string): DiaDoCalendario[] {
  const total = diasDoMes(dia);
  return Array.from({ length: total }, (_, i) => ({
    dia: i + 1,
    premio: premioDoDia(i + 1, nivelDoJogador, total),
    marco: ehMarco(i + 1, total),
  }));
}

/**
 * O DIA DO CALENDÁRIO É A POSIÇÃO NA SEQUÊNCIA, e não a data do mês.
 *
 * A diferença importa e é fácil de errar. Se a casa do calendário fosse o dia do mês,
 * quem criasse a conta no dia 21 coletaria o marco de 200 vezes a âncora na primeira vez
 * que abrisse o jogo — e quem entrasse no dia 1 levaria 30 dias pra chegar lá. O
 * calendário é uma recompensa por VOLTAR, e voltar se conta em dias seguidos.
 *
 * A GRADE TEM O TAMANHO DO MÊS DE VERDADE — 28, 29, 30 ou 31 — pra que a tela pareça um
 * calendário e "fechar o mês" queira dizer alguma coisa. Era `DIAS_DO_CALENDARIO = 30`,
 * fixo, com o marco final preso na chave 30: em fevereiro esse marco nunca chegava, e em
 * julho o dia 31 caía de volta na reta e pagava 70 no lugar de 500.
 *
 * E VIRAR O MÊS NÃO QUEBRA A SEQUÊNCIA. 31 de agosto e 1º de setembro são dias
 * consecutivos, e a sequência é sobre dias consecutivos — o calendário mensal é
 * apresentação. O que acontece é que a GRADE recomeça: quem fechou uma grade de 31 volta
 * pra casa 1 da grade seguinte com a sequência intacta. Por isso `diaAtual` e
 * `diasSeguidos` são dois números diferentes, e a tela mostra os dois.
 */
export interface EstadoDaSequencia {
  /** A casa do calendário que está pra ser coletada agora (1 até o tamanho do mês). */
  diaAtual: number;
  /** Dá pra coletar agora? Falso quando já coletou hoje. */
  podeColetar: boolean;
  /** Quando o próximo dia abre, em `AAAA-MM-DD`. É a data, não uma contagem regressiva. */
  proximaAbertura: string;
  /** A sequência foi perdida desde a última coleta? A tela diz isso sem rodeio. */
  sequenciaPerdida: boolean;
}

/**
 * Em que casa do calendário a pessoa está, a partir de quando ela coletou por último.
 *
 * `ultimaColeta` nulo é quem nunca coletou: casa 1, aberta.
 *
 * A regra em três linhas, e é a mesma que a tela mostra escrita:
 *   coletou hoje       -> espera até amanhã, na mesma casa
 *   coletou ontem      -> abre a casa seguinte (ou volta à 1 depois de fechar a grade)
 *   faz mais de um dia -> a sequência caiu; recomeça na casa 1
 *
 * TUDO EM `AAAA-MM-DD`, nunca em `Date`. Um `Date` no caminho é um convite pra alguém (o
 * driver do banco, o JSON, o aplicativo) reinterpretar o instante no fuso local e perder
 * um dia — que é exatamente o defeito do item 9 ("23:59 coletou, 00:01 o sistema acha que
 * foram dois dias"). A régua do dia mora em `comum/dia-do-servidor.ts`, em UTC, e é a
 * mesma pro SQL: `CURRENT_DATE` saiu de cena porque é a data no fuso do BANCO.
 */
export function estadoDaSequencia(
  ultimaColeta: string | null,
  ultimoDia: number,
  hoje: string,
): EstadoDaSequencia {
  const casasDaGrade = diasDoMes(hoje);

  if (!ultimaColeta) {
    return { diaAtual: 1, podeColetar: true, proximaAbertura: hoje, sequenciaPerdida: false };
  }

  const distancia = diasEntre(ultimaColeta, hoje);

  if (distancia <= 0) {
    /*
     * Já coletou hoje — ou a última coleta está no futuro, o que só acontece se o relógio
     * do servidor andar pra trás. Nos dois casos a resposta segura é a mesma: não paga.
     */
    return {
      diaAtual: Math.max(1, Math.min(casasDaGrade, ultimoDia)),
      podeColetar: false,
      proximaAbertura: diaSeguinte(hoje),
      sequenciaPerdida: false,
    };
  }

  if (distancia === 1) {
    // Voltou no dia seguinte: a sequência segue. Fechada a grade, ela recomeça na casa 1.
    return {
      diaAtual: ultimoDia >= casasDaGrade ? 1 : ultimoDia + 1,
      podeColetar: true,
      proximaAbertura: hoje,
      sequenciaPerdida: false,
    };
  }

  // Faltou pelo menos um dia inteiro: a sequência caiu e a grade recomeça.
  return { diaAtual: 1, podeColetar: true, proximaAbertura: hoje, sequenciaPerdida: true };
}

/** Quantas casas a grade deste mês tem. A tela desenha exatamente esta quantidade. */
export function casasDaGrade(hoje: string): number {
  return diasDoMes(hoje);
}

/** Que dia do mês é hoje — é a casa que a tela destaca na grade. */
export function hojeNoMes(hoje: string): number {
  return diaDoMes(hoje);
}
