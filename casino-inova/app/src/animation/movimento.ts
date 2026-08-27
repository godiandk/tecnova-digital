import { Easing } from 'react-native-reanimated';

/**
 * O vocabulário de movimento do Casino Inova.
 *
 * Existe por um motivo: app que anima cada tela com um tempo e uma curva diferentes
 * parece remendado, mesmo quando cada animação isolada está bonita. Aqui ficam os
 * poucos tempos e curvas que o app inteiro usa, e toda tela puxa daqui.
 *
 * A régua: quanto mais o movimento comunica ("suas fichas subiram"), mais tempo ele
 * merece. Quanto mais ele é só reação a um toque, mais rápido tem que ser — atraso em
 * resposta a toque é percebido como travamento, não como elegância.
 */
export const TEMPO = {
  /** Reação a toque. Acima disso o botão parece que travou. */
  toque: 120,
  /** Padrão pra aparecer, sumir, trocar de estado. */
  base: 260,
  /** Entrada de tela, revelação de carta. */
  entrada: 420,
  /** Contagem de fichas, preenchimento de barra — o número precisa ser acompanhado. */
  contagem: 900,
  /** Comemoração de vitória. */
  festa: 700,
} as const;

/**
 * Curvas.
 *
 * `saida` (ease-out) em quase tudo: o movimento começa rápido e desacelera, que é como
 * o olho espera que uma coisa pesada pare. Entrada linear parece robótica; ease-in
 * (começar devagar) parece lenta mesmo quando é rápida.
 */
export const CURVA = {
  saida: Easing.out(Easing.cubic),
  entrada: Easing.in(Easing.cubic),
  suave: Easing.inOut(Easing.cubic),
  /** Passa do alvo e volta — pra coisa que "chega" (ficha caindo, carta batendo). */
  elastica: Easing.out(Easing.back(1.6)),
} as const;

/** Mola pra reação de toque: firme, sem balanço bobo. */
export const MOLA = {
  damping: 18,
  stiffness: 260,
  mass: 0.6,
} as const;

/**
 * Atraso em cascata: o item N espera N × passo.
 *
 * É o que faz uma grade de cartazes "assentar" em vez de piscar toda de uma vez. O teto
 * existe pra que o último item de uma lista longa não demore uma eternidade.
 */
export function cascata(indice: number, passo = 55, teto = 8): number {
  return Math.min(indice, teto) * passo;
}
