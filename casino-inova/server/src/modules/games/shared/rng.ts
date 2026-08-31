import { randomBytes, randomInt } from 'node:crypto';

/**
 * A fonte de aleatoriedade de TODOS os resultados do cassino.
 *
 * Por que não `Math.random()`: ele é rápido e uniforme, mas não é imprevisível. O V8 usa
 * xorshift128+, cujo estado interno tem 128 bits e pode ser reconstruído a partir de um
 * punhado de saídas observadas — depois disso dá pra prever os próximos números. Num
 * jogo qualquer isso é irrelevante; num cassino é o jogo inteiro. Quem observasse
 * algumas rodadas poderia saber a próxima carta.
 *
 * Aqui a fonte é o CSPRNG do sistema operacional, via node:crypto. Não tem estado
 * observável, não dá pra prever a partir das saídas, e é a mesma classe de gerador que
 * se usa pra chave criptográfica.
 *
 * As funções abaixo também evitam VIÉS DE MÓDULO, que é o erro clássico: fazer
 * `randomBytes(1)[0] % 6` deixa os valores 0 e 1 mais prováveis que os outros, porque
 * 256 não divide por 6. `randomInt` do Node já resolve isso descartando e resorteando,
 * e é por isso que ele é usado em vez de conta na mão.
 */

/** 2^48 — o tamanho do inteiro que vira fração. 48 bits de precisão bastam e sobram. */
const ESCALA = 2 ** 48;

/**
 * Um número em [0, 1), como `Math.random()`, mas criptograficamente seguro.
 *
 * É o formato que os motores já esperam, então trocar a fonte não mexeu em nenhuma
 * regra de jogo — só em de onde os números vêm.
 */
export function fracao(): number {
  // Seis bytes = 48 bits, lidos como um inteiro sem sinal e divididos pela escala.
  // Sem resto, sem módulo, sem viés: cada um dos 2^48 valores tem a mesma chance.
  return randomBytes(6).readUIntBE(0, 6) / ESCALA;
}

/** Um inteiro em [min, max) — max exclusivo, como `randomInt` do Node. */
export function inteiro(min: number, max: number): number {
  return randomInt(min, max);
}

/** Um dado de seis faces: 1 a 6. */
export function dado(): number {
  return randomInt(1, 7);
}

/** Um item da lista, com a mesma chance pra todos. */
export function umDe<T>(itens: readonly T[]): T {
  return itens[randomInt(0, itens.length)];
}

/**
 * Fisher-Yates com sorteio seguro. Cada permutação sai com a mesma probabilidade —
 * é o que garante que nenhuma posição do baralho seja mais provável que outra.
 */
export function embaralhar<T>(itens: readonly T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
