/**
 * O QUE ESTÁ REALMENTE DESENHADO NO PANO DA BANCA FRANCESA, medido pixel a pixel.
 *
 * POR QUE ESTE ARQUIVO EXISTE. O `MAPA_BANCA_FRANCESA` descreve cada casa como um
 * RETÂNGULO, e a arte não tem retângulo nenhum: tem duas FAIXAS EM ARCO, cada uma
 * fechada por um bico reto em cada ponta, com um disco pendurado no meio. Retângulo
 * chutado por cima de arco dá os dois defeitos que se vê na tela: sobra pouco pano pra
 * encostar ficha no GRANDE e no PEQUENO (o retângulo cobre o desenho, não a faixa), e a
 * caixa da LINHA invade a do arco (o disco impresso tem 0,054 x 0,070 da arte e a caixa
 * da linha tem 0,120 x 0,125 — 2,2× mais larga e 1,8× mais alta que o desenho).
 *
 * Aqui não tem chute. Cada número abaixo saiu de uma varredura da arte
 * `assets/images/tampos-16x9/computador/banca-francesa.webp` (1920x1080), e a
 * conferência `verificacao/verifica-arcos-da-banca.mjs` REFAZ a medição em Node e
 * reprova a diferença acima de 0,004 de fração. Se alguém mexer num número daqui sem
 * medir, ela quebra na hora.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * COMO FOI MEDIDO, em cinco passos (o mesmo que a conferência refaz)
 *
 * 1. MÁSCARA DE DOURADO. `(r > 85) && (r - b > 30) && (g > 55)` sobre o feltro verde
 *    escuro. Dá 165.944 pixels, 8,00% da arte.
 *
 * 2. PENEIRA DE COMPONENTE. Dentro da janela de cada casa, só ficam as componentes
 *    conexas grandes — que são as DUAS METADES da faixa (3.402 e 3.405 pixels no
 *    GRANDE; 5.394 e 5.340 no PEQUENO). Tudo que é menor é letra, algarismo ou o disco
 *    da linha: no GRANDE são 14 manchas somando 4.842 pixels, no PEQUENO 48 manchas
 *    somando 7.804. O corte foi posto em 1.500 pixels, e não há nada entre 1.131 (o
 *    maior descarte, o disco do PEQUENO) e 3.402 (a menor metade de faixa) — a peneira
 *    separa sem ambiguidade.
 *
 * 3. CORRIDA FINA. Seguindo o traço coluna a coluna, só vale corrida vertical de até
 *    6 px de dourado. O traço tem 3 a 5 px; letra e algarismo são manchas de 8 a 30 px.
 *    Este segundo filtro pegou o que escapou do primeiro: 3 colunas no GRANDE e 5 no
 *    PEQUENO (é onde o traço passa raspando numa letra).
 *
 * 4. TIRAR O BICO. A casa não acaba em quina redonda: acaba num BICO — um segmento RETO
 *    que fecha a ponta. E ele vira pro outro lado: no bico esquerdo do GRANDE a
 *    inclinação do segmento é −0,409 enquanto a do arco na quina é +0,466, quase o
 *    espelho. É isso que dá o corte exato, sem depender de resíduo: o arco é MONÓTONO do
 *    ápice pra cada lado, então andando do ápice pra fora basta parar quando o y voltar
 *    a subir mais de 1 px. Isso tirou 204 colunas no arco de fora do GRANDE (x 433..537 e
 *    1380..1481) e 186 no do PEQUENO (x 226..321 e 1589..1683) — pontos que estão em
 *    média 44 px e 51 px longe da elipse do arco, contra 0,4 px dos que ficaram. O arco
 *    de DENTRO não tem bico (vai de ponta a ponta) e saiu com ZERO colunas descartadas:
 *    é a prova de que o critério não está cortando arco bom por engano.
 *
 *    A FOLGA DE 1 PX NÃO É PALPITE, E JÁ ESTEVE ERRADA. O centro de uma corrida de 3 ou
 *    4 px cai numa grade de meio pixel, então duas colunas vizinhas do mesmo traço podem
 *    diferir 1 px só por arredondamento — a folga precisa absorver isso. Com folga de
 *    2 px a varredura passava seis colunas ALÉM da quina (ia até x=1382 no GRANDE, quando
 *    a quina está em 1379), e a curva ajustada errava esses pontos em 5,2 px na vertical,
 *    acima dos 4,3 px que a conferência aceita. Com folga de 1 px, os 6.239 pontos dos
 *    seis arcos ficam TODOS a menos de 3,5 px da curva (o pior é 3,44 px). E com folga 0
 *    o corte come arco bom: o de fora do PEQUENO desabava de 1.218 pontos para 63.
 *
 * 5. AJUSTE. Círculo (x²+y²+Dx+Ey+F=0) e elipse alinhada aos eixos (x²+Cy²+Dx+Ey+F=0),
 *    os dois por mínimos quadrados LINEARES em coordenadas normalizadas — forma
 *    fechada, sem otimizador. Isso é de propósito: a conferência em Node refaz a mesma
 *    conta e chega ao MESMO número, em vez de "quase o mesmo".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * POR QUE ELIPSE E NÃO CÍRCULO, nos seis arcos
 *
 * A mesa é uma FOTO, então os arcos estão em perspectiva e não são círculos. Isso não é
 * palpite: o resíduo do ajuste circular é SISTEMÁTICO e simétrico em torno de x=0,5 —
 * medindo o resíduo médio em doze faixas de x do arco de dentro do GRANDE dá
 * −2,1 / +2,5 / +1,6 / +0,2 / −0,9 / −1,8 / −1,9 / −1,2 / −0,1 / +1,2 / +2,2 / −1,4 px.
 * Isso é curvatura que falta ao modelo, não ruído de traço.
 *
 * O pior ponto do ajuste CIRCULAR chega a 8,8 px no arco de dentro do GRANDE e 7,7 px
 * no do PEQUENO — 0,008 da altura, o dobro da folga de 0,004 que a conferência exige.
 * A elipse derruba o erro médio de todos os seis para 0,32 a 0,55 px. Por isso os seis
 * usam elipse: um conjunto misto (uns círculo, outros elipse) seria pior de consumir e
 * não teria como se justificar, já que a perspectiva vale pra mesa inteira.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * O QUE A ARTE TEM E O PEDIDO NÃO PREVIA
 *
 * O pedido descrevia TRÊS arcos por casa (fora, linha dos números, dentro). A arte tem
 * DOIS traços desenhados. O que parece um terceiro é o bico reto das pontas, que sobe
 * enquanto o arco desce. Foi conferido coluna a coluna: em x=680 a janela inteira do
 * GRANDE tem exatamente duas corridas de dourado (y 413..416 e y 508..511), e o mesmo
 * em qualquer coluna longe de letra.
 *
 * A "linha dos números" não é traço: é ONDE OS ALGARISMOS ESTÃO. E eles não estão todos
 * na mesma curva, o que é a descoberta que mais muda o desenho da área de toque:
 *
 *   - 14, 16, 5 e 7 estão no MEIO da faixa. Comparando o centro de cada algarismo com a
 *     curva `numeros` na mesma coluna: 14 erra 1,9 px, 16 erra 0,5 px, 5 erra 1,3 px e
 *     7 erra 3,2 px. Quatro de quatro.
 *   - 15 e 6 estão LEVANTADOS, sentados em cima do arco de FORA, que eles INTERROMPEM —
 *     é por causa deles que a máscara parte cada faixa em duas metades. O centro do "15"
 *     está 58 px ACIMA do meio da faixa, e o do "6" 53 px. O motivo está desenhado: no
 *     centro o meio da faixa é ocupado pelo DISCO da linha, e o algarismo foi subido pra
 *     sair da frente dele.
 *
 * Por isso `numeros` abaixo é a linha do MEIO da faixa (o lugar de 14/16/5/7), medida
 * como o ponto médio entre os dois arcos coluna a coluna e ajustada como os outros —
 * e NÃO um traço que exista na arte. Está dito aqui pra ninguém procurar esse traço.
 *
 * Outras coisas que a arte tem e o mapa de hoje ignora:
 *   - os BICOS: a casa vai mais longe do que o arco de fora sugere (o GRANDE começa em
 *     x=0,2255 e o arco de fora só em x=0,2802);
 *   - o arco de FORA inteiro (o mapa só tem o de dentro, em `ARCO_DO_GRANDE`/
 *     `ARCO_DO_PEQUENO` — conferido: batem com `dentro` daqui dentro de 0,0036);
 *   - as duas faixas se ENCAIXAM sem sobrar feltro: o arco de dentro do GRANDE tem ápice
 *     em y=0,4988 e o arco de fora do PEQUENO chega ao seu ponto mais alto, y≈0,481, nas
 *     quinas dos bicos (x=0,168 e x=0,827). Quem cortar a caixa do GRANDE em 0,505 e
 *     começar a do PEQUENO em 0,510 — que é o mapa de hoje — come um pedaço das duas: as
 *     quinas do PEQUENO ficam ACIMA de 0,510, e o GRANDE nunca chega ao seu ápice.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * O TABLET É A MESMA COMPOSIÇÃO
 *
 * `tampos-16x9/tablet/banca-francesa.webp` (1600x900) foi medido com o mesmo programa.
 * Comparando as CURVAS (não os parâmetros), a maior distância entre a arte de computador
 * e a de tablet ao longo dos seis arcos é 0,00022 da altura — um quarto de pixel em 1080.
 * Os ápices batem em 0,00012 e os discos em 0,0001. É a mesma arte em outra resolução, e
 * o mesmo mapa serve pras duas. Pelo critério bruto de parâmetro a parte, a maior
 * divergência entre as duas artes é 0,00344 — também dentro da folga de 0,004.
 *
 * ATENÇÃO A UMA ARMADILHA que aparece nessa comparação: no arco de FORA do GRANDE,
 * `centro.y` diverge 0,00344 entre as duas artes e `raioY` diverge 0,00336 — mas a SOMA
 * deles, que é o ápice do arco, diverge 0,00012. O ajuste de elipse num arco raso tem
 * uma direção mole em que centro e raio deslizam juntos sem mudar a curva. Ou seja:
 * comparar `raioY` de uma arte com outra diz pouco; comparar a CURVA diz tudo. Dentro
 * da MESMA arte o número é firme, e a conferência checa as duas coisas — os parâmetros
 * e a curva.
 */

