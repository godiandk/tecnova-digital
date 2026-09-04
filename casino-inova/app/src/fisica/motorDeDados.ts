/**
 * Física dos dados: queda, quique, atrito, colisão entre eles e giro que decai.
 *
 * POR QUE FÍSICA DE VERDADE, E NÃO UMA IMAGEM GIRANDO. A animação antiga fazia o dado
 * descer em linha reta trocando de figura depressa — "borrão que vira número". Lida uma
 * vez, passa; lida vinte vezes seguidas, é sempre igual, e sempre igual é o oposto de um
 * dado. Um dado de verdade nunca cai duas vezes do mesmo jeito: ele bate na parede da
 * tigela, esbarra no outro dado, roda de lado, perde força e para. É isso que faz olhar
 * o dado ter graça, e é isso que está aqui.
 *
 * O QUE É SIMULADO. Cada dado é um corpo com posição no plano do tampo (x, y), ALTURA
 * (z, que é o que dá o quique), velocidade nos três eixos e giro nos três eixos. A cada
 * passo: a gravidade puxa, o chão devolve parte da energia, o atrito come a velocidade
 * enquanto o dado desliza, e a batida do chão converte deslizamento em giro — que é por
 * que um dado jogado com força continua rodando depois de encostar. Dado contra dado é
 * colisão elástica de massas iguais, com o empurrão trocando de direção e sobrando um
 * tranco no giro dos dois.
 *
 * E A PARTE QUE NÃO PODE SER FÍSICA. O resultado NÃO sai daqui. O servidor sorteou a
 * face antes de qualquer pixel se mexer, e o que este motor faz é levar o dado até ela:
 * o caminho é calculado de verdade — a batida aconteceu, o giro aconteceu — e a
 * orientação final é ajustada nos últimos quadros pra a face que o servidor já tinha
 * dito ficar pra cima.
 *
 * Isso não é um truque escondido: é como funciona qualquer cassino ao vivo, onde a
 * transmissão mostra o que a mesa já decidiu. O contrário — deixar a física decidir —
 * seria um dado cujo resultado depende da velocidade do celular de quem joga, e aí sim
 * ninguém poderia conferir nada.
 *
 * A SIMULAÇÃO É FEITA INTEIRA ANTES DE COMEÇAR A MOSTRAR, e vira uma lista de quadros.
 * Duas razões: o desenho passa a ser só interpolação (roda no processador de animação do
 * aparelho, a 60 quadros, sem depender do JavaScript acompanhar), e o mesmo lançamento
 * fica igual em qualquer celular, do mais rápido ao mais lento.
 */

/** Um dado, enquanto a conta acontece. Distâncias em unidades de "meio dado". */
interface Corpo {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Giro acumulado, em graus. É o que vai pra tela. */
  rx: number;
  ry: number;
  rz: number;
  /** Velocidade de giro, em graus por segundo. */
  wx: number;
  wy: number;
  wz: number;
  parado: boolean;
}

/** Onde os dados podem andar. */
export interface Arena {
  /** 'elipse' é a tigela de couro da banca francesa; 'caixa' é o agitador do Bac Bo. */
  formato: 'elipse' | 'caixa';
  /**
   * A arena está EM PÉ na tela — um tubo visto de lado, e não uma tigela vista de cima.
   *
   * Muda pra onde a gravidade puxa, e isso não é detalhe. Na tigela, olhada de cima, o
   * que sobe e desce é a ALTURA acima do feltro (o eixo z), e o dado pousa em qualquer
   * ponto do couro. No tubo do Bac Bo, olhado de frente, quem sobe e desce é o próprio
   * eixo Y DA TELA: o dado tem que terminar NO FUNDO do vidro, sempre, como qualquer
   * coisa dentro de um pote.
   *
   * Sem isto os quatro dados paravam boiando no meio do tubo, cada um numa altura
   * diferente, porque nada os puxava pra baixo dentro do plano.
   */
  emPe?: boolean;
  /** Meia largura útil, em unidades de meio dado (o dado tem raio 1). */
  raioX: number;
  /** Meia altura útil, em unidades de meio dado. */
  raioY: number;
}

