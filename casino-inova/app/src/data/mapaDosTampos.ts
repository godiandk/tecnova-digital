/**
 * Onde fica cada coisa em cada tampo, em FRAÇÃO da mesa (0 a 1 em x e y).
 *
 * Este mapa é o que transforma a arte de fundo de tela em INTERFACE. Antes, a foto da
 * mesa era papel de parede e a jogada acontecia numa lista de botões escritos embaixo
 * dela — "Jogador ×2", "Banca ×1,95". Ninguém toca numa mesa de cassino assim: a ficha
 * vai NO PANO, na área marcada.
 *
 * POR QUE FRAÇÃO, E NÃO PIXEL. O guia da V3 proíbe, com razão, "posições absolutas
 * copiadas pixel a pixel de um screenshot" — isso quebra em qualquer tela de proporção
 * diferente. Fração é outra coisa: o tampo tem proporção fixa 16:9, o
 * `TampoDaMesa` calcula onde ele caiu na tela (com `contain`, sem cortar), e a fração
 * vira pixel a partir DESSE retângulo. Vale igual em 1920, em 1600 e em qualquer
 * janela no meio.
 *
 * COMO ESTES NÚMEROS FORAM OBTIDOS: medindo a imagem 1920x1080, por varredura de cor —
 * a área azul do JOGADOR e a vermelha da BANCA são detectáveis, e o EMPATE é o painel
 * entre as duas. Não é olhômetro; dá pra refazer a medição e conferir.
 */

/** Uma área tocável do pano, em fração do tampo. */
export interface AreaDaMesa {
  /** Cantos, em fração: [esquerda, topo, direita, base]. */
  caixa: [number, number, number, number];
  /** O que anunciar pra leitor de tela. A arte tem o nome escrito, mas escrito não se ouve. */
  rotulo: string;
}

/** Um ponto do tampo — onde uma carta pousa, onde um dado assenta. */
export type PontoDaMesa = { x: number; y: number };

export function centroDe(area: AreaDaMesa): PontoDaMesa {
  const [e, t, d, b] = area.caixa;
  return { x: (e + d) / 2, y: (t + b) / 2 };
}

/**
 * Bac Bo. Três áreas de aposta impressas no feltro e quatro agitadores no alto — dois
 * azuis pro JOGADOR, dois vermelhos pra BANCA, um dado em cada (ver o README da arte).
 */
export const MAPA_BAC_BO = {
  apostas: {
    jogador: { caixa: [0.067, 0.40, 0.369, 0.79], rotulo: 'Apostar no Jogador' },
    empate: { caixa: [0.385, 0.38, 0.600, 0.81], rotulo: 'Apostar no Empate' },
    banca: { caixa: [0.604, 0.40, 0.942, 0.79], rotulo: 'Apostar na Banca' },
  } satisfies Record<string, AreaDaMesa>,
  /**
   * Onde cada dado ASSENTA — no fundo do vidro, não flutuando no meio dele. O x saiu de
   * varredura de brilho na arte (o latão do agitador contra o feltro escuro): 0.287,
   * 0.376, 0.621, 0.714. Os dois primeiros são do jogador, os dois últimos da banca — a
   * ordem importa, é ela que liga cada dado ao lado que ele soma.
   */
  dados: [
    { x: 0.287, y: 0.255 },
    { x: 0.376, y: 0.255 },
    { x: 0.621, y: 0.255 },
    { x: 0.714, y: 0.255 },
  ] as PontoDaMesa[],
};
