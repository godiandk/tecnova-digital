import { Application, Container, Sprite, Texture, BlurFilter, Assets } from 'pixi.js';

/**
 * O MOTOR DE ROLOS — o caça-níqueis desenhado como caça-níqueis.
 *
 * O QUE ELE VEIO SUBSTITUIR: uma tira de imagens deslizando com `translateY`. Funcionava,
 * e não era um rolo. Faltavam as três coisas que fazem um rolo parecer rolo:
 *
 *   1. **BORRÃO DE MOVIMENTO.** Um rolo a 30 símbolos por segundo não mostra símbolos —
 *      mostra um rastro vertical. Sem o borrão, o olho lê "imagens trocando rápido", que é
 *      a sensação de uma lista rolando, não de um tambor girando.
 *   2. **FITA CONTÍNUA.** O rolo é um anel fechado de símbolos que dá voltas. A tira antiga
 *      era ruído sorteado + resultado colado no fim: ela CORRIA UMA VEZ e parava. Um anel
 *      pode girar o tempo que for preciso e parar onde mandarem.
 *   3. **PESO.** Acelera, cruza, desacelera e assenta com um repique. Um rolo mecânico tem
 *      inércia; um `withTiming` de 620 ms tem uma curva.
 *
 * O QUE ELE NÃO FAZ, e isto é regra do projeto e não detalhe de implementação:
 *
 *   • **NÃO DECIDE NADA.** O resultado chega pronto do servidor antes de o rolo começar a
 *     desacelerar. O motor só escolhe ONDE a fita para pra mostrar o que já foi sorteado.
 *   • **NÃO EXISTE QUASE-PRÊMIO.** Nenhum rolo hesita de propósito, nenhum "anticipation"
 *     é encenado porque o próximo símbolo seria um prêmio. Isso é a coisa mais comum num
 *     slot comercial e é exatamente o que este projeto não faz: a animação conta o que
 *     aconteceu, e o que aconteceu foi sorteio de verdade com o RTP publicado.
 *
 * Roda no NAVEGADOR, que é o canal deste jogo. No aplicativo nativo vale a versão em
 * Reanimated (`components/Rolo.tsx`) — ver `PalcoDosRolos.tsx`.
 */

/** Quantos símbolos a fita de cada rolo tem. Mais que isso ninguém vê; menos, repete à vista. */
const SIMBOLOS_NA_FITA = 24;

/** Velocidade de cruzeiro, em símbolos por segundo. */
const VELOCIDADE = 34;

/** Quanto tempo o rolo leva pra chegar na velocidade de cruzeiro. */
const ACELERACAO_EM_MS = 260;

/** Cada rolo para este tanto depois do anterior — o "tec, tec, tec" da esquerda pra direita. */
const ATRASO_ENTRE_ROLOS_EM_MS = 220;

/** A desaceleração final, do cruzeiro até o símbolo alvo. */
const FREADA_EM_MS = 620;

/** O repique: quanto o rolo passa do alvo antes de voltar, em fração de célula. */
const REPIQUE = 0.22;

export interface AberturaDoMotor {
  /** O elemento onde o canvas é montado. */
  onde: HTMLElement;
  largura: number;
  altura: number;
  colunas: number;
  fileiras: number;
  /** id do símbolo → URL da imagem. */
  arte: Record<string, string>;
}

type Fase = 'parado' | 'acelerando' | 'cruzeiro' | 'freando';

interface Rolo {
  palco: Container;
  sprites: Sprite[];
  /** A fita deste rolo: os ids na ordem do anel. */
  fita: string[];
  /** Posição do anel, em símbolos. Fracionária: é ela que faz o desenho. */
  posicao: number;
  velocidade: number;
  fase: Fase;
  /** Quando esta fase começou, em ms do relógio do motor. */
  desde: number;
  /** Onde a fita tem que parar, em símbolos. Definido quando a freada começa. */
  alvo: number;
  /** De onde a freada partiu, pra interpolar. */
  partida: number;
  borrao: BlurFilter;
}

export class MotorDeRolos {
  private app: Application | null = null;
  private rolos: Rolo[] = [];
  private celula = 0;
  private fileiras = 3;
  private relogio = 0;
  private texturas: Record<string, Texture> = {};
  /** O resultado do servidor, esperando pra ser mostrado. Nulo = ainda girando à toa. */
  private resultado: string[][] | null = null;
  private aoParar: (() => void) | null = null;