/** O tamanho da arte em que tudo aqui foi medido. Toda fração se refere a ela. */
export const ARTE_DA_BANCA = { largura: 1920, altura: 1080 } as const;

/**
 * Um arco medido na arte, como elipse alinhada aos eixos.
 *
 * Em pixels da arte:  x = centro.x·largura + raioX·largura·cos(t)
 *                     y = centro.y·altura  + raioY·altura ·sin(t)
 *
 * CUIDADO COM raioX E raioY. `raioX` é fração da LARGURA e `raioY` é fração da ALTURA,
 * igual a `centro.x` e `centro.y` — é a convenção do `mapaDosTampos.ts`, e é o que faz
 * a conta acima devolver o pixel certo. Como a arte é 16:9, isso quer dizer que um
 * círculo PERFEITO em pixel sai daqui com raioX ≠ raioY (na razão 9/16). Não é erro de
 * medição: é a unidade. Quem quiser o raio em pixel multiplica cada um pelo seu lado.
 */
export interface ArcoMedido {
  /** Centro da elipse, em fração da largura (x) e da altura (y). */
  centro: { x: number; y: number };
  /** Semieixo horizontal, em fração da LARGURA. */
  raioX: number;
  /** Semieixo vertical, em fração da ALTURA. */
  raioY: number;
  /**
   * Extensão angular do trecho que existe na arte, em GRAUS do parâmetro `t` acima.
   * 0 = leste e cresce PRA BAIXO (é a orientação da tela, y cresce descendo). Os arcos
   * das casas são vales: o centro da elipse fica ACIMA deles, então t vai de ~33° (a
   * ponta direita) a ~147° (a ponta esquerda), passando por 90° no ápice.
   */
  deAngulo: number;
  ateAngulo: number;
  /** x das duas pontas do trecho medido, em fração da largura. Útil pra recortar. */
  deX: number;
  ateX: number;
  /** Erro do ajuste, em PIXELS da arte 1920x1080 — pra quem duvidar. */
  erroMedioEmPixels: number;
  erroPiorEmPixels: number;
  /** Quantos pontos do traço entraram no ajuste. */
  pontos: number;
}

