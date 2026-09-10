/**
 * A MESA DE SOM — quem toca, quão alto, e o que cala pra quê.
 *
 * O que existia antes: um `tocar(nome)` que tocava. Serve pra uma mesa com três dados e
 * não serve pro resto — quando existirem música e ambiente, e quando doze estalos
 * quiserem sair ao mesmo tempo no big win, sem uma mesa de som o resultado é papa.
 *
 * ESTE ARQUIVO NÃO TOCA NADA. Ele só decide. É de propósito: decisão de mixagem que mora
 * dentro do código de áudio só pode ser conferida com uma placa de som e um ouvido, e aí
 * não é conferida nunca. Aqui é aritmética com um relógio de mentira, e a conferência
 * roda em qualquer lugar.
 *
 * AS TRÊS COISAS QUE ELA RESOLVE:
 *
 * 1. CAMADAS COM VOLUME PRÓPRIO. Quem quer música baixa e efeito alto não deveria ter que
 *    escolher entre som e silêncio. E o mudo continua sendo mudo: ele desliga tudo, sem
 *    negociar.
 *
 * 2. ORÇAMENTO DE VOZES COM PRIORIDADE. Doze batidas ao mesmo tempo não viram doze sons —
 *    viram um borrão alto. Há um teto de vozes simultâneas, e quando ele estoura, o som
 *    MENOS importante que já está tocando é que cede lugar. Nunca o mais importante: a
 *    ficha e o pagamento confirmam um gesto da pessoa e não podem ser engolidos por um
 *    dado roçando outro.
 *
 * 3. ABAIXAR PRA DEIXAR OUVIR (o "ducking"). Quando o pagamento toca, a música desce e
 *    volta sozinha. Sem isso a única forma de o prêmio ser ouvido seria ele ser mais alto
 *    que tudo — e som de cassino que grita é a coisa que faz a pessoa desligar o som e
 *    nunca mais ligar.
 *
 * O QUE AINDA NÃO EXISTE, dito aqui pra ninguém achar que existe: **não há música nem
 * ambiente**. O projeto tem seis efeitos (`assets/sons/`) e nenhuma faixa. As camadas
 * `musica` e `ambiente` estão prontas, com volume próprio e recebendo o abaixamento, mas
 * hoje ninguém toca nelas — todo som do jogo é `efeitos`.
 *
 * Ligar quando houver conteúdo é curto: registre o arquivo em `ARQUIVOS` de
 * `mesaSonora.ts`, aponte a camada em `CAMADA` e a importância em `PRIORIDADE`. O resto
 * (volume da camada, orçamento de voz, abaixamento) já funciona e já está conferido.
 *
 * Não foi gerada música sintética pra "completar" a peça: ambiente de cassino é murmúrio
 * de gente, e murmúrio sintetizado soa como chiado. Melhor a camada vazia e honesta do
 * que uma faixa ruim que alguém teria de tirar depois.
 */

export type Camada = 'efeitos' | 'musica' | 'ambiente';

/**
 * Quanto cada som importa. É o que decide quem cede lugar quando falta voz, e o que
 * dispara o abaixamento da música.
 */
export type Prioridade =
  /** Confirma um gesto da pessoa, ou anuncia dinheiro. Nunca é cortado. */
  | 'destaque'
  /** O corpo da cena: um dado batendo, uma carta virando. */
  | 'normal'
  /** Textura. Some primeiro e ninguém sente falta. */
  | 'fundo';

const PESO: Record<Prioridade, number> = { destaque: 3, normal: 2, fundo: 1 };

/**
 * Quantas vozes podem soar juntas.
 *
 * Oito não é um número redondo por acaso: é onde um lançamento de três dados (que produz
 * de seis a doze batidas em pouco mais de um segundo) ainda soa como dados, e não como
 * chuva. Acima disso o ouvido já não separa as batidas e o que sobra é volume.
 */
export const TETO_DE_VOZES = 8;

/** Quanto tempo uma voz fica contando como ocupada, se ninguém avisar que acabou. */
const DURACAO_SUPOSTA_MS = 220;

/** O quanto a música e o ambiente descem quando um destaque toca. */
const FUNDO_DO_ABAIXAMENTO = 0.25;
/** Quanto tempo leva pra descer, ficar embaixo e voltar. */
const ABAIXAMENTO = { descida: 90, embaixo: 260, subida: 520 };

export interface VozTocando {
  id: number;
  prioridade: Prioridade;
  ateQuando: number;
}