  async abrir({ onde, largura, altura, colunas, fileiras, arte }: AberturaDoMotor): Promise<void> {
    this.fileiras = fileiras;
    this.celula = altura / fileiras;

    const app = new Application();
    await app.init({
      width: largura,
      height: altura,
      backgroundAlpha: 0,
      antialias: true,
      /*
       * `autoDensity` + `resolution` desenham na densidade real do aparelho. Sem isto o
       * símbolo fica borrado num celular de 3x — e borrado de resolução, não de movimento,
       * que é o borrão que a gente QUER.
       */
      autoDensity: true,
      resolution: Math.min(3, globalThis.devicePixelRatio || 1),
    });
    onde.appendChild(app.canvas as unknown as Node);
    this.app = app;

    const ids = Object.keys(arte);
    for (const id of ids) this.texturas[id] = await Assets.load(arte[id]);

    const larguraDoRolo = largura / colunas;
    for (let c = 0; c < colunas; c += 1) {
      const palco = new Container();
      palco.x = c * larguraDoRolo;
      /*
       * A JANELA RECORTA O ROLO. Sem a máscara, a fita inteira aparece e some a ilusão do
       * tambor — é o mesmo papel do `overflow: hidden` na versão em Reanimated.
       */
      const mascara = new Sprite(Texture.WHITE);
      mascara.width = larguraDoRolo;
      mascara.height = altura;
      palco.addChild(mascara);
      palco.mask = mascara;

      const fita = Array.from({ length: SIMBOLOS_NA_FITA }, () => ids[Math.floor(Math.random() * ids.length)]);
      const sprites: Sprite[] = [];
      /*
       * SÓ AS CÉLULAS DA JANELA + DUAS DE FOLGA existem como sprite, e elas são recicladas:
       * a de cima que sai volta por baixo com a textura do próximo símbolo do anel. Criar
       * 24 sprites por rolo e mover todos seria desenhar 120 imagens pra mostrar 15.
       */
      for (let i = 0; i < fileiras + 2; i += 1) {
        const s = new Sprite();
        s.anchor.set(0.5);
        s.x = larguraDoRolo / 2;
        s.width = larguraDoRolo * 0.82;
        s.height = this.celula * 0.82;
        palco.addChild(s);
        sprites.push(s);
      }

      const borrao = new BlurFilter({ strength: 0, quality: 2 });
      /* O borrão é só VERTICAL: um rolo não borra pros lados. */
      borrao.blendMode = 'normal';
      palco.filters = [borrao];

      app.stage.addChild(palco);
      this.rolos.push({
        palco, sprites, fita, posicao: 0, velocidade: 0,
        fase: 'parado', desde: 0, alvo: 0, partida: 0, borrao,
      });
    }

    this.desenhar();
    app.ticker.add((tick) => this.passo(tick.deltaMS));
  }

  /** Começa a girar. O resultado ainda não precisa existir — ele chega por `assentar`. */
  girar(): void {
    this.resultado = null;
    this.relogio = 0;
    this.rolos.forEach((rolo, i) => {
      rolo.fase = 'acelerando';
      rolo.desde = -i * 40;
      rolo.velocidade = 0;
    });
  }

  /**
   * O RESULTADO CHEGOU: os rolos passam a frear, cada um no seu tempo, até mostrá-lo.
   *
   * `grade` é o que o servidor sorteou, por coluna, de cima pra baixo. O motor calcula em
   * que ponto do anel a fita precisa parar pra que essas células fiquem na janela — e é só
   * isso que ele decide.
   */
  assentar(grade: string[][], aoParar?: () => void): void {
    this.resultado = grade;
    this.aoParar = aoParar ?? null;
    this.rolos.forEach((rolo, c) => {
      const coluna = grade[c] ?? [];
      /*
       * A fita recebe o resultado logo acima da posição atual, arredondada pra cima e com
       * uma volta inteira de folga: assim o rolo sempre AINDA GIRA antes de parar, em vez
       * de travar no lugar quando o resultado chega rápido.
       */
      const base = Math.ceil(rolo.posicao) + SIMBOLOS_NA_FITA;
      for (let f = 0; f < coluna.length; f += 1) {
        rolo.fita[(base + f) % SIMBOLOS_NA_FITA] = coluna[f];
      }
      rolo.alvo = base;
      rolo.partida = rolo.posicao;
      rolo.fase = 'cruzeiro';
      rolo.desde = this.relogio + c * ATRASO_ENTRE_ROLOS_EM_MS;
    });
  }