/** Uma caixa medida na arte, em fração. */
export interface CaixaMedida {
  esquerda: number;
  topo: number;
  direita: number;
  base: number;
}

/** Um ponto na arte, em fração. */
export interface PontoMedido {
  x: number;
  y: number;
}

/**
 * OS SEIS ARCOS.
 *
 * `fora` e `dentro` são os dois traços que existem no pano. `numeros` é a linha do meio
 * da faixa, calculada coluna a coluna (ver o cabeçalho) — é onde 14, 16, 5 e 7 estão, e
 * NÃO é um traço desenhado.
 *
 * Para cada um está anotado: quantos pontos entraram, quantos foram descartados por
 * serem do bico, e quanto erraria o ajuste CIRCULAR — que é a alternativa recusada.
 */
export const ARCOS_DA_BANCA = {
  grande: {
    /*
     * Arco de FORA do GRANDE. 985 colunas seguidas na máscara; 204 saíram por serem do
     * bico reto das pontas; 781 no ajuste, de x=538 a x=1379 (a quina do bico esquerdo
     * está em x=538, y=365). Elipse: médio 0,35 px, pior 2,94 px.
     * Círculo recusado: centro (958,0 , −688,7), R=1136,8 px, médio 0,67 px, pior 2,62 px
     * — o pior é quase igual, mas o médio é 1,9× maior e o resíduo é sistemático.
     * Ápice (centro.y + raioY) = 0,41399.
     */
    fora: {
      centro: { x: 0.49894, y: 0.14448 },
      raioX: 0.31462,
      raioY: 0.26951,
      deAngulo: 46.25,
      ateAngulo: 133.81,
      deX: 0.28021,
      ateX: 0.71823,
      erroMedioEmPixels: 0.35,
      erroPiorEmPixels: 2.94,
      pontos: 781,
    },
    /*
     * Linha dos NÚMEROS do GRANDE — meio da faixa, 759 colunas (as colunas em que os dois
     * arcos existem ao mesmo tempo). Elipse: médio 0,32 px, pior 1,53 px.
     * Círculo recusado: médio 0,46 px, pior 1,89 px. Ápice = 0,45657.
     * Confere com o desenho: em x=0,30964 (centro do "14") esta curva dá y=0,40514 e o
     * centro do algarismo está em y=0,40694 — 1,9 px. No "16", 0,5 px.
     */
    numeros: {
      centro: { x: 0.49863, y: 0.14311 },
      raioX: 0.34437,
      raioY: 0.31346,
      deAngulo: 50.56,
      ateAngulo: 129.29,
      deX: 0.28021,
      ateX: 0.71823,
      erroMedioEmPixels: 0.32,
      erroPiorEmPixels: 1.53,
      pontos: 759,
    },
    /*
     * Arco de DENTRO do GRANDE. Vai de bico a bico (x=433 a x=1481), sem trecho reto:
     * 963 colunas seguidas, 963 no ajuste, ZERO descartadas pelo critério do bico — é a
     * prova de que o critério não corta arco bom. Tem uma interrupção real de 61 colunas
     * (x 924..984), onde o disco da linha passa por cima; a varredura atravessa isso com
     * duas sementes, uma de cada lado. Elipse: médio 0,47 px, pior 2,74 px.
     * Círculo recusado: R=1180,5 px, médio 1,60 px, PIOR 8,78 px — é este que estoura a
     * folga de 0,004 da altura (4,3 px) e condena o círculo.
     * Ápice = 0,49882 — que é onde o PEQUENO começa a encostar.
     */
    dentro: {
      centro: { x: 0.49857, y: 0.23631 },
      raioX: 0.32689,
      raioY: 0.26251,
      deAngulo: 33.45,
      ateAngulo: 146.78,
      deX: 0.22552,
      ateX: 0.77135,
      erroMedioEmPixels: 0.47,
      erroPiorEmPixels: 2.74,
      pontos: 963,
    },
  },
  pequeno: {
    /*
     * Arco de FORA do PEQUENO. 1404 colunas; 186 do bico; 1218 no ajuste (a quina do bico
     * esquerdo está em x=322, y=520). Elipse: médio 0,46 px, pior 3,12 px.
     * Círculo recusado: R=1608,3 px, médio 0,92 px, pior 4,07 px.
     * Ápice = 0,60434 — é o ponto mais BAIXO do arco, no centro da mesa. O mais ALTO é a
     * quina do bico, em y≈0,4815, e é ela que passa por cima do 0,510 do mapa de hoje.
     */
    fora: {
      centro: { x: 0.49794, y: 0.15367 },
      raioX: 0.48126,
      raioY: 0.45067,
      deAngulo: 47.09,
      ateAngulo: 133.21,
      deX: 0.16771,
      ateX: 0.82708,
      erroMedioEmPixels: 0.46,
      erroPiorEmPixels: 3.12,
      pontos: 1218,
    },
    /*
     * Linha dos NÚMEROS do PEQUENO — meio da faixa, 1166 colunas.
     * Elipse: médio 0,42 px, pior 1,32 px. Círculo recusado: médio 0,73 px, pior 3,35 px.
     * Ápice = 0,64986. Em x=0,25208 (centro do "5") dá y=0,58917 e o algarismo tem centro
     * em y=0,58796 — 1,3 px. No "7", 3,2 px.
     */
    numeros: {
      centro: { x: 0.49854, y: 0.16237 },
      raioX: 0.51004,
      raioY: 0.48749,
      deAngulo: 50.0,
      ateAngulo: 130.41,
      deX: 0.16771,
      ateX: 0.82708,
      erroMedioEmPixels: 0.42,
      erroPiorEmPixels: 1.32,
      pontos: 1166,
    },
    /*
     * Arco de DENTRO do PEQUENO. De bico a bico (x=226 a x=1683), 1352 colunas, zero
     * descartadas pelo bico, interrupção real de 49 colunas (x 928..976) sob o disco.
     * Elipse: médio 0,55 px, pior 2,12 px.
     * Círculo recusado: R=1718,0 px, médio 1,49 px, pior 7,68 px.
     * Ápice = 0,69520 — é o traço em que a ficha do centro assenta hoje.
     */
    dentro: {
      centro: { x: 0.49911, y: 0.25128 },
      raioX: 0.50111,
      raioY: 0.44392,
      deAngulo: 41.11,
      ateAngulo: 139.56,
      deX: 0.11771,
      ateX: 0.87656,
      erroMedioEmPixels: 0.55,
      erroPiorEmPixels: 2.12,
      pontos: 1352,
    },
  },
} satisfies Record<string, Record<'fora' | 'numeros' | 'dentro', ArcoMedido>>;