/** Um instante de um dado, pronto pra virar transformação na tela. */
export interface Quadro {
  /** Posição no plano, em unidades de meio dado, com (0,0) no centro da arena. */
  x: number;
  y: number;
  /** Altura acima do tampo. Vira sombra menor e dado maior. */
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface Lancamento {
  /** Um caminho por dado, cada um com a mesma quantidade de quadros. */
  caminhos: Quadro[][];
  /** Quantos quadros durou. */
  quadros: number;
  /** Quantas vezes um dado bateu no outro. Só pra conferir que a colisão existe. */
  colisoes: number;
  /** Em que quadro cada dado parou de andar. Serve pro Bac Bo revelar em ordem. */
  paradaDe: number[];
}

export const QUADROS_POR_SEGUNDO = 60;
const PASSO = 1 / QUADROS_POR_SEGUNDO;

/** Gravidade, em meios-dados por segundo ao quadrado. Escolhida pelo que PARECE certo. */
const GRAVIDADE = 46;
/** Quanto da velocidade vertical volta a cada quique. Dado de acrílico devolve pouco. */
const DEVOLUCAO_DO_CHAO = 0.42;
/** Quanto da velocidade volta ao bater na parede da tigela. */
const DEVOLUCAO_DA_PAREDE = 0.55;
/** Atrito enquanto desliza no feltro, por segundo. */
const ATRITO_DO_CHAO = 7.5;
/** O giro morre junto com o movimento, mas mais devagar — por isso um dado gira parado. */
const FREIO_DO_GIRO = 3.8;
/** Abaixo disto o dado é considerado parado e começa a se assentar na face certa. */
const QUASE_PARADO = 1.4;
/** Quantos quadros o assentamento leva: o dado "cai" na face final. */
const QUADROS_DE_ASSENTAR = 14;
/** Teto de duração, pra um lançamento nunca prender a tela. */
const QUADROS_MAXIMOS = 210; // 3,5 segundos

/**
 * Sorteio repetível.
 *
 * A física precisa de números ao acaso (a força do arremesso, o ângulo), mas o mesmo
 * lançamento tem que sair igual toda vez que for recalculado — senão remontar a tela no
 * meio da animação faria o dado saltar pra outro lugar. Semente entra, sequência sai.
 */
function sorteioComSemente(semente: number): () => number {
  let estado = (semente || 1) >>> 0;
  return () => {
    // xorshift32: barato, sem dependência, e bom o bastante pra sacudir um dado.
    estado ^= estado << 13;
    estado >>>= 0;
    estado ^= estado >> 17;
    estado ^= estado << 5;
    estado >>>= 0;
    return estado / 4294967296;
  };
}

/**
 * Que giro deixa cada face virada pra quem olha.
 *
 * O cubo é montado no jeito do CSS: a face 1 é a da frente, a 6 é a de trás, 2 e 5 são
 * os lados, 3 e 6... — e como num dado de verdade, os opostos somam 7. Pra trazer a face
 * N pra frente, aplica-se ao cubo inteiro o giro contrário ao que colocou aquela face no
 * lugar dela.
 */
export const GIRO_DA_FACE: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: 0, ry: -90 },
  3: { rx: -90, ry: 0 },
  4: { rx: 90, ry: 0 },
  5: { rx: 0, ry: 90 },
  6: { rx: 0, ry: 180 },
};

/** O múltiplo de 360 mais perto, pra o dado assentar sem desandar meia volta pra trás. */
function alvoMaisPerto(atual: number, desejado: number): number {
  return desejado + Math.round((atual - desejado) / 360) * 360;
}

