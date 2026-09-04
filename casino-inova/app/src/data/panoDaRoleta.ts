import { RouletteBetType } from '../api/roulette';

/**
 * O PANO DA ROLETA, MONTADO PELA REGRA — não copiado de uma figura.
 *
 * Isto existe por um motivo concreto. A foto da mesa (tampos-16x9/roleta.webp) tem o
 * pano IMPRESSO ERRADO: medindo casa por casa, faltam o 27, o 28 e o 29, o 30 está
 * onde o 27 deveria estar, e as duas últimas fileiras estão deslocadas. Se a tela
 * usasse os números da arte como área de toque, quem encostasse a ficha no disco
 * escrito "30" estaria apostando em outra coisa — e não teria como saber.
 *
 * Então o pano é DESENHADO PELO APP, a partir da regra da roleta europeia, e a foto
 * fica só como mesa ao fundo. O número que aparece é o número em que se aposta, sempre.
 *
 * A DISPOSIÇÃO É A DA MESA DE VERDADE, virada pro celular: três fileiras de doze, com
 * a fileira dos múltiplos de 3 em cima, a dos 3n+2 no meio e a dos 3n+1 embaixo. Cada
 * fileira termina numa casa "2:1", que é a aposta de COLUNA daquela fileira — por isso
 * ela fica no fim dela, e não em qualquer lugar. As dúzias vêm embaixo, cada uma
 * cobrindo exatamente as quatro colunas de números que ela paga: quem olha vê o que a
 * caixa cobre, sem precisar decorar que "2ª dúzia" quer dizer 13 a 24.
 */

/** Os dezoito vermelhos da roleta europeia. Os outros 1..36 são pretos; o zero é verde. */
export const NUMEROS_VERMELHOS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type CorDaCasa = 'vermelho' | 'preto' | 'verde';

export function corDoNumero(n: number): CorDaCasa {
  if (n === 0) return 'verde';
  return NUMEROS_VERMELHOS.has(n) ? 'vermelho' : 'preto';
}

/** Uma aposta possível: o tipo, e o número quando o tipo é "numero". */
export interface CasaDoPano {
  /** Chave única desta casa — é por ela que a tela guarda as fichas encostadas. */
  chave: string;
  tipo: RouletteBetType;
  numero?: number;
  /** O que está escrito na casa. */
  rotulo: string;
  /** Como um leitor de tela anuncia a casa. */
  descricao: string;
  /** Quanto a casa devolve no total, incluindo a ficha apostada. */
  paga: number;
}

export function casaDeNumero(n: number): CasaDoPano {
  return {
    chave: `numero:${n}`,
    tipo: 'numero',
    numero: n,
    rotulo: String(n),
    descricao: n === 0 ? 'Zero, paga 36 vezes' : `Número ${n}, ${corDoNumero(n)}, paga 36 vezes`,
    paga: 36,
  };
}

/**
 * AS TRÊS FILEIRAS, de cima pra baixo, do jeito que a mesa é impressa.
 *
 * A de cima são os múltiplos de 3, a do meio os que sobram 2, a de baixo os que sobram
 * 1. É esta ordem que faz a casa "2:1" no fim da fileira ser a coluna daquela fileira.
 */
export const FILEIRAS: number[][] = [
  Array.from({ length: 12 }, (_, i) => i * 3 + 3),
  Array.from({ length: 12 }, (_, i) => i * 3 + 2),
  Array.from({ length: 12 }, (_, i) => i * 3 + 1),
];

/** A coluna que cada fileira paga, na mesma ordem de `FILEIRAS`. */
export const COLUNA_DA_FILEIRA: CasaDoPano[] = [
  { chave: 'coluna3', tipo: 'coluna3', rotulo: '2:1', descricao: 'Coluna de cima: 3, 6, 9 até 36. Paga 3 vezes', paga: 3 },
  { chave: 'coluna2', tipo: 'coluna2', rotulo: '2:1', descricao: 'Coluna do meio: 2, 5, 8 até 35. Paga 3 vezes', paga: 3 },
  { chave: 'coluna1', tipo: 'coluna1', rotulo: '2:1', descricao: 'Coluna de baixo: 1, 4, 7 até 34. Paga 3 vezes', paga: 3 },
];