/**
 * OS DOIS DISCOS DA LINHA — onde a ficha da aposta na LINHA vai, de verdade.
 *
 * Cada um é uma componente conexa ISOLADA da máscara de dourado (o arco de dentro é
 * interrompido onde o disco passa, então o disco sai sozinho): 1.021 pixels no GRANDE e
 * 1.131 no PEQUENO. O ajuste é sobre TODOS esses pixels, não sobre a caixa que os
 * envolve.
 *
 * SÃO ELIPSES, e por larga margem — o mesmo achatamento de perspectiva da mesa. No
 * GRANDE o ajuste circular erra 4,46 px em média e 8,79 px no pior ponto; a elipse erra
 * 0,92 px e 2,27 px. No PEQUENO: círculo 4,20 / 8,71 px, elipse 0,97 / 2,35 px.
 *
 * Em pixel o disco do GRANDE tem 51,7 x 38,0 de semieixo (103 x 76 de diâmetro) e o do
 * PEQUENO 53,3 x 40,4 (107 x 81). Isto é o TAMANHO REAL da casa da linha impressa —
 * compare com a caixa que o mapa usa hoje, 0,120 x 0,125 da arte (230 x 135 px): 2,2×
 * mais larga e 1,8× mais alta que o desenho, e é por isso que ela invade o arco.
 *
 * O ângulo vai de −180 a 180 porque é a volta inteira, não um trecho.
 */