export interface Mistura {
  /** O volume que ESTE som deve sair, já com camada, mudo e abaixamento aplicados. */
  volumeDe(camada: Camada, pedido: number, agora: number): number;
  /** Decide se um som pode tocar agora; devolve a voz a roubar, se houver. */
  pedirVoz(prioridade: Prioridade, agora: number): { pode: boolean; roubarId: number | null };
  /** Avisa que uma voz começou. */
  comecou(id: number, prioridade: Prioridade, agora: number, duracaoMs?: number): void;
  /** Avisa que uma voz acabou (ou foi cortada). */
  acabou(id: number): void;
  /** Manda a música e o ambiente descerem pra deixar um destaque ser ouvido. */
  abaixarOFundo(agora: number): void;
  definirVolume(camada: Camada, valor: number): void;
  volumeDaCamada(camada: Camada): number;
  definirMudo(valor: boolean): void;
  estaMudo(): boolean;
  /** Pra conferência: quantas vozes estão contando como ocupadas. */
  vozesAtivas(agora: number): number;
}

export function criarMistura(): Mistura {
  const volumes: Record<Camada, number> = { efeitos: 1, musica: 0.6, ambiente: 0.4 };
  let mudo = false;
  let tocando: VozTocando[] = [];
  let abaixadoDesde: number | null = null;

  /** Tira da lista o que já terminou sozinho. */
  const limpar = (agora: number) => {
    tocando = tocando.filter((v) => v.ateQuando > agora);
  };

  /**
   * O envelope do abaixamento em `agora`: 1 é volume cheio, `FUNDO_DO_ABAIXAMENTO` é o
   * ponto mais baixo. Desce rápido e sobe devagar — descer devagar deixaria o começo do
   * destaque abafado, que é justamente o pedaço que precisa ser ouvido.
   */
  const fatorDoAbaixamento = (agora: number): number => {
    if (abaixadoDesde === null) return 1;
    const passado = agora - abaixadoDesde;
    const { descida, embaixo, subida } = ABAIXAMENTO;
    if (passado < 0) return 1;
    if (passado < descida) return 1 - (1 - FUNDO_DO_ABAIXAMENTO) * (passado / descida);
    if (passado < descida + embaixo) return FUNDO_DO_ABAIXAMENTO;
    const subindo = passado - descida - embaixo;
    if (subindo >= subida) return 1;
    return FUNDO_DO_ABAIXAMENTO + (1 - FUNDO_DO_ABAIXAMENTO) * (subindo / subida);
  };

  return {
    volumeDe(camada, pedido, agora) {
      if (mudo) return 0;
      const base = volumes[camada] * Math.max(0, Math.min(1, pedido));
      /*
       * O abaixamento vale pra música e pro ambiente, NUNCA pros efeitos. Um efeito que
       * se abaixa por causa de outro efeito é o começo de um cabo de guerra em que o som
       * inteiro respira junto — o defeito clássico de compressor mal ligado.
       */
      if (camada === 'efeitos') return base;
      return base * fatorDoAbaixamento(agora);
    },

    pedirVoz(prioridade, agora) {
      if (mudo) return { pode: false, roubarId: null };
      limpar(agora);
      if (tocando.length < TETO_DE_VOZES) return { pode: true, roubarId: null };

      /*
       * Falta voz. Quem cede é a MENOS importante que está tocando, e entre iguais, a
       * mais velha — porque ela já foi ouvida e a nova ainda não.
       */
      const candidata = [...tocando].sort(
        (a, b) => PESO[a.prioridade] - PESO[b.prioridade] || a.ateQuando - b.ateQuando,
      )[0];

      /* Ninguém cede lugar pra quem importa menos: senão o teto viraria "o último ganha". */
      if (PESO[candidata.prioridade] >= PESO[prioridade]) return { pode: false, roubarId: null };
      return { pode: true, roubarId: candidata.id };
    },

    comecou(id, prioridade, agora, duracaoMs = DURACAO_SUPOSTA_MS) {
      tocando = tocando.filter((v) => v.id !== id);
      tocando.push({ id, prioridade, ateQuando: agora + duracaoMs });
    },

    acabou(id) {
      tocando = tocando.filter((v) => v.id !== id);
    },

    abaixarOFundo(agora) {
      /*
       * Um destaque no meio de um abaixamento REINICIA a contagem em vez de somar. Sem
       * isso, dois pagamentos seguidos deixariam a música baixa por mais tempo do que o
       * segundo pediu, e ela voltaria num momento arbitrário.
       */
      abaixadoDesde = agora;
    },

    definirVolume(camada, valor) {
      volumes[camada] = Math.max(0, Math.min(1, valor));
    },
    volumeDaCamada(camada) {
      return volumes[camada];
    },
    definirMudo(valor) {
      mudo = valor;
    },
    estaMudo() {
      return mudo;
    },
    vozesAtivas(agora) {
      limpar(agora);
      return tocando.length;
    },
  };
}

/** Exportado pra conferência: o desenho do abaixamento, sem precisar de placa de som. */
export const FORMATO_DO_ABAIXAMENTO = { FUNDO: FUNDO_DO_ABAIXAMENTO, ...ABAIXAMENTO };
