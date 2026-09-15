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
 * O DEGRAU ECONÔMICO — QUEM MANDA É O SALDO. Ponto.
 *
 * ISTO JÁ FOI `min(saldo, nível)` E ESTAVA ERRADO, aqui e no servidor. A ideia era impedir
 * que comprar fichas virasse passagem pra mesa de cima; o efeito real era outro: quem
 * criava a conta, comprava dez mil reais em fichas e entrava na mesa ficava preso apostando
 * CINQUENTA, porque o nível era 1. Comprou e não pôde usar.
 *
 * Quem tem a ficha aposta a ficha. O pay-to-level continua barrado onde ele mora de
 * verdade: o XP sai da aposta em unidades da mesa, e a recompensa diária é ancorada no
 * Bronze — mesa alta não compra nível.
 *
 * `level` fica na assinatura porque a tela ainda conta a história da progressão; ele só
 * não decide mais em que mesa a pessoa aposta. A conferência `verify:escada-de-aposta`
 * compara esta conta com a do servidor em toda faixa de saldo e de nível.
 */
export function degrauEconomicoPara(escada: NivelDeMesa[], saldo: number, _level?: number): NivelDeMesa | null {
  return degrauPara(escada, saldo);
}

/** Até onde a conta de fichas é exata: 2^53 − 1, o mesmo teto do servidor. */
export const TETO_DE_FICHAS = Number.MAX_SAFE_INTEGER;

/**
 * O DEGRAU MAIS ALTO QUE AINDA CABE NA CONTA EXATA, pra um jogo que paga até tanto.
 *
 * Espelha `degrauQueCabeNaConta` do servidor, e existe pelo mesmo motivo que todo o resto
 * deste arquivo: o trilho desenhado na tela não pode oferecer ficha que o servidor recusa.
 * No caça-níqueis, que paga até 80.000x a aposta, o trilho de quem está no topo da escada
 * para no Platina — cinco trilhões vezes oitenta mil não cabe em ficha exata, e uma aposta
 * assim seria recusada depois de montada.
 *
 * Sem `maiorMultiplicador` (jogo que não publica quanto paga), devolve o degrau como está:
 * inventar um teto seria pior que não ter, e o servidor continua sendo quem valida.
 */
export function degrauQueCabeNaConta(
  escada: NivelDeMesa[],
  degrau: NivelDeMesa | null,
  maiorMultiplicador?: number,
): NivelDeMesa | null {
  if (!degrau || maiorMultiplicador === undefined) return degrau;
  if (!Number.isFinite(maiorMultiplicador) || maiorMultiplicador <= 0) return degrau;
  const maximoSeguro = Math.floor(TETO_DE_FICHAS / maiorMultiplicador);
  let i = escada.indexOf(degrau);
  if (i < 0) return degrau;
  while (i > 0 && escada[i].maximo > maximoSeguro) i -= 1;
  return escada[i];
}

/**
 * A faixa que o seletor de aposta usa: mínimo do degrau, saldo, e as fichas do degrau.
 *
 * @param maiorMultiplicador o maior retorno que ESTE jogo sabe pagar, em múltiplos da
 *   aposta — vem do `/config` dele. Faz o trilho parar onde a conta para de ser exata.
 */
export function faixaPara(
  escada: NivelDeMesa[],
  saldo: number,
  level: number,
  maiorMultiplicador?: number,
): FaixaDeAposta {
  const degrau = degrauQueCabeNaConta(
    escada,
    degrauEconomicoPara(escada, saldo, level),
    maiorMultiplicador,
  );
  return {
    minimo: degrau?.minimo ?? 0,
    saldo: Math.max(0, Math.floor(saldo)),
    fichas: degrau?.fichas ?? [],
    /*
     * O teto da conta, quando o jogo diz quanto paga. Sem ele, "tudo" de quem tem 146
     * bilhões monta 146 bilhões no caça-níqueis — e o servidor recusa em 112,6 bilhões.
     */
    maximo:
      maiorMultiplicador !== undefined && Number.isFinite(maiorMultiplicador) && maiorMultiplicador > 0
        ? Math.floor(TETO_DE_FICHAS / maiorMultiplicador)
        : undefined,
  };
}