export const CIRCULOS_DA_LINHA = {
  grande: {
    centro: { x: 0.49685, y: 0.46967 },
    raioX: 0.02692,
    raioY: 0.03517,
    deAngulo: -180,
    ateAngulo: 180,
    deX: 0.46927,
    ateX: 0.52448,
    erroMedioEmPixels: 0.92,
    erroPiorEmPixels: 2.27,
    pontos: 1021,
  },
  pequeno: {
    centro: { x: 0.49625, y: 0.66989 },
    raioX: 0.02777,
    raioY: 0.03745,
    deAngulo: -180,
    ateAngulo: 180,
    deX: 0.46771,
    ateX: 0.525,
    erroMedioEmPixels: 0.97,
    erroPiorEmPixels: 2.35,
    pontos: 1131,
  },
} satisfies Record<string, ArcoMedido>;

/**
 * AS PONTAS (bicos) de cada casa — o pixel dourado mais à esquerda e mais à direita de
 * cada faixa, com o y médio da coluna em que ele está.
 *
 * É aqui que a casa REALMENTE termina, e é mais longe do que o arco de fora sugere: o
 * GRANDE começa em x=0,2255 mas o arco de fora só aparece em x=0,2802. Quem desenhar a
 * área de toque pelo arco de fora perde 0,055 da largura em cada ponta — 105 px por lado
 * na arte de 1920, que é onde a ficha de quem senta na quina da mesa iria.
 *
 * O EIXO DA MESA NÃO É x=0,5. As pontas do GRANDE (433 e 1481 px) têm meio em 957 px e
 * as do PEQUENO (226 e 1683) em 954,5; os seis ajustes de arco dão `centro.x` entre
 * 0,49794 e 0,49911 (956,0 a 958,3 px). Ou seja, o eixo da foto está uns 3 px à esquerda
 * do meio da imagem — 0,0016 da largura. É pouco, mas é sistemático, e quem espelhar
 * alguma coisa em 0,5 vai ficar 3 px torto.
 */
