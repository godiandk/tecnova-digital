/**
 * XP e nível: quanto uma rodada vale e quanto cada nível custa.
 *
 * ISTO NÃO EXISTIA. A tabela `users` tinha as colunas `level` e `xp`, a barra do topo
 * sabia desenhar o preenchimento, e as contas de semente nasciam com valores escritos à
 * mão — mas nenhuma linha de código somava XP quando alguém jogava. A barra ia ficar
 * parada pra sempre, e o nível de todo mundo congelado no que nasceu.
 *
 * A CURVA MOROU NO APP ATÉ AQUI, com um comentário admitindo que era provisório. Nível
 * é decisão do servidor: se o app calcula quanto falta pro próximo, dois aplicativos de
 * versões diferentes mostram barras diferentes pro mesmo XP, e nenhum dos dois é a
 * verdade. Agora quem responde é aqui, e o app só desenha o que recebe.
 *
 * COMO A RODADA VIRA XP, e por que assim:
 *
 * XP vem de JOGAR, nunca de ganhar ou de perder. Premiar vitória faria a barra andar
 * mais devagar justamente pra quem está perdendo, que é a última pessoa que deveria
 * receber um empurrão pra continuar. Premiar derrota seria pior ainda: um jogo que
 * recompensa perder. Aqui as duas coisas valem igual, porque o que está sendo
 * reconhecido é o tempo na mesa.
 *
 * O valor apostado conta, mas com RAIZ QUADRADA e com teto. Apostar 100 vezes mais não
 * pode dar 100 vezes mais XP — isso transformaria a barra num empurrão pra apostar
 * alto, que é exatamente o tipo de pressão que este projeto não faz. Com raiz, apostar
 * 100 vezes mais dá 10 vezes mais XP; com teto, a partir de certo ponto não dá mais
 * nada. E o +1 fixo garante que quem joga pequeno também anda.
 */

/** XP de uma rodada, a partir do que foi apostado nela. */
export function xpDaRodada(apostado: number): number {
  if (!Number.isFinite(apostado) || apostado <= 0) return 0;
  const daAposta = Math.floor(Math.sqrt(apostado / 10));
  return Math.min(1 + daAposta, XP_MAXIMO_POR_RODADA);
}

/** Teto de XP por rodada. Passando daqui, apostar mais não adianta pra barra. */
export const XP_MAXIMO_POR_RODADA = 50;

/**
 * Quanto XP o nível `nivel` precisa pra virar o seguinte.
 *
 * Cresce de 250 em 250: o nível 1 custa 500, o 2 custa 750, o 3 custa 1000. Devagar o
 * bastante pra subir de nível ser alguma coisa, rápido o bastante pra o primeiro
 * acontecer na primeira sessão — com apostas de 500, uma rodada dá 8 XP, então o nível
 * 2 chega em cerca de 60 rodadas.
 */
export function xpDoNivel(nivel: number): number {
  return 500 + Math.max(0, nivel - 1) * 250;
}

export interface Progresso {
  level: number;
  xp: number;
  /** Quanto falta pra virar de nível, a partir do XP atual. */
  xpToNextLevel: number;
  /** Quantos níveis subiram nesta rodada — 0 na maioria das vezes. */
  subiuNiveis: number;
}

/**
 * Soma XP e sobe de nível quantas vezes for preciso.
 *
 * O laço existe porque uma rodada grande pode passar de mais de um nível de uma vez —
 * raro, mas se acontecesse com um `if` a pessoa ficaria com XP acima do exigido e a
 * barra estourada, cheia além do fim, até a rodada seguinte.
 */
export function somarXp(level: number, xp: number, ganho: number): Progresso {
  let nivelNovo = Math.max(1, Math.floor(level));
  let xpNovo = Math.max(0, Math.floor(xp)) + Math.max(0, Math.floor(ganho));
  let subiu = 0;

  while (xpNovo >= xpDoNivel(nivelNovo)) {
    xpNovo -= xpDoNivel(nivelNovo);
    nivelNovo += 1;
    subiu += 1;
    // Trava de segurança: XP absurdo não pode virar laço infinito nem nível 900.
    if (subiu > 100) break;
  }

  return { level: nivelNovo, xp: xpNovo, xpToNextLevel: xpDoNivel(nivelNovo), subiuNiveis: subiu };
}
