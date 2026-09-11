/**
 * EM QUE DEGRAU A PESSOA JOGA, calculado aqui a partir da escada publicada pelo servidor.
 *
 * POR QUE CALCULAR AQUI, se existe `/niveis/meu`. Porque o saldo muda a cada rodada, e o
 * degrau muda junto quando ela cruza uma entrada. Pedir o degrau ao servidor depois de
 * TODO giro seria uma requisição a mais por rodada num jogo em que se gira dezenas de
 * vezes por minuto — e ainda assim chegaria atrasada, porque o saldo novo vem na
 * resposta do giro, não numa consulta seguinte.
 *
 * O QUE ISTO NÃO É: uma regra do cliente. A escada vem do servidor (`/niveis/escada`) e
 * o servidor continua validando toda aposta em `problemaComAAposta`. Aqui é só
 * APRESENTAÇÃO: mostrar o mínimo certo e as fichas certas, pra a pessoa não montar uma
 * aposta que vai ser recusada.
 *
 * E a conta é a MESMA do servidor, linha por linha — `verifica-escada-de-aposta` compara
 * as duas em toda a faixa de saldo E de nível, e reprova se divergirem em um único ponto.
 * Se alguém mudar a regra lá e esquecer daqui, a conferência para o build.
 */
import type { NivelDeMesa } from '../api/niveis';
import type { FaixaDeAposta } from './escada';

/**
 * O degrau deste saldo: o último cuja entrada o saldo alcança.
 *
 * É a mesma varredura de `nivelPara` no servidor — inclusive o "último que couber", e não
 * "o primeiro que não couber menos um", que dariam respostas diferentes se a escada um dia
 * vier fora de ordem.
 */
export function degrauPara(escada: NivelDeMesa[], saldo: number): NivelDeMesa | null {
  if (escada.length === 0) return null;
  let escolhido = escada[0];
  for (const nivel of escada) if (saldo >= nivel.saldoDeEntrada) escolhido = nivel;
  return escolhido;
}

/**
 * O degrau que o NÍVEL do jogador já abriu.
 *
 * O `abreNoLevel` vem do servidor com a escada — a tabela não é copiada pra cá. Quando ele
 * vier nulo (escada antiga, servidor mais velho que o aplicativo), o degrau é tratado como
 * aberto: a tela não pode trancar uma mesa por causa de um campo que não recebeu.
 */
export function degrauDoNivel(escada: NivelDeMesa[], level: number): NivelDeMesa | null {
  if (escada.length === 0) return null;
  let escolhido = escada[0];
  for (const nivel of escada) if (nivel.abreNoLevel === null || level >= nivel.abreNoLevel) escolhido = nivel;
  return escolhido;
}

/**
 * O DEGRAU ECONÔMICO — `min(o que o saldo banca, o que o nível liberou)`.
 *
 * É o mesmo `degrauEconomico` do servidor, e é o que faz comprar fichas dar mais rodadas
 * na mesa da pessoa em vez de passagem pra mesa de cima. O `min` é sobre a POSIÇÃO na
 * escada, igual lá.
 */
export function degrauEconomicoPara(escada: NivelDeMesa[], saldo: number, level: number): NivelDeMesa | null {
  const porSaldo = degrauPara(escada, saldo);
  const porNivel = degrauDoNivel(escada, level);
  if (!porSaldo || !porNivel) return porSaldo ?? porNivel;
  return escada.indexOf(porSaldo) <= escada.indexOf(porNivel) ? porSaldo : porNivel;
}

/** A faixa que o seletor de aposta usa: mínimo do degrau, saldo, e as fichas do degrau. */
export function faixaPara(escada: NivelDeMesa[], saldo: number, level: number): FaixaDeAposta {
  const degrau = degrauEconomicoPara(escada, saldo, level);
  return {
    minimo: degrau?.minimo ?? 0,
    saldo: Math.max(0, Math.floor(saldo)),
    fichas: degrau?.fichas ?? [],
  };
}