export const PONTAS_DAS_CASAS = {
  grande: {
    esquerda: { x: 0.22552, y: 0.38009 },
    direita: { x: 0.77135, y: 0.38102 },
  },
  pequeno: {
    esquerda: { x: 0.11771, y: 0.53935 },
    direita: { x: 0.87656, y: 0.54306 },
  },
} satisfies Record<string, Record<'esquerda' | 'direita', PontoMedido>>;

/**
 * A PLAQUETA DOS ASES — a caixa "3 / ASES" no alto à esquerda.
 *
 * Ela NÃO é um retângulo alinhado aos eixos: é um quadrilátero em perspectiva, inclinado
 * pra esquerda conforme desce. A borda de cima vai de x=0,1823 a x=0,2526 e a de baixo de
 * x=0,1698 a x=0,2443 — a aresta esquerda escorrega 0,0125 e a direita 0,0083. Por causa
 * disso, a caixa envolvente (x 0,1698..0,2531, y 0,2444..0,3278) sobra 24 px de feltro no
 * canto superior esquerdo e 17 px no inferior direito.
 *
 * OS CANTOS SÃO CHANFRADOS na arte (a moldura tem o canto cortado, dá pra ver ampliando).
 * O ponto devolvido aqui é o extremo da diagonal — na prática, o MEIO do chanfro, que é
 * o melhor representante de um canto que não existe como ponto. O chanfro tem ~10 px, e
 * é essa a incerteza de cada canto.
 *
 * Medido na componente conexa da moldura: 1.068 pixels dourados.
 */
