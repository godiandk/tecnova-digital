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
import {
  ARCOS_DA_BANCA,
  ArcoMedido,
  CIRCULOS_DA_LINHA,
  PLAQUETA_DOS_ASES,
  PONTAS_DAS_CASAS,
  TIGELA_MEDIDA,
  alturaDoArco,
} from './arcosDaBanca';

/** Uma área tocável do pano, em fração do tampo. */
export interface AreaDaMesa {
  /**
   * FAIXAS QUE SEGUEM O CONTORNO IMPRESSO.
   *
   * Uma casa da Banca Francesa é um arco, e arco não é retângulo: a caixa envolvente do
   * GRANDE desce até 0,4988 no meio, enquanto a do PEQUENO já começa em 0,4821 nas
   * pontas — as duas se cruzam sem que os desenhos encostem. Com uma caixa só, quem
   * fosse desenhado por último roubava o toque da outra no cruzamento.
   *
   * Quando existem, é NELAS que se toca: uma escada de retângulos finos calculada a
   * partir dos arcos medidos, e não escrita à mão. A caixa continua existindo pra
   * posicionar as pilhas e pra dizer onde a casa começa e acaba.
   */
  tiras?: Array<[number, number, number, number]>;
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
  arco?: ArcoMedido;
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
  /**
   * O VIDRO de cada agitador — o espaço em que o dado pode se mexer lá dentro.
   *
   * MEDIDO NA ARTE, ampliando a faixa dos agitadores e lendo as bordas do cilindro de
   * vidro do segundo pote (o mais bem enquadrado): ele vai de 0.354 a 0.406 na
   * horizontal, com centro em 0.380 — que bate com o 0.383 do mapa. Na vertical o vidro
   * vai de 0.209 (logo abaixo da tampa de latão) a 0.324 (a base).
   *
   * ESTE NÚMERO É QUEM MANDA NO TAMANHO DO DADO, e não o contrário. Antes o dado era
   * 0.05 da largura do tampo, escolhido sozinho, e o vidro tem 0.052: o dado preenchia
   * o tubo inteiro. Não sobrava folga nenhuma pra ele se mexer, e qualquer arredondamento
   * o punha atravessando o vidro — que foi exatamente o que apareceu na tela.
   *
   * Agora o dado é uma fração DESTA largura (ver `dadoDentroDoVidro` em
   * medidasDaMesa.ts), então ele cabe por construção, em qualquer tamanho de tela.
   */
  vidroDoAgitador: { largura: 0.052, topo: 0.209, base: 0.324 },
};

/**
 * A ORDEM EM QUE OS AGITADORES DESLIGAM, e por que ela não é 1, 2, 3, 4.
 *
 * Os dados 0 e 1 são do JOGADOR (agitadores azuis, à esquerda) e os dados 2 e 3 são da
 * BANCA (vermelhos, à direita). Parar os dois de um lado e depois os dois do outro
 * entregaria o resultado no meio do caminho: com os dois do jogador já parados, quem
 * sabe somar já conhece metade da conta e fica só esperando.
 *
 * Alternando — vermelho, azul, vermelho, azul — nenhum dos dois lados fecha a soma
 * antes do último dado. O suspense dura até o fim, e dura porque a informação chega
 * dividida, não porque alguém está segurando o resultado.
 */
export const ORDEM_DE_PARAR_BAC_BO = [2, 0, 3, 1];





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
  /*
   * MEDIDA DE NOVO, e desta vez com componentes conectados em vez de cortes verticais.
   * A medição antiga errava feio no topo — dizia 0,163 onde a bandeja começa em 0,1213
   * (45 pixels em 1080) — e o `chao.base` de 0,262 passava 7 pixels por cima do aro de
   * latão da frente, que é onde o dado às vezes parecia entrar na moldura.
   *
   * `fora` é a bandeja inteira com o aro; `chao` é a caixa do couro claro, que é onde o
   * dado pode assentar. O motor usa `chao` como elipse: a elipse inscrita na caixa do
   * couro fica inteira dentro do couro, porque o couro é um estádio (retângulo com
   * pontas redondas) e estádio contém a elipse inscrita na sua caixa.
   */
  fora: TIGELA_MEDIDA.moldura,
  chao: TIGELA_MEDIDA.couro,
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

