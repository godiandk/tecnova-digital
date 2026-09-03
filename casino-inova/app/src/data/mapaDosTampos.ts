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
 * entre as duas. Não é olhômetro; dá pra refazer a medição e conferir. Cada campo
 * abaixo diz qual varredura deu aquele número.
 *
 * O TAMANHO DA FICHA também é medido, e está em TAMANHO_DA_FICHA_NO_PANO.
 */

/** Uma área tocável do pano, em fração do tampo. */
export interface AreaDaMesa {
  /** Cantos, em fração: [esquerda, topo, direita, base]. */
  caixa: [number, number, number, number];
  /** O que anunciar pra leitor de tela. A arte tem o nome escrito, mas escrito não se ouve. */
  rotulo: string;
  /**
   * Onde a pilha de fichas assenta — o ponto em que a base da ficha de baixo encosta no
   * pano. É MEDIDO, não é o centro da caixa: o centro cai em cima do que está impresso,
   * e a arte não é pra ser coberta.
   *
   * A medição foi feita em duas varreduras da arte 1920x1080:
   *
   * 1. FAIXA DE FELTRO LIVRE — para cada linha do painel, conta pixels dourados (a
   *    letra e a moldura são douradas sobre feltro escuro). As linhas com quase nenhum
   *    dourado são feltro limpo. Resultado, em fração da altura da mesa:
   *      jogador  0.619 .. 0.781  (0.163 de altura livre)
   *      banca    0.619 .. 0.772  (0.154)
   *      empate   0.730 .. 0.804  (0.074 — o painel do empate é uma tabela de prêmios
   *                                e ocupa quase tudo; sobra só a tira de baixo)
   *    O `alvo.y` fica logo acima do fim de cada faixa.
   *
   * 2. CENTRO DO PAINEL NA LINHA DA FICHA — os painéis são trapézios em perspectiva, e
   *    o centro deles muda com a altura. Amostrando a linha y≈0.76 e separando por cor:
   *      jogador (azul)     de 0.035 a 0.355  → centro 0.190
   *      empate  (moldura)  de 0.380 a 0.610  → centro 0.495
   *      banca   (vermelho) de 0.650 a 0.900  → centro 0.775
   */
  alvo?: PontoDaMesa;
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
    jogador: { caixa: [0.067, 0.40, 0.369, 0.79], rotulo: 'Apostar no Jogador', alvo: { x: 0.19, y: 0.77 } },
    empate: { caixa: [0.385, 0.38, 0.6, 0.81], rotulo: 'Apostar no Empate', alvo: { x: 0.495, y: 0.796 } },
    banca: { caixa: [0.604, 0.4, 0.942, 0.79], rotulo: 'Apostar na Banca', alvo: { x: 0.775, y: 0.762 } },
  } satisfies Record<string, AreaDaMesa>,
  /**
   * Onde cada dado ASSENTA — no fundo do vidro, não flutuando no meio dele.
   *
   * O x saiu de varredura de brilho na arte: o latão do agitador é a coisa mais clara
   * daquela faixa contra o feltro escuro, e as quatro colunas acima do 90º percentil de
   * brilho dão os centros 0.293, 0.383, 0.613 e 0.703.
   *
   * O y saiu do perfil vertical da MESMA varredura, que separa o agitador em três
   * partes bem visíveis: 0.152–0.204 claro (a tampa de latão), 0.211–0.318 escuro (o
   * VIDRO, que deixa ver o feltro atrás), e 0.322–0.344 claro de novo (a base). O dado
   * assenta no fundo do vidro, um pouco acima da base: 0.285.
   *
   * Os dois primeiros são do jogador, os dois últimos da banca — a ordem importa, é ela
   * que liga cada dado ao lado que ele soma.
   */
  dados: [
    { x: 0.293, y: 0.285 },
    { x: 0.383, y: 0.285 },
    { x: 0.613, y: 0.285 },
    { x: 0.703, y: 0.285 },
  ] as PontoDaMesa[],
};