export interface OpcoesDoLancamento {
  /** As faces que o SERVIDOR sorteou. Uma por dado. O motor leva os dados até elas. */
  faces: number[];
  arena: Arena;
  /** Mesma semente, mesmo lançamento. Use algo derivado da rodada. */
  semente: number;
  /**
   * De onde os dados entram, em unidades de meio dado, relativo ao centro da arena.
   * O padrão joga de cima e de fora, como quem despeja o copo.
   */
  entrada?: { x: number; y: number; z: number };
  /**
   * Quantos quadros o lançamento tem que ter, exatamente.
   *
   * SEM ISTO A TELA E A FÍSICA DESCASAM. A simulação acaba quando os dados param, e isso
   * varia de 1,2 a 3,5 segundos conforme como caíram; a tela, porém, precisa saber de
   * antemão quanto tempo esperar antes de liberar a mesa. Com duração variável, ou a
   * rodada seguiria com os dados ainda rolando, ou ficaria parada olhando dados já
   * assentados.
   *
   * Fixando o número de quadros: quem para antes fica parado até o fim — que é o que
   * acontece na mesa de verdade, onde os dados param e todo mundo olha o resultado por
   * um instante antes de a rodada seguir.
   */
  quadrosFixos?: number;
  /**
   * Até que quadro cada dado CONTINUA SENDO SACUDIDO. Um número por dado.
   *
   * É o agitador do Bac Bo: uma cápsula de vidro estreita com ar soprando embaixo, como
   * a máquina de bingo. O dado não cai e assenta — ele fica batendo no vidro até o
   * operador desligar aquele agitador.
   *
   * Sem isto o dado assentaria em meio segundo (a cápsula é pequena, o atrito come a
   * energia depressa) e os quatro parariam quase juntos. O suspense do Bac Bo é
   * exatamente o contrário: os agitadores desligam UM DE CADA VEZ, e enquanto o seu não
   * desligou o dado continua se mexendo, ilegível.
   *
   * Depois do quadro indicado, ninguém sopra mais: o atrito e a gravidade fazem o
   * resto, e o dado assenta na face que o servidor mandou.
   */
  agitarAte?: number[];
}

/**
 * Calcula o lançamento inteiro e devolve os quadros.
 *
 * Chamado UMA VEZ por lançamento, fora do desenho. 210 quadros de 3 corpos é conta de
 * milésimo de segundo — barato o bastante pra rodar no meio de um toque sem travar nada.
 */