export const PLAQUETA_DOS_ASES = {
  superiorEsquerdo: { x: 0.18229, y: 0.24815 },
  superiorDireito: { x: 0.2526, y: 0.24907 },
  inferiorDireito: { x: 0.24427, y: 0.32037 },
  inferiorEsquerdo: { x: 0.16979, y: 0.3213 },
  /** A caixa envolvente da moldura, pra quem só precisa de um retângulo. */
  caixa: { esquerda: 0.16979, topo: 0.24444, direita: 0.25312, base: 0.32778 },
} satisfies {
  superiorEsquerdo: PontoMedido;
  superiorDireito: PontoMedido;
  inferiorDireito: PontoMedido;
  inferiorEsquerdo: PontoMedido;
  caixa: CaixaMedida;
};

/**
 * OS LETREIROS — onde cada palavra e cada algarismo estão impressos.
 *
 * Cada caixa é a envolvente das componentes douradas com pelo menos 150 pixels dentro de
 * uma janela generosa (a janela é conferida: se a caixa encostasse na borda dela, a
 * medição para com erro em vez de devolver um número cortado).
 *
 * PRA QUE SERVE: é o que NÃO pode ser coberto por ficha. A palavra GRANDE ocupa
 * y 0,3380..0,3602 no meio da casa, e é exatamente ali que uma pilha centrada no
 * retângulo do mapa de hoje cairia.
 *
 * O detalhe que muda o desenho: 15 e 6 estão LEVANTADOS em relação a 14/16 e 5/7,
 * porque no centro o disco da linha ocupa o meio da faixa. Compare os topos: 14, 15 e 16
 * começam todos em y=0,3898, mas 15 acaba em 0,4167 enquanto 14 e 16 descem até 0,4241 e
 * 0,4259 — os das pontas são MAIORES na tela porque estão mais perto de quem olha, e
 * estão girados pra acompanhar a tangente do arco (o "1" do 14 está 9 px acima do "4";
 * no 16 é o contrário, espelhado).
 */
export const LETREIROS = {
  /** A palavra GRANDE. Seis componentes de 253 a 384 px, x 836..1080, y 365..389. */
  grande: { esquerda: 0.43542, topo: 0.33796, direita: 0.5625, base: 0.36019 },
  /** A palavra PEQUENO. Sete componentes, x 811..1095, y 580..615 (o Q desce). */
  pequeno: { esquerda: 0.4224, topo: 0.53704, direita: 0.57031, base: 0.56944 },
  numeros: {
    /** "14": '1' em x 564..595 y 421..449 e '4' em x 589..625 y 430..458 (girado). */
    n14: { esquerda: 0.29375, topo: 0.38981, direita: 0.32552, base: 0.42407 },
    /** "15": x 928..979, y 421..450. Sentado no arco de fora, que ele interrompe. */
    n15: { esquerda: 0.48333, topo: 0.38981, direita: 0.5099, base: 0.41667 },
    /** "16": x 1283..1343, y 421..460. Espelho do 14. */
    n16: { esquerda: 0.66823, topo: 0.38981, direita: 0.69948, base: 0.42593 },
    /** "5": x 462..506, y 618..652. */
    n5: { esquerda: 0.24063, topo: 0.57222, direita: 0.26354, base: 0.6037 },
    /** "6": x 936..968, y 632..665. Levantado, como o 15. */
    n6: { esquerda: 0.4875, topo: 0.58519, direita: 0.50417, base: 0.61574 },
    /** "7": x 1386..1416, y 623..660. */
    n7: { esquerda: 0.72188, topo: 0.57685, direita: 0.7375, base: 0.61111 },
  },
  /*
   * O BRASÃO CI no pé do pano. Ele é dourado APAGADO: o traço tem cor média (71,62,37)
   * contra um feltro de (8,22,11) ao lado. Com a máscara principal (r > 85) ele se
   * despedaça em seis cacos de 10 a 57 px e a caixa sai errada (x 930..979, y 800..863 —
   * só a coroa e dois pedaços de louro). Então usa filtro próprio,
   * `(r > 45) && (r - b > 15) && (g > 27)`, e aí a caixa é estável: de corte 45 a 65 ela
   * não se mexe um pixel (x 892..1014, y 796..908); em 40 só a base desce 1 px.
   * A borda dourada da mesa passa logo abaixo, em y≈948, e fica de fora da janela.
   */
  brasao: { esquerda: 0.46458, topo: 0.73704, direita: 0.52812, base: 0.84074 },
} satisfies {
  grande: CaixaMedida;
  pequeno: CaixaMedida;
  numeros: Record<string, CaixaMedida>;
  brasao: CaixaMedida;
};