/**
 * O tamanho da ficha, em fração da LARGURA do tampo.
 *
 * De onde vem 0.054: a régua é a própria letra impressa no feltro. Uma ficha tem que
 * ler tão fácil quanto o nome da casa em que ela está — menor que isso e ela vira
 * um confete, maior e ela cobre a mesa. Medindo a altura das maiúsculas na arte:
 *   JOGADOR  0.0491 da altura da mesa
 *   BANCA    0.0704 (o painel da banca é desenhado mais perto, então maior)
 *   média    0.0598 da altura = 0.0336 da largura (a mesa é 16:9)
 * Uma ficha de cassino tem mais ou menos uma vez e meia a altura da letra que está ao
 * lado dela numa mesa de verdade; 1,6× dá 0.054 da largura do tampo.
 *
 * O piso em pixel existe porque abaixo de uns 44px o número impresso na ficha some, e
 * fração não protege disso: numa janela estreita 0.054 daria uma ficha ilegível.
 */
export const TAMANHO_DA_FICHA_NO_PANO = 0.054;
export const FICHA_MINIMA_NO_PANO = 44;

/**
 * A ficha do trilho é maior que a do pano: ela é ALVO DE TOQUE, e o mínimo confortável
 * pra um dedo é 44pt. 56 dá folga real, e o teto de 84 evita que numa tela grande o
 * trilho vire um cinto de fichas gigantes.
 */
export const TAMANHO_DA_FICHA_NO_TRILHO = 0.062;
export const FICHA_MINIMA_NO_TRILHO = 56;
export const FICHA_MAXIMA_NO_TRILHO = 84;

/**
 * Quanto de cada ficha aparece na pilha, em fração do diâmetro.
 *
 * Medido numa foto de pilha de fichas de verdade: seis fichas empilhadas ocupam cerca
 * de 1,2 diâmetro de altura, o que dá 0.20 por ficha. Menos que isso e a pilha vira
 * um borrão; mais e ela lê como fichas soltas equilibradas.
 */
export const PASSO_DA_PILHA = 0.2;

/**
 * Banca Francesa. Três casas impressas no feltro — a caixa "3 ASES" no canto, o arco
 * GRANDE (14/15/16) e o arco PEQUENO (5/6/7) — mais a LINHA, que é a aposta feita em
 * cima do traço que separa os dois arcos. Os dados são lançados na tigela de couro no
 * alto da mesa.
 *
 * COMO ESTES NÚMEROS FORAM OBTIDOS. Máscara de dourado sobre o feltro verde
 * (r>105, r>b+45, g>b+18, r>=g — calibrada por amostragem), fechamento morfológico pra
 * o traço fino virar figura inteira, e componentes conectados. Cada figura abaixo é uma
 * componente medida, exceto onde está dito o contrário:
 *
 *   tigela dos dados   x 0.3167..0.6823  y 0.1222..0.2722   (a maior figura da mesa)
 *   caixa 3 ASES       x 0.1698..0.2531  y 0.2444..0.3269
 *   arco GRANDE        x 0.2260..0.7714  y 0.3389..0.5056
 *   arco PEQUENO       x 0.1177..0.8766  y 0.4806..0.6963   (duas componentes, o texto
 *                                                            "PEQUENO" corta o arco)
 *   spot do PEQUENO    centro (0.4964, 0.6699)  0.057 x 0.077
 *   spot do GRANDE     centro (0.4990, 0.4710)  0.058 x 0.074  (medido no recorte: a
 *                      elipse encosta no arco, então sai junto na componente)
 *
 * AS CAIXAS DE TOQUE SÃO MAIORES QUE O DESENHO, e de propósito. Os arcos são curvos e a
 * área tocável é retangular; um retângulo colado no traço deixaria as pontas do arco de
 * fora. Como a área não pinta nada (ver CasaDeAposta), ser generosa não custa aparência
 * nenhuma — custa só não roubar toque da casa vizinha, e por isso GRANDE termina em
 * 0.478 e PEQUENO começa em 0.482.
 *
 * A LINHA é o caso especial. Ela não tem casa impressa porque na mesa de verdade ela não
 * é uma casa: é a ficha posta EM CIMA do traço entre Grande e Pequeno (o motor diz isso
 * na letra — metade em cada). Então a faixa dela fica exatamente sobre esse traço, e ela
 * é desenhada DEPOIS de Pequeno pra ganhar o toque na parte em que as duas se cruzam.
 */