export function lancarDados(opcoes: OpcoesDoLancamento): Lancamento {
  const { faces, arena, semente } = opcoes;
  const sortear = sorteioComSemente(semente);
  const entrada = opcoes.entrada ?? { x: -arena.raioX * 0.55, y: -arena.raioY * 0.7, z: 7 };

  const corpos: Corpo[] = faces.map((_, indice) => ({
    // Entram espaçados, senão nascem um dentro do outro e a primeira colisão é falsa.
    x: entrada.x + indice * 1.4 + (sortear() - 0.5) * 0.5,
    y: entrada.y + (sortear() - 0.5) * 0.8,
    z: entrada.z + sortear() * 1.5,
    vx: 9 + sortear() * 7,
    vy: 5 + sortear() * 6,
    vz: 1.5 + sortear() * 2,
    rx: sortear() * 360,
    ry: sortear() * 360,
    rz: sortear() * 360,
    // Giro forte no começo: é o que faz o dado ser ilegível enquanto voa.
    wx: (sortear() - 0.5) * 1500,
    wy: (sortear() - 0.5) * 1500,
    wz: (sortear() - 0.5) * 900,
    parado: false,
  }));

  const caminhos: Quadro[][] = corpos.map(() => []);
  const paradaDe: number[] = corpos.map(() => -1);
  let colisoes = 0;
  let quadro = 0;

  while (quadro < QUADROS_MAXIMOS) {
    for (let i = 0; i < corpos.length; i += 1) {
      const c = corpos[i];
      if (c.parado) continue;

      /*
       * O SOPRO DO AGITADOR. Enquanto este dado está sendo sacudido, ele ganha energia
       * de volta a cada quadro, em direção sorteada — é o ar da máquina de bingo
       * empurrando a bola. O resultado é um dado que não consegue assentar: bate no
       * vidro, sobe, gira, bate de novo.
       */
      const sacudindo = opcoes.agitarAte ? quadro < (opcoes.agitarAte[i] ?? 0) : false;
      if (sacudindo) {
        c.vx += (sortear() - 0.5) * 34;
        c.vy += (sortear() - 0.5) * 34;
        /*
         * O EMPURRÃO PRA CIMA ACONTECE NO FUNDO DO TUBO, UMA VEZ POR TOQUE.
         *
         * Escrito como `if (c.z < 0.35) c.vz += ...` ele se SOMAVA: o dado sobe 0,22 por
         * quadro, continuava abaixo de 0,35 no quadro seguinte, e levava outro empurrão,
         * e outro. Três quadros bastavam pra a velocidade triplicar, e a verificação
         * mediu o resultado: o último dado chegava a subir NOVE alturas de dado e ainda
         * estava no ar quando a animação acabava — congelado flutuando acima do pote.
         *
         * Agora é `=` e não `+=`, e só quando o dado está encostado E não está subindo.
         * É o que o jato de ar faz numa máquina de bingo: chuta a bola quando ela cai no
         * fundo, não empurra ela a viagem inteira. Sobe pouco mais de um dado e cai em
         * pouco mais de um quarto de segundo.
         */
        if (arena.emPe) {
          // No tubo em pé, o jato chuta o dado PRA CIMA DA TELA quando ele está no fundo.
          const fundo = Math.max(0.05, arena.raioY - 1);
          if (c.y >= fundo - 0.02 && c.vy >= 0) c.vy = -(6 + sortear() * 7);
        } else if (c.z <= 0.02 && c.vz <= 0) {
          c.vz = 6 + sortear() * 7;
        }
        c.wx += (sortear() - 0.5) * 260;
        c.wy += (sortear() - 0.5) * 260;
        c.wz += (sortear() - 0.5) * 160;
      }

      // --- gravidade e voo ---
      /*
       * Em pé, a gravidade puxa pra baixo NA TELA (+y); deitada, puxa pra fora dela (-z).
       *
       * E EM PÉ O EIXO Z NÃO EXISTE. Num tubo visto de frente, "altura acima do tampo"
       * não quer dizer nada — o que sobe e desce já é o y da tela. Zerar não é atalho: é
       * dizer que aquele eixo não é usado nesta arena.
       *
       * Sem zerar, o z herdava a velocidade inicial de arremesso e subia pra sempre, sem
       * nada puxando de volta. Chegava a 11,7 no fim, e como a tela levanta o dado
       * conforme o z, os quatro apareciam flutuando 124 pixels ACIMA dos potes, pousados
       * em cima das tampas de latão.
       */
      if (arena.emPe) {
        c.vy += GRAVIDADE * PASSO;
        c.z = 0;
        c.vz = 0;
      } else {
        c.vz -= GRAVIDADE * PASSO;
      }
      c.x += c.vx * PASSO;
      c.y += c.vy * PASSO;
      c.z += c.vz * PASSO;

      // --- o fundo do tubo, quando ele está em pé ---
      if (arena.emPe) {
        const fundo = Math.max(0.05, arena.raioY - 1);
        if (c.y >= fundo) {
          c.y = fundo;
          if (c.vy > 0) {
            /*
             * COM O AGITADOR DESLIGADO O DADO QUICA MENOS. Não é atalho: enquanto o ar
             * sopra, o dado é mantido no alto e volta com força; desligado, ele só cai
             * dentro de um tubo de vidro, e vidro devolve pouco. Sem esta diferença, uma
             * parte dos lançamentos terminava com o dado ainda no meio do tubo, boiando
             * em vez de assentado no fundo — medido em verifica-agitador.ts.
             */
            c.vy = -c.vy * (sacudindo ? DEVOLUCAO_DO_CHAO : DEVOLUCAO_DO_CHAO * 0.45);
            // A batida no fundo vira giro, como vira em qualquer coisa que cai de lado.
            c.wz += c.vx * 26;
            c.wx += c.vx * 14;
            if (Math.abs(c.vy) < 1.2) c.vy = 0;
          }
          const freioNoFundo = Math.max(0, 1 - ATRITO_DO_CHAO * PASSO);
          c.vx *= freioNoFundo;
        }
      }

      // --- o chão ---
      if (!arena.emPe && c.z <= 0) {
        c.z = 0;
        if (c.vz < 0) {
          c.vz = -c.vz * DEVOLUCAO_DO_CHAO;
          /*
           * A batida converte deslizamento em giro. É o que faz um dado jogado com
           * força continuar rodando depois de encostar, em vez de parar de rodar no
           * instante em que toca o feltro.
           */
          c.wx += c.vy * 22;
          c.wy -= c.vx * 22;
          if (c.vz < 1.2) c.vz = 0;
        }
        // Atrito só existe encostado.
        const freio = Math.max(0, 1 - ATRITO_DO_CHAO * PASSO);
        c.vx *= freio;
        c.vy *= freio;
      }

      // --- as paredes ---
      bater(c, arena);

      /*
       * Sem ar, o dado também perde velocidade no plano. É o que faz ele parar de correr
       * de um lado pro outro do tubo depois que o agitador desliga.
       */
      if (arena.emPe && !sacudindo) {
        const arrasto = Math.max(0, 1 - 2.4 * PASSO);
        c.vx *= arrasto;
        c.vy *= arrasto;
      }

      // --- o giro morre devagar ---
      const freioDoGiro = Math.max(0, 1 - FREIO_DO_GIRO * PASSO);
      c.wx *= freioDoGiro;
      c.wy *= freioDoGiro;
      c.wz *= freioDoGiro;
      c.rx += c.wx * PASSO;
      c.ry += c.wy * PASSO;
      c.rz += c.wz * PASSO;
    }

    // --- dado contra dado ---
    for (let i = 0; i < corpos.length; i += 1) {
      for (let j = i + 1; j < corpos.length; j += 1) {
        if (colidir(corpos[i], corpos[j])) colisoes += 1;
      }
    }

    /*
     * A parede DE NOVO, depois das colisões.
     *
     * Separar dois dados encavalados os empurra pra lados opostos, e um deles pode ser
     * empurrado pra fora da tigela — a parede já tinha sido conferida antes. A
     * verificação pegou isso: 3.240 quadros com dado do lado de fora, todos logo depois
     * de um esbarrão perto da borda. Conferir nos dois momentos fecha a saída.
     */
    for (const c of corpos) if (!c.parado) bater(c, arena);

    // --- quem já pode parar ---
    for (let i = 0; i < corpos.length; i += 1) {
      const c = corpos[i];
      if (c.parado) continue;
      const anda = Math.hypot(c.vx, c.vy) + Math.abs(c.vz);
      const roda = (Math.abs(c.wx) + Math.abs(c.wy) + Math.abs(c.wz)) / 360;
      // Em pé, "no chão" é estar no fundo do tubo; deitada, é estar no feltro.
      const encostado = arena.emPe ? c.y >= Math.max(0.05, arena.raioY - 1) - 0.02 : c.z === 0;
      // Quem ainda está sendo sacudido não para, nem que a conta diga que parou.
      const aindaSacudindo = opcoes.agitarAte ? quadro < (opcoes.agitarAte[i] ?? 0) : false;
      if (!aindaSacudindo && encostado && anda < QUASE_PARADO && roda < QUASE_PARADO) {
        c.parado = true;
        paradaDe[i] = quadro;
      }
    }

    for (let i = 0; i < corpos.length; i += 1) {
      const c = corpos[i];
      caminhos[i].push({ x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, rz: c.rz });
    }

    quadro += 1;
    if (corpos.every((c) => c.parado)) break;
    // Com agitador, a conta vai pelo menos até o último desligar.
    if (opcoes.agitarAte && quadro <= Math.max(...opcoes.agitarAte)) continue;
  }

  // Quem não parou sozinho (bateu o teto) é dado como parado agora.
  for (let i = 0; i < corpos.length; i += 1) if (paradaDe[i] < 0) paradaDe[i] = quadro - 1;

  if (opcoes.quadrosFixos && opcoes.quadrosFixos > 0) {
    ajustarDuracao(caminhos, opcoes.quadrosFixos);
    for (let i = 0; i < paradaDe.length; i += 1) {
      paradaDe[i] = Math.min(paradaDe[i], opcoes.quadrosFixos - 1);
    }
  }

  /*
   * O assentamento na face certa é a ÚLTIMA coisa, depois de a duração já estar
   * definida. Ao contrário, cortar o fim do caminho cortaria justamente os quadros em
   * que o dado se ajeita na face — e o dado pararia numa face qualquer.
   */
  assentarNasFaces(caminhos, faces, opcoes.agitarAte);

  return { caminhos, quadros: caminhos[0]?.length ?? 0, colisoes, paradaDe };
}

