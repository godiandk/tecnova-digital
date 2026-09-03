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
 * O TAMANHO de cada objeto — ficha, dado, pilha — não fica aqui: fica em
 * theme/medidasDaMesa.ts. Aqui é ONDE as coisas ficam; lá é QUÃO GRANDES elas são.
 */

import { DADO_NA_TIGELA, FICHA_NO_PANO } from '../theme/medidasDaMesa';

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
  /**
   * A curva que as fichas seguem, quando a casa é um arco e não um retângulo.
   *
   * Numa mesa reta as pilhas se espalham em linha e pronto. Num arco não: espalhar em
   * linha reta joga as pilhas das pontas pra fora do desenho, porque o arco sobe. Estes
   * pontos são o traço de baixo do arco, medidos na arte, e a pilha de cada pessoa
   * acha o próprio y interpolando entre eles.
   */
  arco?: PontoDaMesa[];
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
/**
 * O traço de baixo de cada arco, medido de 0.02 em 0.02 na arte 1920x1080.
 *
 * A ficha do CENTRO assenta neste traço e cresce pra dentro do arco — é onde ela
 * ficaria numa mesa, encostada na borda de baixo da caixa. Como o arco é curvo, o y
 * muda com o x, e sem esta curva as pilhas das pontas caíam fora do desenho.
 *
 * A medição pegou o traço dourado mais baixo de cada coluna, pulando a faixa central
 * (0.45 a 0.55) onde o círculo impresso esconde a linha. Os dois arcos saíram
 * simétricos em torno de x=0.5, como a arte promete.
 */
const ARCO_DO_GRANDE: PontoDaMesa[] = [
  { x: 0.28, y: 0.4348 }, { x: 0.32, y: 0.458 }, { x: 0.36, y: 0.4756 }, { x: 0.4, y: 0.4885 },
  { x: 0.44, y: 0.4969 }, { x: 0.5, y: 0.4975 }, { x: 0.56, y: 0.4959 }, { x: 0.6, y: 0.4876 },
  { x: 0.64, y: 0.4746 }, { x: 0.68, y: 0.457 }, { x: 0.72, y: 0.433 },
];

const ARCO_DO_PEQUENO: PontoDaMesa[] = [
  { x: 0.2, y: 0.6102 }, { x: 0.24, y: 0.6324 }, { x: 0.28, y: 0.6519 }, { x: 0.32, y: 0.6667 },
  { x: 0.36, y: 0.6787 }, { x: 0.4, y: 0.688 }, { x: 0.44, y: 0.6935 }, { x: 0.5, y: 0.694 },
  { x: 0.56, y: 0.6935 }, { x: 0.6, y: 0.687 }, { x: 0.64, y: 0.6787 }, { x: 0.68, y: 0.6667 },
  { x: 0.72, y: 0.6509 }, { x: 0.76, y: 0.6324 }, { x: 0.8, y: 0.6093 },
];

/**
 * A TIGELA DE COURO onde os dados são lançados, medida na arte.
 *
 * A moldura inteira (latão + couro) vai de x 0.3245 a 0.6630 e de y 0.1630 a 0.2722 —
 * é a maior figura clara da mesa, isolada por brilho alto com saturação quente contra
 * o feltro escuro (brilho 94–161 e saturação 50–62 dentro, contra brilho 11–22 e
 * saturação 14–18 no feltro em volta).
 *
 * O CHÃO DE COURO, que é onde o dado pode parar, sai do corte vertical no centro da
 * tigela: a moldura de cima ocupa 0.163 a 0.185, o couro vai de 0.185 a 0.262, e a
 * beirada da frente pega luz de novo em 0.265 a 0.272. Descontando as pontas
 * arredondadas nas laterais, sobra a faixa abaixo.
 */
export const TIGELA_DA_BANCA = {
  /** A moldura inteira, pra quem precisar desenhar em volta. */
  fora: { esquerda: 0.3245, topo: 0.163, direita: 0.663, base: 0.2722 },
  /** O couro útil: onde o dado assenta sem encostar na moldura. */
  chao: { esquerda: 0.355, topo: 0.185, direita: 0.635, base: 0.262 },
};



/**
 * Os três lugares onde os dados param, lado a lado dentro da tigela.
 *
 * O espaçamento é 2,2 vezes o lado do dado: junta os três num grupo que lê como um
 * lançamento só, e ainda sobra 0.058 de couro de cada lado — nenhum dado encosta na
 * moldura, nem no maior tamanho de tela.
 */
function assentosNaTigela(): PontoDaMesa[] {
  const { esquerda, direita, topo, base } = TIGELA_DA_BANCA.chao;
  const centroX = (esquerda + direita) / 2;
  const centroY = (topo + base) / 2;
  const passo = DADO_NA_TIGELA * 2.2;
  return [-1, 0, 1].map((k) => ({ x: centroX + k * passo, y: centroY }));
}