export const MAPA_BANCA_FRANCESA = {
  apostas: {
    ases: {
      caixa: [0.155, 0.23, 0.27, 0.345],
      rotulo: 'Apostar em Ases, soma 3',
      alvo: { x: 0.2115, y: 0.322 },
    },
    grande: {
      caixa: [0.226, 0.3, 0.771, 0.478],
      rotulo: 'Apostar em Grande, 14, 15 ou 16',
      alvo: { x: 0.499, y: 0.5 },
    },
    pequeno: {
      caixa: [0.118, 0.482, 0.877, 0.72],
      rotulo: 'Apostar em Pequeno, 5, 6 ou 7',
      alvo: { x: 0.4964, y: 0.7 },
    },
    linha: {
      caixa: [0.35, 0.478, 0.65, 0.552],
      rotulo: 'Apostar na Linha, metade Grande e metade Pequeno',
      alvo: { x: 0.499, y: 0.548 },
    },
  } satisfies Record<string, AreaDaMesa>,
  /**
   * Os três dados dentro da tigela. A tigela mede 0.366 de largura por 0.150 de altura,
   * centrada em (0.4995, 0.1972); três dados espalhados nela cabem com folga em 0.42,
   * 0.50 e 0.58, um pouco abaixo do centro, que é onde o couro da tigela pega a luz.
   */
  dados: [
    { x: 0.42, y: 0.208 },
    { x: 0.5, y: 0.208 },
    { x: 0.58, y: 0.208 },
  ] as PontoDaMesa[],
};

/**
 * Quantas pilhas cabem lado a lado dentro de uma casa, e onde cada uma assenta.
 *
 * NUMA MESA CHEIA AS FICHAS NÃO PODEM SE MISTURAR. Se três pessoas apostam no JOGADOR e
 * as três pilhas caem no mesmo ponto, vira um monte só e ninguém sabe o que é de quem —
 * nem na hora de pagar, nem na hora de conferir. Num cassino isso se resolve de dois
 * jeitos ao mesmo tempo: a cor da ficha diz de quem é, e cada jogador põe a dele no
 * pedaço do pano que fica na frente do lugar dele.
 *
 * Aqui a segunda parte é esta função. A casa tem uma largura útil medida (o quanto de
 * feltro limpo ela tem naquela altura), e as pilhas se espalham dentro dela. Com uma
 * pilha só, ela fica no meio; com várias, elas se distribuem, e a que é sua fica no
 * mesmo lugar a rodada inteira.
 *
 * A LARGURA ÚTIL de cada casa saiu da mesma varredura que deu o `alvo`, amostrando a
 * linha onde as fichas ficam: jogador 0.035→0.355 (0.32), empate 0.380→0.610 (0.23),
 * banca 0.650→0.900 (0.25). Descontando meia ficha de cada ponta pra nenhuma pilha
 * encostar na moldura, sobra o que está em LARGURA_UTIL.
 */
export const LARGURA_UTIL: Record<string, number> = {
  // Bac Bo
  jogador: 0.3,
  empate: 0.21,
  banca: 0.23,
  /*
   * Banca Francesa. Os arcos são largos, então cabe muita pilha lado a lado; a caixa
   * dos Ases é pequena e a Linha é uma faixa estreita, e nessas duas as pilhas de mesa
   * cheia encostam uma na outra — que é o que acontece no feltro de verdade.
   */
  ases: 0.07,
  grande: 0.4,
  pequeno: 0.5,
  linha: 0.22,
};

/**
 * Onde a pilha de índice `indice`, de um total de `quantas`, assenta dentro da casa.
 *
 * As pilhas ficam LADO A LADO, encostadas no ponto da casa, e não espalhadas pela
 * largura toda. A diferença importa: com duas pessoas apostando num arco largo,
 * espalhar pela largura toda joga uma pilha em cada ponta do arco, longe do círculo
 * onde a ficha deveria ir — parecia que ninguém tinha apostado no mesmo lugar. Do jeito
 * certo, duas pilhas ficam encostadas uma na outra em cima do círculo, como na mesa.
 *
 * O grupo só começa a se comprimir quando não cabe mais: aí as pilhas se sobrepõem em
 * vez de sair da casa, que é o que o dealer faz numa mesa lotada.
 */
export function assentoDaPilha(
  area: AreaDaMesa,
  larguraUtil: number,
  indice: number,
  quantas: number,
  espacamento = TAMANHO_DA_FICHA_NO_PANO * 1.15,
): PontoDaMesa {
  const alvo = area.alvo ?? centroDe(area);
  if (quantas <= 1) return alvo;
  const passo = Math.min(espacamento, larguraUtil / (quantas - 1));
  const larguraDoGrupo = passo * (quantas - 1);
  return { x: alvo.x - larguraDoGrupo / 2 + indice * passo, y: alvo.y };
}