/**
 * Deixa todos os caminhos com exatamente `alvo` quadros.
 *
 * Curto demais: repete o último quadro, e o dado fica parado esperando — igual à mesa de
 * verdade, onde os dados param e as pessoas olham antes de a rodada seguir.
 *
 * Longo demais: corta. Acontece no lançamento raro que demora demais a assentar, e o
 * corte é seguro porque o ajuste da face acontece DEPOIS deste corte.
 */
function ajustarDuracao(caminhos: Quadro[][], alvo: number) {
  for (const caminho of caminhos) {
    if (caminho.length === 0) continue;
    while (caminho.length > alvo) caminho.pop();
    const ultimo = caminho[caminho.length - 1];
    while (caminho.length < alvo) caminho.push({ ...ultimo });
  }
}

/** Quica na parede da arena e devolve parte da velocidade, com um tranco no giro. */
function bater(c: Corpo, arena: Arena) {
  if (arena.formato === 'caixa') {
    if (c.x < -arena.raioX + 1) { c.x = -arena.raioX + 1; c.vx = Math.abs(c.vx) * DEVOLUCAO_DA_PAREDE; c.wy += 260; }
    if (c.x > arena.raioX - 1) { c.x = arena.raioX - 1; c.vx = -Math.abs(c.vx) * DEVOLUCAO_DA_PAREDE; c.wy -= 260; }
    if (c.y < -arena.raioY + 1) { c.y = -arena.raioY + 1; c.vy = Math.abs(c.vy) * DEVOLUCAO_DA_PAREDE; c.wx -= 260; }
    if (c.y > arena.raioY - 1) { c.y = arena.raioY - 1; c.vy = -Math.abs(c.vy) * DEVOLUCAO_DA_PAREDE; c.wx += 260; }
    return;
  }

  /*
   * Elipse. A conta é feita num círculo: encolhe o espaço pelos raios, resolve como
   * círculo de raio 1, e devolve. Resolver elipse direto exigiria achar o ponto mais
   * próximo na curva, que é uma equação de quarto grau — desnecessária pra isto.
   */
  const raioUtilX = Math.max(0.2, arena.raioX - 1);
  const raioUtilY = Math.max(0.2, arena.raioY - 1);
  const ux = c.x / raioUtilX;
  const uy = c.y / raioUtilY;
  const distancia = Math.hypot(ux, uy);
  if (distancia <= 1) return;

  // A normal da parede, já de volta ao espaço real.
  const nx = ux / raioUtilX;
  const ny = uy / raioUtilY;
  const tamanho = Math.hypot(nx, ny) || 1;
  const normalX = nx / tamanho;
  const normalY = ny / tamanho;

  // Volta pra dentro da borda.
  c.x = (ux / distancia) * raioUtilX;
  c.y = (uy / distancia) * raioUtilY;

  const projecao = c.vx * normalX + c.vy * normalY;
  if (projecao > 0) {
    c.vx -= (1 + DEVOLUCAO_DA_PAREDE) * projecao * normalX;
    c.vy -= (1 + DEVOLUCAO_DA_PAREDE) * projecao * normalY;
    // Bater de raspão roda o dado; bater de frente, menos.
    c.wz += (c.vx * normalY - c.vy * normalX) * 14;
    c.wx += normalY * 200;
    c.wy -= normalX * 200;
  }
}