/**
 * QUANTAS TIRAS APROXIMAM UM ARCO.
 *
 * Com 14, cada tira tem cerca de 0,04 da largura e o degrau entre uma e outra fica
 * abaixo de 0,008 da altura — nove pixels na arte 1920x1080, menos que a espessura do
 * traço dourado. Com menos, a escada aparece no toque perto das pontas, onde o arco
 * sobe mais depressa.
 */
const TIRAS_POR_CASA = 14;

/**
 * A ESCADA QUE SEGUE A FAIXA.
 *
 * Para cada fatia de x, o topo é o arco de fora e o pé é o arco de dentro, avaliados nas
 * duas bordas da fatia e tomados pelo lado generoso — assim a tira cobre a faixa inteira
 * naquele pedaço, sem buraco entre uma tira e a seguinte. Ser generosa não custa nada:
 * a folga cai no feltro limpo entre as duas casas, que na arte é enorme (de 0,499 a
 * 0,604 no meio da mesa, e de 0,386 a 0,528 nas pontas).
 */
function tirasDaFaixa(fora: ArcoMedido, dentro: ArcoMedido, deX: number, ateX: number) {
  const tiras: Array<[number, number, number, number]> = [];
  for (let k = 0; k < TIRAS_POR_CASA; k += 1) {
    const x0 = deX + ((ateX - deX) * k) / TIRAS_POR_CASA;
    const x1 = deX + ((ateX - deX) * (k + 1)) / TIRAS_POR_CASA;
    const topo = Math.min(alturaDoArco(fora, x0), alturaDoArco(fora, x1));
    const base = Math.max(alturaDoArco(dentro, x0), alturaDoArco(dentro, x1));
    tiras.push([x0, topo, x1, base]);
  }
  return tiras;
}

/** A caixa envolvente de uma escada — é ela que posiciona as pilhas. */
function envolveAsTiras(tiras: Array<[number, number, number, number]>): [number, number, number, number] {
  return [
    Math.min(...tiras.map((t) => t[0])),
    Math.min(...tiras.map((t) => t[1])),
    Math.max(...tiras.map((t) => t[2])),
    Math.max(...tiras.map((t) => t[3])),
  ];
}

/** A caixa de um disco medido: exatamente o que está impresso, e nada além. */
function caixaDoDisco(disco: ArcoMedido): [number, number, number, number] {
  return [
    disco.centro.x - disco.raioX,
    disco.centro.y - disco.raioY,
    disco.centro.x + disco.raioX,
    disco.centro.y + disco.raioY,
  ];
}

const TIRAS_DO_GRANDE = tirasDaFaixa(
  ARCOS_DA_BANCA.grande.fora,
  ARCOS_DA_BANCA.grande.dentro,
  PONTAS_DAS_CASAS.grande.esquerda.x,
  PONTAS_DAS_CASAS.grande.direita.x,
);
const TIRAS_DO_PEQUENO = tirasDaFaixa(
  ARCOS_DA_BANCA.pequeno.fora,
  ARCOS_DA_BANCA.pequeno.dentro,
  PONTAS_DAS_CASAS.pequeno.esquerda.x,
  PONTAS_DAS_CASAS.pequeno.direita.x,
);

/**
 * ONDE A PILHA ASSENTA: entre o primeiro e o segundo algarismo, encostada no arco de
 * dentro.
 *
 * Não é no meio da casa, e a razão está impressa no pano: no meio fica o disco da linha.
 * Com a pilha no meio, a ficha do arco e a ficha da linha caíam uma em cima da outra e
 * era impossível ver qual era qual.
 *
 * E não é em cima de algarismo nenhum. Os letreiros foram medidos: o "14" ocupa
 * x 0,2938..0,3255 e o "15" começa em 0,4833; no PEQUENO o "5" vai até 0,2635 e o "6"
 * começa em 0,4875. Uma ficha centrada em 0,36 ocupa de 0,333 a 0,387 — o vão entre os
 * dois, nas duas casas. É a mesma escolha que um crupiê faz ao empurrar a ficha pro
 * feltro limpo em vez de largá-la em cima do número.
 *
 * O `arco` faz o resto: numa mesa cheia, as pilhas dos outros jogadores se espalham
 * seguindo a curva medida, e não numa reta.
 */
