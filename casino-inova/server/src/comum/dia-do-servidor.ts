/**
 * O DIA DO SERVIDOR — uma definição só de "hoje", para o sistema inteiro.
 *
 * Parece pequeno e não é. "Que dia é hoje" decide quando a recompensa diária libera,
 * quando a sequência quebra, e quando o teto diário de XP zera. Se cada pedaço do
 * sistema responder isso do seu jeito, a mesma pessoa pode ter coletado o presente de
 * hoje e ainda estar no dia de ontem para o XP.
 *
 * O QUE ESTAVA ERRADO. A recompensa diária usava `CURRENT_DATE` do Postgres, que é a
 * data no FUSO DO BANCO. Isso quer dizer três coisas ruins:
 *
 * 1. Mudar o fuso do banco (ou migrar pra outro servidor) move a virada do dia pra todo
 *    mundo de uma vez. Alguém coleta às 23h e, depois da migração, "hoje" virou ontem —
 *    ou a sequência de trinta dias de uma pessoa quebra sem que ela tenha faltado.
 * 2. Fuso com horário de verão tem dias de 23 e de 25 horas, e dois instantes diferentes
 *    com a mesma hora local. Contar dias em cima disso é contar em cima de uma régua que
 *    encolhe duas vezes por ano.
 * 3. A regra fica escondida na configuração do banco, onde ninguém procura, em vez de
 *    estar escrita no código, onde está sendo lida agora.
 *
 * A DECISÃO: O DIA É EM UTC, e está dito aqui, em um lugar. UTC não tem horário de
 * verão, todo dia tem exatamente 24 horas, e a virada acontece no mesmo instante para
 * todo mundo no mundo — o que, num jogo com jogadores em fusos diferentes, é mais justo
 * do que privilegiar o fuso de onde a máquina por acaso está ligada.
 *
 * O QUE ISSO SIGNIFICA PARA QUEM JOGA, dito sem maquiagem: no Brasil (UTC−3) o dia do
 * jogo vira às 21h. Quem joga de madrugada já está no dia seguinte do jogo. Isso PRECISA
 * estar escrito na tela da recompensa diária — "o dia do jogo vira às 21h (horário de
 * Brasília)" —, porque a única coisa pior que uma virada em horário estranho é uma
 * virada em horário estranho que a pessoa descobre perdendo a sequência.
 */

/** O fuso em que o dia do jogo é contado. Não é configurável de propósito. */
export const FUSO_DO_DIA = 'UTC';

/**
 * O dia de hoje, como texto `AAAA-MM-DD`.
 *
 * Texto e não `Date` porque é isso que vai e volta do banco numa coluna `DATE` sem
 * passar por conversão de fuso nenhuma. Um `Date` no caminho é um convite pra alguém
 * (o driver, o JSON, o app) reinterpretar o instante no fuso local e perder um dia.
 *
 * @param agora permite ao teste dizer que horas são. Em produção ninguém passa nada.
 */
export function diaDoServidor(agora: Date = new Date()): string {
  return agora.toISOString().slice(0, 10);
}

/**
 * Quantos dias inteiros separam dois dias do servidor. Negativo se o segundo é anterior.
 *
 * A conta é feita em UTC à meia-noite exata, então não existe "23,97 dias" pra
 * arredondar errado — é a razão de o dia ser em UTC e não num fuso com horário de verão.
 */
export function diasEntre(de: string, ate: string): number {
  const a = Date.parse(`${de}T00:00:00.000Z`);
  const b = Date.parse(`${ate}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

/** O dia seguinte a este. Existe pra que ninguém escreva `+ 1` numa string de data. */
export function diaSeguinte(dia: string): string {
  const t = Date.parse(`${dia}T00:00:00.000Z`);
  if (!Number.isFinite(t)) return dia;
  return new Date(t + 86_400_000).toISOString().slice(0, 10);
}

/**
 * Quantos dias tem o mês deste dia — 28, 29, 30 ou 31.
 *
 * Fevereiro de ano bissexto tem 29, e é por isso que isto não é uma tabela escrita à
 * mão: o dia zero do mês seguinte é o último dia deste, e o calendário do JavaScript já
 * sabe a regra dos anos bissextos (divisível por 4, menos os séculos, menos os
 * divisíveis por 400 — 2100 não é bissexto e 2000 foi).
 */
export function diasDoMes(dia: string): number {
  const [ano, mes] = dia.split('-').map(Number);
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return 30;
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Que dia do mês é este dia: 1 a 31. */
export function diaDoMes(dia: string): number {
  return Number(dia.slice(8, 10));
}

/** O mês deste dia, como `AAAA-MM`. É por ele que se sabe que o mês virou. */
export function mesDoDia(dia: string): string {
  return dia.slice(0, 7);
}
