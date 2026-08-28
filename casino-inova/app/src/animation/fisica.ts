/**
 * O pouco de física que faz um objeto parecer que caiu na mesa.
 *
 * Nada aqui é simulação de verdade: é o desenho de uma trajetória com atrito, quique e
 * giro que desacelera. Bastam essas três coisas pro olho ler "objeto lançado" em vez de
 * "figura que apareceu no lugar" — que é o que o app fazia antes.
 *
 * As curvas são calculadas em JavaScript e amostradas num vetor. A animação depois só
 * interpola dentro desse vetor, o que roda na thread de UI sem cálculo por quadro.
 */

/** Quantos pontos a trajetória guarda. 48 é liso o bastante e barato de interpolar. */
const AMOSTRAS = 48;

export interface Trajetoria {
  /** Tempos normalizados, de 0 a 1. */
  tempos: number[];
  /** Deslocamento horizontal, em pixel, em relação ao ponto de descanso. */
  x: number[];
  /** Deslocamento vertical, em pixel, em relação ao ponto de descanso. */
  y: number[];
  /** Altura acima da mesa, de 0 (pousado) a 1 (alto). Move a sombra e a escala. */
  altura: number[];
  /** Giro acumulado, em graus. */
  giro: number[];
}

/**
 * Atrito: rápido no começo, quase parado no fim. Expoente alto de propósito — objeto
 * pesado em pano perde velocidade depressa, e é isso que separa "dado" de "balão".
 */
function comAtrito(t: number): number {
  return 1 - Math.pow(1 - t, 2.6);
}

/**
 * Quiques decrescentes.
 *
 * `|sen|` dá a sequência de saltos; o `(1-t)` que multiplica faz cada um ser mais baixo
 * que o anterior; o expoente no tempo aperta os últimos, que é como quique de verdade
 * se comporta — vão ficando mais curtos E mais juntos.
 */
function quiques(t: number, quantos: number): number {
  return Math.pow(1 - t, 1.7) * Math.abs(Math.sin(Math.PI * quantos * Math.pow(t, 0.82)));
}

/**
 * Monta a trajetória de um objeto lançado até o lugar onde ele descansa.
 *
 * `deX`/`deY` são de onde ele vem, em pixel, relativo ao ponto de descanso — negativo
 * em Y significa "de cima". O objeto sempre TERMINA no ponto de descanso: quem decide
 * onde ele para é quem chamou, e a física só desenha o caminho até lá.
 */
export function lancar(opcoes: {
  deX: number;
  deY: number;
  /** Voltas completas durante o voo. Sai fracionado de propósito, e o fim arredonda. */
  giros: number;
  /**
   * Em que ângulo o objeto pode parar.
   *
   * 90 pro dado: qualquer múltiplo de 90 deixa uma face pra cima. 360 pra carta: ela
   * tem que terminar EM PÉ. Com 90 aqui, a carta parava deitada de lado uma vez a cada
   * duas — foi assim que o defeito apareceu.
   */
  passoDoGiro?: number;
  quantosQuiques?: number;
  /** Altura do primeiro salto, de 0 a 1. */
  alturaInicial?: number;
}): Trajetoria {
  const { deX, deY, giros, quantosQuiques = 3, alturaInicial = 1, passoDoGiro = 90 } = opcoes;

  const tempos: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  const altura: number[] = [];
  const giro: number[] = [];

  const giroTotal = Math.round((giros * 360) / passoDoGiro) * passoDoGiro;

  for (let i = 0; i < AMOSTRAS; i += 1) {
    const t = i / (AMOSTRAS - 1);
    const avanco = comAtrito(t);
    tempos.push(t);
    x.push(deX * (1 - avanco));
    y.push(deY * (1 - avanco));
    altura.push(alturaInicial * quiques(t, quantosQuiques));
    giro.push(giroTotal * avanco);
  }

  // Garante o pouso exato, sem sobra de arredondamento no último quadro.
  x[AMOSTRAS - 1] = 0;
  y[AMOSTRAS - 1] = 0;
  altura[AMOSTRAS - 1] = 0;
  giro[AMOSTRAS - 1] = giroTotal;

  return { tempos, x, y, altura, giro };
}