/**
 * Dois dados se esbarrando.
 *
 * Massas iguais e batida frontal: as componentes da velocidade ao longo da linha que
 * liga os centros simplesmente TROCAM de dono. É a conta certa pra bolas de bilhar de
 * mesmo peso, e um dado é perto o bastante disso pra ninguém notar a diferença.
 *
 * Cada esbarrão também joga giro nos dois — é o que o olho lê como "bateu no outro e
 * virou pro outro lado".
 */
function colidir(a: Corpo, b: Corpo): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distancia = Math.hypot(dx, dy);
  const encosto = 2; // dois raios
  if (distancia >= encosto || distancia === 0) return false;

  const nx = dx / distancia;
  const ny = dy / distancia;

  // Separa, pra não ficarem grudados trocando de velocidade toda hora.
  const sobra = (encosto - distancia) / 2;
  a.x -= nx * sobra; a.y -= ny * sobra;
  b.x += nx * sobra; b.y += ny * sobra;

  const va = a.vx * nx + a.vy * ny;
  const vb = b.vx * nx + b.vy * ny;
  if (va - vb <= 0) return false; // já estão se afastando

  const troca = va - vb;
  a.vx -= troca * nx; a.vy -= troca * ny;
  b.vx += troca * nx; b.vy += troca * ny;

  const tranco = Math.min(900, Math.abs(troca) * 90);
  a.wx += ny * tranco; a.wy -= nx * tranco; a.wz -= tranco * 0.4;
  b.wx -= ny * tranco; b.wy += nx * tranco; b.wz += tranco * 0.4;
  return true;
}