export const MAPA_BANCA_FRANCESA = {
  apostas: {
    ases: {
      caixa: [0.155, 0.23, 0.27, 0.345],
      rotulo: 'Apostar em Ases, soma 3',
      alvo: { x: 0.2115, y: 0.322 },
    },
    grande: {
      caixa: [0.226, 0.3, 0.771, 0.505],
      rotulo: 'Apostar no centro do Grande, 14, 15 ou 16',
      alvo: { x: 0.34, y: 0.4672 },
      arco: ARCO_DO_GRANDE,
    },
    pequeno: {
      caixa: [0.118, 0.51, 0.877, 0.72],
      rotulo: 'Apostar no centro do Pequeno, 5, 6 ou 7',
      alvo: { x: 0.32, y: 0.6667 },
      arco: ARCO_DO_PEQUENO,
    },
    'linha-grande': {
      caixa: [0.44, 0.42, 0.56, 0.545],
      rotulo: 'Apostar na linha do Grande, metade do risco e metade do prêmio',
      alvo: { x: 0.499, y: 0.519 },
    },
    'linha-pequeno': {
      caixa: [0.44, 0.62, 0.56, 0.745],
      rotulo: 'Apostar na linha do Pequeno, metade do risco e metade do prêmio',
      alvo: { x: 0.4964, y: 0.718 },
    },
  } satisfies Record<string, AreaDaMesa>,
  /** Onde os dados param depois de lançados. Ver TIGELA_DA_BANCA. */
  dados: assentosNaTigela(),
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
  /*
   * O centro se espalha pelo arco, mas nunca até o meio: ali fica o círculo, que é o
   * lugar da LINHA. Uma pilha de centro pousada em cima do círculo faria a mesa mentir
   * sobre qual aposta ela é.
   */
  grande: 0.16,
  pequeno: 0.18,
  'linha-grande': 0.08,
  'linha-pequeno': 0.08,
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
  espacamento = FICHA_NO_PANO * 1.15,
): PontoDaMesa {
  const alvo = area.alvo ?? centroDe(area);
  if (quantas <= 1) return alvo;
  const passo = Math.min(espacamento, larguraUtil / (quantas - 1));
  const larguraDoGrupo = passo * (quantas - 1);
  const x = alvo.x - larguraDoGrupo / 2 + indice * passo;
  return { x, y: area.arco ? alturaNoArco(area.arco, x) : alvo.y };
}

/** O y do arco num x qualquer, interpolando entre os pontos medidos. */
function alturaNoArco(arco: PontoDaMesa[], x: number): number {
  if (x <= arco[0].x) return arco[0].y;
  const ultimo = arco[arco.length - 1];
  if (x >= ultimo.x) return ultimo.y;
  for (let i = 1; i < arco.length; i += 1) {
    if (x <= arco[i].x) {
      const a = arco[i - 1];
      const b = arco[i];
      return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
    }
  }
  return ultimo.y;
}

/**
 * Bac Bo NO TAMPO EM PÉ — a arte de celular (1284x2778), que é outra composição.
 *
 * Não é o tampo deitado recortado: as casas são três caixas de contorno dourado numa
 * fileira alta e estreita, sem os painéis azul e vermelho, e os quatro agitadores ficam
 * numa prateleira de vidro no alto em vez de recuados no fundo da mesa. Por isso o mapa
 * é outro — reaproveitar as frações do deitado poria as fichas no lugar errado.
 *
 * COMO ESTES NÚMEROS FORAM OBTIDOS. As caixas são trapézios, porque a mesa abre em
 * perspectiva do fundo pra frente, então as bordas foram medidas linha a linha na
 * máscara de dourado:
 *
 *   y=0.36  bordas em 0.090  0.416  0.585  0.907
 *   y=0.55  bordas em 0.037  0.400  0.599  0.960
 *   y=0.62  bordas em 0.026  0.394  0.604  0.968
 *
 * e as duas linhas horizontais que fecham a fileira estão em y 0.331 e y 0.646. A ficha
 * assenta embaixo (y 0.62), onde o feltro está limpo — em cima ficam o nome da casa e
 * os dados desenhados.
 *
 * OS AGITADORES foram medidos no recorte da prateleira: quatro, centrados em x 0.225,
 * 0.410, 0.590 e 0.775, com a base do vidro em y 0.268.
 *
 * UM AVISO SOBRE ESTA ARTE, que não é problema de código: ela diz PLAYER, TIE e BANKER
 * em inglês, enquanto o tampo deitado diz JOGADOR, EMPATE e BANCA em português. O mesmo
 * jogo fala duas línguas conforme o aparelho. Os rótulos abaixo estão em português
 * porque é o que o leitor de tela anuncia e é a língua do aplicativo; quem for refazer
 * a arte de celular deve alinhar as palavras impressas com as do tampo deitado.
 */
export const MAPA_BAC_BO_EM_PE = {
  apostas: {
    jogador: {
      caixa: [0.03, 0.335, 0.398, 0.645],
      rotulo: 'Apostar no Jogador',
      alvo: { x: 0.21, y: 0.62 },
    },
    empate: {
      caixa: [0.402, 0.335, 0.596, 0.645],
      rotulo: 'Apostar no Empate',
      alvo: { x: 0.499, y: 0.62 },
    },
    banca: {
      caixa: [0.6, 0.335, 0.97, 0.645],
      rotulo: 'Apostar na Banca',
      alvo: { x: 0.786, y: 0.62 },
    },
  } satisfies Record<string, AreaDaMesa>,
  dados: [
    { x: 0.225, y: 0.268 },
    { x: 0.41, y: 0.268 },
    { x: 0.59, y: 0.268 },
    { x: 0.775, y: 0.268 },
  ] as PontoDaMesa[],
};

/** Largura útil de cada casa no tampo em pé, pras pilhas de mesa cheia. */
export const LARGURA_UTIL_EM_PE: Record<string, number> = {
  jogador: 0.3,
  empate: 0.15,
  banca: 0.3,
};