  fechar(): void {
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.rolos = [];
  }

  private passo(deltaMS: number): void {
    this.relogio += deltaMS;
    let todosPararam = true;

    for (const rolo of this.rolos) {
      switch (rolo.fase) {
        case 'acelerando': {
          const t = Math.min(1, (this.relogio - rolo.desde) / ACELERACAO_EM_MS);
          rolo.velocidade = VELOCIDADE * t * t;
          rolo.posicao += (rolo.velocidade * deltaMS) / 1000;
          if (t >= 1) rolo.fase = 'cruzeiro';
          todosPararam = false;
          break;
        }
        case 'cruzeiro': {
          rolo.velocidade = VELOCIDADE;
          rolo.posicao += (rolo.velocidade * deltaMS) / 1000;
          /* Com resultado na mão e o atraso desta coluna cumprido, começa a freada. */
          if (this.resultado && this.relogio >= rolo.desde) {
            rolo.fase = 'freando';
            rolo.desde = this.relogio;
            rolo.partida = rolo.posicao;
            /* Garante que o alvo está À FRENTE: freada nunca anda pra trás. */
            while (rolo.alvo < rolo.posicao + 3) rolo.alvo += SIMBOLOS_NA_FITA;
          }
          todosPararam = false;
          break;
        }
        case 'freando': {
          const t = Math.min(1, (this.relogio - rolo.desde) / FREADA_EM_MS);
          /*
           * A CURVA DA FREADA, com o repique embutido: sai rápido, chega devagar, passa um
           * pouco do alvo e volta. `1 - (1-t)^3` é a desaceleração; o seno do fim é o
           * baque do tambor travando.
           */
          const desacelera = 1 - Math.pow(1 - t, 3);
          const repique = t > 0.82 ? Math.sin((t - 0.82) / 0.18 * Math.PI) * REPIQUE : 0;
          rolo.posicao = rolo.partida + (rolo.alvo - rolo.partida) * desacelera + repique;
          rolo.velocidade = VELOCIDADE * Math.pow(1 - t, 2);
          if (t >= 1) {
            rolo.posicao = rolo.alvo;
            rolo.velocidade = 0;
            rolo.fase = 'parado';
          } else {
            todosPararam = false;
          }
          break;
        }
        case 'parado':
          rolo.velocidade = 0;
          break;
      }

      /*
       * O BORRÃO ACOMPANHA A VELOCIDADE. Parado é zero — senão o símbolo do resultado, que
       * é o que a pessoa foi olhar, ficaria embaçado.
       */
      rolo.borrao.strength = (rolo.velocidade / VELOCIDADE) * 9;
    }

    this.desenhar();

    if (todosPararam && this.aoParar) {
      const avisar = this.aoParar;
      this.aoParar = null;
      avisar();
    }
  }

  /** Recicla os sprites de cada rolo na posição atual do anel. */
  private desenhar(): void {
    for (const rolo of this.rolos) {
      const inteiro = Math.floor(rolo.posicao);
      const fracao = rolo.posicao - inteiro;
      for (let i = 0; i < rolo.sprites.length; i += 1) {
        const s = rolo.sprites[i];
        /*
         * A fita sobe, então a janela desce sobre ela: o símbolo de índice `inteiro + f` é
         * o que aparece na fileira `f`. `fracao` é o quanto ele já saiu da célula.
         */
        const indiceNaFita = ((inteiro + i) % SIMBOLOS_NA_FITA + SIMBOLOS_NA_FITA) % SIMBOLOS_NA_FITA;
        const textura = this.texturas[rolo.fita[indiceNaFita]];
        if (textura && s.texture !== textura) s.texture = textura;
        s.y = (i - fracao) * this.celula + this.celula / 2 - this.celula;
      }
    }
  }
}
