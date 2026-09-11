/**
 * As imagens da recompensa diária.
 *
 * O Metro exige `require` com caminho estático, então tudo aqui é escrito literal — mesma
 * regra dos outros mapas de imagem do projeto.
 *
 * MISSED NÃO TEM IMAGEM, e não precisa ter. O dia perdido é o selo FECHADO dessaturado e
 * com opacidade menor, por código — mesmo desenho, outro estado. Criar uma décima imagem
 * pra dizer "este dia passou" seria gastar arte pra repetir o que a posição no calendário
 * já diz.
 */
export const RECOMPENSA = {
  /** Dia que ainda não chegou. */
  seloFechado: require('../../assets/images/recompensas/selo-dia-fechado.png'),
  /** Hoje, e dá pra coletar. */
  seloAberto: require('../../assets/images/recompensas/selo-dia-aberto.png'),
  /** Já coletado. */
  seloColetado: require('../../assets/images/recompensas/selo-dia-coletado.png'),
  /** O marco de fim de mês. */
  cofreDoMes: require('../../assets/images/recompensas/cofre-do-mes.png'),
  /** O brilho da animação de coleta. */
  brilho: require('../../assets/images/recompensas/brilho-coletar.png'),
  fundoCelular: require('../../assets/images/recompensas/fundo-recompensas-celular.jpg'),
  fundoComputador: require('../../assets/images/recompensas/fundo-recompensas-computador.jpg'),
} as const;

/**
 * A pilha de fichas que ilustra o tamanho do prêmio.
 *
 * As três faixas são relativas ao MAIOR prêmio do mês, e não a números absolutos: o
 * calendário do nível 1 e o do nível 10.000 têm valores três vezes diferentes, e uma
 * régua fixa mostraria pilha pequena o mês inteiro num e pilha grande no outro.
 */
export function pilhaPara(premio: number, maiorDoMes: number): number {
  const fracao = maiorDoMes > 0 ? premio / maiorDoMes : 0;
  if (fracao >= 0.5) return PILHAS.grande;
  if (fracao >= 0.15) return PILHAS.media;
  return PILHAS.pequena;
}

const PILHAS = {
  pequena: require('../../assets/images/recompensas/pilha-fichas-pequena.png'),
  media: require('../../assets/images/recompensas/pilha-fichas-media.png'),
  grande: require('../../assets/images/recompensas/pilha-fichas-grande.png'),
} as const;

/** O estado de uma casa do calendário. É ele que escolhe o selo e a opacidade. */
export type EstadoDaCasa = 'LOCKED' | 'AVAILABLE' | 'CLAIMED' | 'MISSED';

/**
 * Em que estado está a casa `dia`, dado onde a pessoa está na sequência.
 *
 * A conta é toda relativa a `diaAtual` — a casa que está pra ser coletada agora:
 *   antes dela  -> já foi coletada nesta sequência (CLAIMED), ou perdida (MISSED)
 *   ela mesma   -> AVAILABLE se dá pra coletar hoje, CLAIMED se já coletou hoje
 *   depois dela -> LOCKED
 *
 * MISSED só existe quando a sequência caiu: aí a casa 1 volta a ser a atual e tudo que
 * estava para trás vira dia perdido, que é o que a tela precisa dizer sem rodeio.
 */
export function estadoDaCasa(
  dia: number,
  calendario: { diaAtual: number; podeColetar: boolean; sequenciaPerdida: boolean },
): EstadoDaCasa {
  if (dia < calendario.diaAtual) return calendario.sequenciaPerdida ? 'MISSED' : 'CLAIMED';
  if (dia > calendario.diaAtual) return 'LOCKED';
  return calendario.podeColetar ? 'AVAILABLE' : 'CLAIMED';
}

export function seloDoEstado(estado: EstadoDaCasa): number {
  if (estado === 'AVAILABLE') return RECOMPENSA.seloAberto;
  if (estado === 'CLAIMED') return RECOMPENSA.seloColetado;
  return RECOMPENSA.seloFechado; // LOCKED e MISSED usam o mesmo desenho
}