const X_DA_PILHA = 0.36;

export const MAPA_BANCA_FRANCESA = {
  apostas: {
    /*
     * A PLAQUETA DOS ASES, medida na componente conexa da moldura (1.068 pixels
     * dourados). Os cantos são chanfrados na arte, então a caixa é a envolvente deles.
     * A ficha cobre a plaqueta quase inteira porque a plaqueta é pequena — 90 pixels de
     * altura em 1080, menos que o diâmetro de uma ficha. Na mesa de verdade é igual: a
     * casa das Ases é do tamanho de uma ficha.
     */
    ases: {
      caixa: [
        PLAQUETA_DOS_ASES.caixa.esquerda,
        PLAQUETA_DOS_ASES.caixa.topo,
        PLAQUETA_DOS_ASES.caixa.direita,
        PLAQUETA_DOS_ASES.caixa.base,
      ],
      rotulo: 'Apostar em Ases, soma 3',
      alvo: {
        x: (PLAQUETA_DOS_ASES.caixa.esquerda + PLAQUETA_DOS_ASES.caixa.direita) / 2,
        y: PLAQUETA_DOS_ASES.caixa.base - 0.004,
      },
    },
    grande: {
      caixa: envolveAsTiras(TIRAS_DO_GRANDE),
      tiras: TIRAS_DO_GRANDE,
      rotulo: 'Apostar no centro do Grande, 14, 15 ou 16',
      alvo: { x: X_DA_PILHA, y: alturaDoArco(ARCOS_DA_BANCA.grande.dentro, X_DA_PILHA) },
      arco: ARCOS_DA_BANCA.grande.dentro,
    },
    pequeno: {
      caixa: envolveAsTiras(TIRAS_DO_PEQUENO),
      tiras: TIRAS_DO_PEQUENO,
      rotulo: 'Apostar no centro do Pequeno, 5, 6 ou 7',
      alvo: { x: X_DA_PILHA, y: alturaDoArco(ARCOS_DA_BANCA.pequeno.dentro, X_DA_PILHA) },
      arco: ARCOS_DA_BANCA.pequeno.dentro,
    },
    /*
     * A CAIXA DA LINHA É O DISCO IMPRESSO, e nada além dele.
     *
     * Era um retângulo de 0,120 x 0,125 em cima de um disco de 0,054 x 0,070 — duas
     * vezes mais largo e quase duas vezes mais alto que o desenho. Como a linha é
     * desenhada depois do arco, ela ganhava o toque em toda essa sobra: um dedo na
     * barriga do GRANDE caía na aposta que paga metade, sem nada na tela avisando. Era
     * isso o "quase chega a interferir".
     *
     * O disco encosta no arco de dentro de propósito (é onde a ficha fica a cavalo, como
     * na mesa), e essa sobreposição continua — mas agora ela é do tamanho do desenho.
     */
    'linha-grande': {
      caixa: caixaDoDisco(CIRCULOS_DA_LINHA.grande),
      rotulo: 'Apostar na linha do Grande, metade do risco e metade do prêmio',
      alvo: { x: CIRCULOS_DA_LINHA.grande.centro.x, y: CIRCULOS_DA_LINHA.grande.centro.y + CIRCULOS_DA_LINHA.grande.raioY },
    },
    'linha-pequeno': {
      caixa: caixaDoDisco(CIRCULOS_DA_LINHA.pequeno),
      rotulo: 'Apostar na linha do Pequeno, metade do risco e metade do prêmio',
      alvo: { x: CIRCULOS_DA_LINHA.pequeno.centro.x, y: CIRCULOS_DA_LINHA.pequeno.centro.y + CIRCULOS_DA_LINHA.pequeno.raioY },
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
  return { x, y: area.arco ? alturaDoArco(area.arco, x) : alvo.y };
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
  /*
   * O vidro na arte em pé.
   *
   * Os agitadores são os mesmos potes, só que a arte em pé é mais estreita, então cada
   * um ocupa mais fração da largura. A proporção entre o vidro e o espaço de um
   * agitador ao vizinho é a mesma da arte deitada (0.052 / 0.09 = 0.578), e aqui o
   * espaço entre vizinhos é 0.185 — daí a largura de 0.107.
   *
   * Na vertical a mesma altura de vidro ocupa MENOS fração, porque a tela em pé é bem
   * mais alta: 0.070 contra os 0.115 da deitada.
   */
  vidroDoAgitador: { largura: 0.107, topo: 0.236, base: 0.306 },
};

/** Largura útil de cada casa no tampo em pé, pras pilhas de mesa cheia. */
export const LARGURA_UTIL_EM_PE: Record<string, number> = {
  // Bac Bo
  jogador: 0.3,
  empate: 0.15,
  banca: 0.3,
  /*
   * Banca Francesa. Mais folgado que no tampo deitado porque no feltro em pé as faixas
   * atravessam a mesa inteira: as pilhas se espalham de lado sem chegar perto da borda,
   * e a de cada um continua no mesmo lugar a rodada inteira. A dos Ases é apertada
   * porque a casa é pequena — no feltro de verdade também é.
   */
  ases: 0.22,
  grande: 0.62,
  pequeno: 0.62,
  'linha-grande': 0.62,
  'linha-pequeno': 0.62,
};

/* ------------------------------------------------------------------------------------
 * A BANCA FRANCESA EM PÉ — a mesma mesa, outra composição.
 * ---------------------------------------------------------------------------------- */

/**
 * O mapa do feltro DESENHADO, o que entra num celular em pé.
 *
 * POR QUE EXISTE UMA SEGUNDA COMPOSIÇÃO. A arte 16:9 é a fotografia de uma mesa oval,
 * e mesa oval é larga. Num celular de 390 por 844 ela cabe com 390 de largura e 219 de
 * altura — uma tira de mesa no meio de duas faixas pretas, com o feltro ocupando um
 * quarto da tela. Não é problema de escala, é de forma: nenhum recorte e nenhum zoom
 * fazem uma elipse deitada caber bem numa tela em pé. Quem joga em cassino de celular
 * conhece a solução, que é a mesma de sempre: no retrato, o pano é redesenhado em
 * faixas empilhadas, de cima pra baixo, na ordem em que a mão alcança.
 *
 * O QUE ISSO CONSERTA DE QUEBRA. Aqui o desenho e a área de toque saem DO MESMO NÚMERO:
 * a faixa do GRANDE é pintada com esta caixa e é tocada por esta caixa. No tampo
 * fotografado as duas coisas são independentes — a arte foi pintada por um lado, as
 * frações foram medidas por outro — e é por isso que lá elas precisam de conferência
 * pra não se separarem. Aqui não há como se separarem.
 *
 * As frações são do PAINEL DESENHADO (o retângulo da mesa, couro incluído), do mesmo
 * jeito que as do tampo 16:9 são da arte inteira.
 */
export const TIGELA_DA_BANCA_EM_PE = {
  fora: { esquerda: 0.19, topo: 0.012, direita: 0.81, base: 0.118 },
  chao: { esquerda: 0.222, topo: 0.028, direita: 0.778, base: 0.104 },
};

/**
 * O ARCO, EM FRAÇÕES DA PRÓPRIA CASA.
 *
 * A curvatura veio da arte: o arco do GRANDE em 1920x1080 desce 0,084 da altura entre a
 * ponta e o meio, com meia-corda de 0,26 da largura. Mas guardar essa razão em cima da
 * LARGURA não serve pro pano desenhado: a flecha sairia em pixels da largura e viraria
 * uma fração diferente da ALTURA a cada formato de tela, e aí as frações deste mapa —
 * que são de altura — não valeriam mais. Então a mesma curvatura está escrita em cima da
 * altura da casa, que é a medida que o mapa usa.
 *
 * FLECHA: quanto a barriga do arco desce, em fração da altura da casa.
 * ESPESSURA: da borda de cima do arco até a de baixo, na mesma unidade.
 * NUMEROS: onde corre a linha dos algarismos, contada da borda de BAIXO pra cima — 0,65
 * põe ela no terço de cima, que é onde ela está na arte, deixando o resto da faixa livre
 * pra ficha. Foi isso que se perdeu quando a casa virou um retângulo com o nome no meio.
 */
export const ARCO_DA_CASA = { FLECHA: 0.3, ESPESSURA: 0.62, NUMEROS: 0.65 };

/**
 * A ALTURA DE UMA CASA É O QUE CABE DENTRO DELA, e não um número redondo.
 *
 * Cada arco tem que segurar, de cima pra baixo: o nome da casa, a linha dos números, e
 * uma ficha inteira encostada sem cobrir nem um nem outro. A ficha no pano nunca desce
 * abaixo de 44 pontos (é o mínimo em que a denominação ainda lê), então numa tela de
 * celular, com o painel em torno de 450 pontos de altura, a casa precisa de perto de
 * 0,22 da altura do painel. Foi disso que veio a reclamação que originou esta medida:
 * com 0,16, a ficha cobria o 14 e encostava no círculo da linha logo abaixo.
 */
export const MAPA_BANCA_EM_PE = {
  apostas: {
    /*
     * A CHAPA DOS ASES fica no alto e à ESQUERDA, como na arte: é a aposta de uma
     * combinação só (três ases, soma 3), e no feltro ela é uma plaquinha separada, com o
     * número em cima e o nome embaixo — não uma faixa como as outras.
     */
    ases: {
      caixa: [0.05, 0.145, 0.28, 0.285],
      rotulo: 'Apostar em Ases, soma 3',
      alvo: { x: 0.165, y: 0.278 },
    },
    /*
     * ONDE A PILHA ASSENTA NUMA FAIXA CURVA.
     *
     * A ficha não vai no meio: no meio fica o círculo da linha, e as duas pilhas
     * ficariam uma em cima da outra. Ela vai no terço esquerdo, encostada na borda de
     * BAIXO do arco naquele ponto — que é onde há feltro limpo, abaixo dos algarismos.
     *
     * A conta, feita uma vez e escrita aqui pra ninguém precisar refazer: com a caixa de
     * 0,05 a 0,95 a fração x = 0,30 cai a 0,278 da largura da casa, e o arco de baixo,
     * que no meio desce até 0,92 da altura da casa, naquele ponto está a 0,863. Daí
     * 0,305 + 0,863 x 0,225 = 0,499.
     */
    grande: {
      caixa: [0.05, 0.305, 0.95, 0.53],
      rotulo: 'Apostar no Grande, 14, 15 ou 16',
      alvo: { x: 0.3, y: 0.499 },
    },
    /*
     * O CÍRCULO DA LINHA É A ÁREA DA LINHA — nada além dele.
     *
     * Era um retângulo largo que entrava 0,08 da altura pra dentro do arco, e por isso a
     * aposta na linha "quase interferia" na do Grande: um toque na barriga do arco caía
     * na linha, que paga metade. Agora a caixa é do tamanho do círculo desenhado, e o
     * pedaço que ela divide com o arco é exatamente o pedaço onde o círculo está.
     */
    'linha-grande': {
      caixa: [0.38, 0.505, 0.62, 0.605],
      rotulo: 'Apostar na linha do Grande, metade do risco e metade do prêmio',
      alvo: { x: 0.5, y: 0.598 },
    },
    pequeno: {
      caixa: [0.03, 0.615, 0.97, 0.84],
      rotulo: 'Apostar no Pequeno, 5, 6 ou 7',
      alvo: { x: 0.3, y: 0.809 },
    },
    'linha-pequeno': {
      caixa: [0.38, 0.815, 0.62, 0.915],
      rotulo: 'Apostar na linha do Pequeno, metade do risco e metade do prêmio',
      alvo: { x: 0.5, y: 0.908 },
    },
  } satisfies Record<string, AreaDaMesa>,
  dados: assentosNaTigelaEmPe(),
};

function assentosNaTigelaEmPe(): PontoDaMesa[] {
  const { esquerda, direita, topo, base } = TIGELA_DA_BANCA_EM_PE.chao;
  const centroX = (esquerda + direita) / 2;
  const centroY = (topo + base) / 2;
  /*
   * O passo é maior que no tampo deitado (2,2) porque a tigela em pé é proporcionalmente
   * mais larga: com 2,2 os três dados ficavam amontoados no meio de um couro comprido.
   */
  const passo = DADO_NA_TIGELA * 2.9;
  return [-1, 0, 1].map((k) => ({ x: centroX + k * passo, y: centroY }));
}


