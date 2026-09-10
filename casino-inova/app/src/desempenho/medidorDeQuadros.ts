/**
 * O MEDIDOR DE QUADROS DO APLICATIVO.
 *
 * Mesma conta da POC de renderização (`poc-renderizacao/comum/medidor.js`), de propósito:
 * se os números forem calculados de jeitos diferentes, não dá pra comparar o que a POC
 * mediu com o que o jogo de verdade entrega — e comparar é justamente o que precisa
 * acontecer pra fechar a decisão de renderer.
 *
 * NÃO MEDE "FPS MÉDIO", que é o número que mais engana em jogo: um segundo com 59 quadros
 * de 10 ms e um de 400 ms dá 60 de média, e é uma travada que qualquer pessoa vê. O que
 * importa é a DISTRIBUIÇÃO, e principalmente a cauda.
 *
 * SOBRE "QUADRO PERDIDO". Não é "passou de 16,67 ms" — esse limiar fica em cima da linha
 * de um renderizador preso ao sincronismo da tela, e produz "p95 de 16,8 ms" junto com
 * "57% dos quadros perdidos" ao mesmo tempo, que não pode ser verdade. Quadro perdido é
 * quando uma VIRADA DE TELA passou em branco: 33 ms a 60 Hz é um perdido, 50 ms são dois.
 * É o que a pessoa enxerga.
 *
 * ELE PRECISA SER MAIS BARATO DO QUE O QUE MEDE. Por isso guarda números num vetor e não
 * calcula nada enquanto roda; a estatística sai só quando alguém pede. E por isso o vetor
 * tem teto: medir dez minutos de jogo não pode virar um vazamento de memória.
 */

/** O orçamento de um quadro a 60 Hz. */
export const ORCAMENTO_MS = 1000 / 60;

/** Quantos intervalos guardar. A 60 por segundo, são uns 2 minutos de jogo. */
const TETO_DE_AMOSTRAS = 7200;

export interface MedidaDeQuadros {
  quadros: number;
  p50: number;
  p95: number;
  p99: number;
  pior: number;
  media: number;
  fps: number;
  /** Viradas de tela que passaram em branco, somadas. */
  perdidos: number;
  /** Quantos por cento dos quadros deixaram ao menos uma virada passar. */
  perdidosPorCento: number;
}

export interface MedidorDeQuadros {
  /** Chame uma vez por quadro, com o tempo em milissegundos. */
  quadro(agora: number): void;
  /** A estatística de tudo que foi medido até agora, ou `null` se ainda não deu. */
  resultado(): MedidaDeQuadros | null;
  /** Joga fora o que foi medido — pra medir uma cena específica, e não a sessão toda. */
  zerar(): void;
}

export function criarMedidorDeQuadros(): MedidorDeQuadros {
  let intervalos: number[] = [];
  let anterior: number | null = null;
  let primeiro = true;

  return {
    quadro(agora: number): void {
      if (anterior !== null) {
        /*
         * O primeiro intervalo é descartado sempre: ele carrega a compilação do shader,
         * a subida da textura e o primeiro layout, e não representa nada.
         */
        if (primeiro) primeiro = false;
        else {
          intervalos.push(agora - anterior);
          /* Teto: descarta a metade mais velha em vez de crescer sem fim. */
          if (intervalos.length > TETO_DE_AMOSTRAS) {
            intervalos = intervalos.slice(intervalos.length / 2);
          }
        }
      }
      anterior = agora;
    },

    resultado(): MedidaDeQuadros | null {
      if (intervalos.length === 0) return null;
      const ordenados = [...intervalos].sort((a, b) => a - b);
      const pct = (p: number) =>
        ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))];

      /*
       * Quantas viradas de tela este intervalo comeu. `round` e não `floor`: 16,68 ms
       * arredonda pra 1 virada (nenhuma perdida) e 33,2 ms pra 2 (uma perdida).
       */
      const perdidosDe = (x: number) => Math.max(0, Math.round(x / ORCAMENTO_MS) - 1);
      const perdidos = intervalos.reduce((s, x) => s + perdidosDe(x), 0);
      const engasgos = intervalos.filter((x) => perdidosDe(x) > 0).length;
      const media = intervalos.reduce((s, x) => s + x, 0) / intervalos.length;

      return {
        quadros: intervalos.length,
        p50: arredonda(pct(50)),
        p95: arredonda(pct(95)),
        p99: arredonda(pct(99)),
        pior: arredonda(ordenados[ordenados.length - 1]),
        media: arredonda(media),
        fps: arredonda(1000 / media),
        perdidos,
        perdidosPorCento: arredonda((engasgos / intervalos.length) * 100),
      };
    },

    zerar(): void {
      intervalos = [];
      anterior = null;
      primeiro = true;
    },
  };
}

function arredonda(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * O veredito em uma frase — porque número solto não decide nada.
 *
 * A régua é a mesma que está no relatório da POC: o que vale é caber no orçamento na
 * CAUDA, não na média. Um jogo com p50 de 16 ms e p99 de 90 ms está pior, para quem
 * joga, do que um com p50 de 20 ms e p99 de 22 ms — o primeiro trava, o segundo é só
 * um pouco mais lento e constante.
 */
export function comoEstaIndo(m: MedidaDeQuadros): { nivel: 'bom' | 'atencao' | 'ruim'; frase: string } {
  if (m.p99 <= ORCAMENTO_MS * 1.5 && m.perdidosPorCento < 1) {
    return { nivel: 'bom', frase: 'fluido: até a cauda cabe no orçamento' };
  }
  if (m.p95 <= ORCAMENTO_MS * 1.5 && m.perdidosPorCento < 5) {
    return { nivel: 'atencao', frase: 'quase: o quadro típico cabe, mas a cauda engasga' };
  }
  return { nivel: 'ruim', frase: 'trava: quem joga está vendo isso' };
}