/**
 * A TIGELA DE COURO, remedida — e ela NÃO bate com `TIGELA_DA_BANCA` do mapa.
 *
 * `moldura` é a caixa da MAIOR figura dourada da mesa (87.405 pixels, a bandeja inteira:
 * aro de latão mais o couro, que também é quente e claro). `couro` é a caixa da mancha
 * clara e pouco saturada de dentro, isolada por `(r > 130) && (r - b < 85) && (g > 105)`
 * — o latão é mais alaranjado que o couro, e é isso que separa os dois. `retangulo` é o
 * MAIOR RETÂNGULO QUE CABE INTEIRO dentro do couro (algoritmo do maior retângulo em
 * matriz binária), que é a resposta certa pra "onde o dado pode parar sem encostar na
 * moldura", já que a bandeja é um oval e a caixa envolvente dele inclui os quatro cantos
 * que são de latão.
 *
 * COMPARANDO COM O MAPA DE HOJE:
 *
 *   TIGELA_DA_BANCA.fora   0,3245 / 0,1630 / 0,6630 / 0,2722
 *   moldura medida         0,3167 / 0,1213 / 0,6828 / 0,2732
 *                          −0,008   −0,042   +0,020   +0,001
 *
 *   TIGELA_DA_BANCA.chao   0,3550 / 0,1850 / 0,6350 / 0,2620
 *   couro medido           0,3359 / 0,1639 / 0,6625 / 0,2556
 *   maior retângulo        0,3750 / 0,1722 / 0,6203 / 0,2546
 *
 * O `fora` do mapa erra 0,042 no topo e 0,020 na direita — a bandeja sobe mais e vai
 * mais pra direita do que ele diz. O `chao` está dentro do couro nas laterais e no topo
 * (é conservador, e tudo bem), mas a BASE dele, 0,2620, passa 0,0064 do fim do couro
 * (0,2556): a faixa de baixo do `chao` já está em cima do aro de latão da frente. Nada
 * disso quebra o jogo hoje — o dado assenta no meio —, mas está anotado porque é
 * medida, e porque quem for mexer no tamanho do dado vai usar esses números.
 *
 * ESTE ARQUIVO NÃO ALTERA `TIGELA_DA_BANCA`. A correção é decisão de quem integra.
 */
export const TIGELA_MEDIDA = {
  /** A bandeja inteira, aro de latão incluído. */
  moldura: { esquerda: 0.31667, topo: 0.1213, direita: 0.68281, base: 0.27315 },
  /** A caixa envolvente do couro claro. */
  couro: { esquerda: 0.33594, topo: 0.16389, direita: 0.6625, base: 0.25556 },
  /** O maior retângulo que cabe inteiro no couro — onde o dado para sem encostar. */
  retangulo: { esquerda: 0.375, topo: 0.17222, direita: 0.62031, base: 0.25463 },
} satisfies Record<string, CaixaMedida>;

/**
 * O y de um arco num x dado, no ramo de BAIXO da elipse (que é o traço desenhado).
 *
 * Fora do trecho medido devolve a ponta mais próxima, em vez de `NaN`: uma ficha
 * arrastada pra fora da casa tem que parar na borda, não sumir.
 */
export function alturaDoArco(arco: ArcoMedido, x: number): number {
  const dentro = Math.min(Math.max(x, arco.deX), arco.ateX);
  const u = Math.min(Math.max((dentro - arco.centro.x) / arco.raioX, -1), 1);
  return arco.centro.y + arco.raioY * Math.sqrt(1 - u * u);
}

/** Um ponto do arco pelo ângulo do parâmetro, em graus. Ver `ArcoMedido`. */
export function pontoDoArco(arco: ArcoMedido, grausT: number): PontoMedido {
  const t = (grausT * Math.PI) / 180;
  return {
    x: arco.centro.x + arco.raioX * Math.cos(t),
    y: arco.centro.y + arco.raioY * Math.sin(t),
  };
}