export const DUZIAS: CasaDoPano[] = [
  { chave: 'duzia1', tipo: 'duzia1', rotulo: '1ª dúzia', descricao: 'Primeira dúzia, 1 a 12. Paga 3 vezes', paga: 3 },
  { chave: 'duzia2', tipo: 'duzia2', rotulo: '2ª dúzia', descricao: 'Segunda dúzia, 13 a 24. Paga 3 vezes', paga: 3 },
  { chave: 'duzia3', tipo: 'duzia3', rotulo: '3ª dúzia', descricao: 'Terceira dúzia, 25 a 36. Paga 3 vezes', paga: 3 },
];

/**
 * As apostas de fora, na ordem da mesa.
 *
 * `cor` faz a casa ser desenhada como o losango vermelho ou preto que a mesa tem, em vez
 * da palavra — é como a mesa física diz "vermelho" e "preto", e é o que deixa a fileira
 * caber num celular sem abreviar.
 */
export const APOSTAS_DE_FORA: Array<CasaDoPano & { cor?: 'vermelho' | 'preto' }> = [
  { chave: 'baixo', tipo: 'baixo', rotulo: '1-18', descricao: 'De 1 a 18. Paga 2 vezes', paga: 2 },
  { chave: 'par', tipo: 'par', rotulo: 'Par', descricao: 'Números pares. Paga 2 vezes', paga: 2 },
  { chave: 'vermelho', tipo: 'vermelho', rotulo: '', cor: 'vermelho', descricao: 'Vermelho. Paga 2 vezes', paga: 2 },
  { chave: 'preto', tipo: 'preto', rotulo: '', cor: 'preto', descricao: 'Preto. Paga 2 vezes', paga: 2 },
  { chave: 'impar', tipo: 'impar', rotulo: 'Ímpar', descricao: 'Números ímpares. Paga 2 vezes', paga: 2 },
  { chave: 'alto', tipo: 'alto', rotulo: '19-36', descricao: 'De 19 a 36. Paga 2 vezes', paga: 2 },
];

/** Toda casa do pano, pra a tela achar uma pela chave sem varrer três listas. */
export const CASAS_POR_CHAVE: Map<string, CasaDoPano> = new Map(
  [
    ...Array.from({ length: 37 }, (_, n) => casaDeNumero(n)),
    ...COLUNA_DA_FILEIRA,
    ...DUZIAS,
    ...APOSTAS_DE_FORA,
  ].map((c) => [c.chave, c]),
);

/**
 * A casa ganhou, dado o número que saiu?
 *
 * A CONTA É A MESMA DO SERVIDOR, e está aqui só pra ACENDER a casa vencedora na tela —
 * quem paga é o servidor, e o pagamento vem de lá em `results`. Duas cópias da regra
 * são um risco conhecido: se um dia elas discordarem, quem manda é o servidor e a tela
 * acende a casa errada. É por isso que a conferência (verifica-roleta.ts) roda contra a
 * definição de cada aposta, e não contra esta cópia.
 */
export function casaVenceu(casa: CasaDoPano, saiu: number): boolean {
  if (saiu === 0) return casa.tipo === 'numero' && casa.numero === 0;
  switch (casa.tipo) {
    case 'numero': return casa.numero === saiu;
    case 'vermelho': return NUMEROS_VERMELHOS.has(saiu);
    case 'preto': return !NUMEROS_VERMELHOS.has(saiu);
    case 'par': return saiu % 2 === 0;
    case 'impar': return saiu % 2 === 1;
    case 'baixo': return saiu <= 18;
    case 'alto': return saiu >= 19;
    case 'duzia1': return saiu <= 12;
    case 'duzia2': return saiu >= 13 && saiu <= 24;
    case 'duzia3': return saiu >= 25;
    case 'coluna1': return saiu % 3 === 1;
    case 'coluna2': return saiu % 3 === 2;
    case 'coluna3': return saiu % 3 === 0;
    default: return false;
  }
}