/**
 * Leva cada dado até a face que o servidor sorteou, nos últimos quadros.
 *
 * O ajuste é feito no FIM, quando o dado já quase parou, e escolhendo sempre a volta
 * mais curta — o dado assenta na face como um dado assenta, sem desandar meia volta pra
 * trás na frente de quem olha.
 */
function assentarNasFaces(caminhos: Quadro[][], faces: number[], assentarDe?: number[]) {
  for (let i = 0; i < caminhos.length; i += 1) {
    const caminho = caminhos[i];
    if (caminho.length === 0) continue;

    const alvo = GIRO_DA_FACE[faces[i]] ?? GIRO_DA_FACE[1];
    const ultimo = caminho[caminho.length - 1];
    const alvoRx = alvoMaisPerto(ultimo.rx, alvo.rx);
    const alvoRy = alvoMaisPerto(ultimo.ry, alvo.ry);
    // O rz é livre: qualquer volta inteira mostra a mesma face, e deixar o dado torto
    // no tampo é o que impede três dados parecerem alinhados por um esquadro.
    const alvoRz = Math.round(ultimo.rz / 90) * 90;

    /*
     * Onde o dado começa a se ajeitar na face. Normalmente é nos últimos quadros; com
     * agitador é logo depois de o sopro parar, pra o dado assentar NA HORA em que
     * aquele agitador desliga, e não todos juntos no fim.
     */
    const inicio = assentarDe
      ? Math.min(caminho.length - 2, Math.max(0, assentarDe[i] ?? 0))
      : Math.max(0, caminho.length - QUADROS_DE_ASSENTAR);
    const deRx = caminho[inicio].rx;
    const deRy = caminho[inicio].ry;
    const deRz = caminho[inicio].rz;

    for (let q = inicio; q < caminho.length; q += 1) {
      const t = (q - inicio) / Math.max(1, caminho.length - 1 - inicio);
      const suave = 1 - (1 - t) * (1 - t) * (1 - t); // desacelera no fim
      caminho[q].rx = deRx + (alvoRx - deRx) * suave;
      caminho[q].ry = deRy + (alvoRy - deRy) * suave;
      caminho[q].rz = deRz + (alvoRz - deRz) * suave;
    }
  }
}

/**
 * Que face está virada pra quem olha, dada uma orientação.
 *
 * Existe pra a verificação poder CONFERIR que o dado parou na face certa, em vez de eu
 * afirmar que para. Gira os seis vetores das faces e vê qual aponta mais pra frente.
 */
export function faceVirada(rx: number, ry: number): number {
  const grau = Math.PI / 180;
  const [sx, cx] = [Math.sin(rx * grau), Math.cos(rx * grau)];
  const [sy, cy] = [Math.sin(ry * grau), Math.cos(ry * grau)];

  // Normais das faces no cubo parado, na mesma convenção de GIRO_DA_FACE.
  const normais: Array<[number, [number, number, number]]> = [
    [1, [0, 0, 1]],
    [6, [0, 0, -1]],
    [2, [1, 0, 0]],
    [5, [-1, 0, 0]],
    [3, [0, -1, 0]],
    [4, [0, 1, 0]],
  ];

  let melhor = 1;
  let maiorZ = -Infinity;
  for (const [face, [x, y, z]] of normais) {
    // Aplica rotateX e depois rotateY, na mesma ordem em que a tela aplica.
    const y1 = y * cx - z * sx;
    const z1 = y * sx + z * cx;
    const x2 = x * cy + z1 * sy;
    const z2 = -x * sy + z1 * cy;
    void x2; void y1;
    if (z2 > maiorZ) { maiorZ = z2; melhor = face; }
  }
  return melhor;
}
