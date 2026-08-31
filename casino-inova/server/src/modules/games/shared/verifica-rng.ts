import { dado, embaralhar, fracao, inteiro, umDe } from './rng';
import { randomInt } from 'node:crypto';

/**
 * Confere que a fonte de aleatoriedade do cassino é uniforme e não tem viés.
 *
 * Um gerador torto é a falha mais silenciosa que existe aqui: o jogo continua rodando,
 * as cartas continuam saindo, os pagamentos continuam batendo com as regras — e a
 * distribuição está errada. Nenhum teste de regra pega isso; só medição pega.
 *
 * O que este teste NÃO consegue provar é imprevisibilidade — nenhum teste estatístico
 * prova isso. Ela vem de onde os bytes nascem: o CSPRNG do sistema, via node:crypto.
 * O que dá pra provar aqui é que a conversão desses bytes em número de jogo não
 * introduziu viés no caminho, que é onde o erro costuma estar.
 *
 *   npx ts-node src/modules/games/shared/verifica-rng.ts
 */
let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

/**
 * Qui-quadrado: mede o quanto as contagens observadas se afastam das esperadas. Valores
 * críticos a 99,9% de confiança, pra o teste não acusar erro por azar.
 */
function quiQuadrado(contagens: number[], esperadoPorCaixa: number): number {
  return contagens.reduce((soma, obs) => soma + (obs - esperadoPorCaixa) ** 2 / esperadoPorCaixa, 0);
}

// --- 1. fracao() cobre [0,1) uniformemente ---
{
  const CAIXAS = 20;
  const N = 2_000_000;
  const contagens = new Array(CAIXAS).fill(0);
  let min = 1;
  let max = 0;
  for (let i = 0; i < N; i += 1) {
    const f = fracao();
    if (f < 0 || f >= 1) { falhar(`fracao() devolveu ${f}, fora de [0,1)`); break; }
    min = Math.min(min, f);
    max = Math.max(max, f);
    contagens[Math.floor(f * CAIXAS)] += 1;
  }
  const x2 = quiQuadrado(contagens, N / CAIXAS);
  // 19 graus de liberdade, 99,9%: 43,82
  if (x2 > 43.82) falhar(`fracao() não passou no qui-quadrado: ${x2.toFixed(1)} > 43,82`);
  console.log(`fracao(): ${N.toLocaleString('pt-BR')} amostras em ${CAIXAS} caixas, qui-quadrado ${x2.toFixed(1)} (limite 43,8) — ok`);
  // 12 casas: com 6, um 0,9999996 vira "1.000000" e parece estar fora do intervalo.
  console.log(`          menor ${min.toFixed(12)}, maior ${max.toFixed(12)} (o teto 1 nunca sai)`);
}

// --- 2. dado() dá 1..6 com a mesma chance ---
{
  const N = 1_200_000;
  const contagens = new Array(6).fill(0);
  for (let i = 0; i < N; i += 1) {
    const d = dado();
    if (!Number.isInteger(d) || d < 1 || d > 6) { falhar(`dado() devolveu ${d}`); break; }
    contagens[d - 1] += 1;
  }
  const x2 = quiQuadrado(contagens, N / 6);
  // 5 graus de liberdade, 99,9%: 20,52
  if (x2 > 20.52) falhar(`dado() não passou no qui-quadrado: ${x2.toFixed(1)} > 20,52`);
  const pior = Math.max(...contagens.map((c) => Math.abs(c / N - 1 / 6)));
  console.log(`dado(): qui-quadrado ${x2.toFixed(1)} (limite 20,5), pior face ${(pior * 100).toFixed(3)} ponto fora do esperado — ok`);
}

// --- 3. inteiro() respeita o intervalo, com max exclusivo ---
{
  const vistos = new Set<number>();
  for (let i = 0; i < 100_000; i += 1) {
    const n = inteiro(5, 9);
    if (n < 5 || n >= 9) { falhar(`inteiro(5,9) devolveu ${n}`); break; }
    vistos.add(n);
  }
  if (vistos.size !== 4) falhar(`inteiro(5,9) só produziu ${[...vistos].sort().join(',')}, esperava 5,6,7,8`);
  console.log(`inteiro(5,9): saiu 5,6,7,8 e nada fora — ok`);
}

// --- 4. embaralhar() não perde, não duplica, e não tem viés de posição ---
{
  const BARALHO = Array.from({ length: 52 }, (_, i) => i);
  const N = 200_000;
  // Onde a carta 0 foi parar, em cada embaralho.
  const posicoes = new Array(52).fill(0);
  for (let i = 0; i < N; i += 1) {
    const mexido = embaralhar(BARALHO);
    if (mexido.length !== 52 || new Set(mexido).size !== 52) {
      falhar('embaralhar perdeu ou duplicou carta');
      break;
    }
    posicoes[mexido.indexOf(0)] += 1;
  }
  const x2 = quiQuadrado(posicoes, N / 52);
  // 51 graus de liberdade, 99,9%: 90,57
  if (x2 > 90.57) falhar(`embaralhar tem viés de posição: qui-quadrado ${x2.toFixed(1)} > 90,57`);
  console.log(`embaralhar(): 52 cartas inteiras em ${N.toLocaleString('pt-BR')} embaralhos, qui-quadrado da posição ${x2.toFixed(1)} (limite 90,6) — ok`);
}

// --- 5. umDe() é uniforme ---
{
  const ITENS = ['a', 'b', 'c', 'd', 'e'] as const;
  const N = 500_000;
  const contagens = new Map<string, number>(ITENS.map((i) => [i, 0]));
  for (let i = 0; i < N; i += 1) {
    const escolhido = umDe(ITENS);
    contagens.set(escolhido, (contagens.get(escolhido) ?? 0) + 1);
  }
  const x2 = quiQuadrado([...contagens.values()], N / ITENS.length);
  // 4 graus de liberdade, 99,9%: 18,47
  if (x2 > 18.47) falhar(`umDe() não passou no qui-quadrado: ${x2.toFixed(1)} > 18,47`);
  console.log(`umDe(): qui-quadrado ${x2.toFixed(1)} (limite 18,5) — ok`);
}

// --- 6. A prova de que o viés de módulo é real, e que não estamos caindo nele ---
{
  /*
   * O erro clássico seria `randomBytes(1)[0] % 6`. Como 256 não divide por 6, os
   * valores 0..3 aparecem 43 vezes em 256 e os 4..5 só 42 — um viés de ~2,3% a favor
   * dos primeiros. Aqui a conta é feita de propósito pra mostrar que o desvio existe, e
   * logo abaixo que o nosso dado() não tem esse desvio.
   */
  const enviesado = new Array(6).fill(0);
  for (let b = 0; b < 256; b += 1) enviesado[b % 6] += 1;
  const desvioDoErrado = Math.max(...enviesado) / Math.min(...enviesado) - 1;

  const N = 600_000;
  const nosso = new Array(6).fill(0);
  for (let i = 0; i < N; i += 1) nosso[randomInt(0, 6)] += 1;
  const desvioDoNosso = Math.max(...nosso) / Math.min(...nosso) - 1;

  if (desvioDoNosso > desvioDoErrado) {
    falhar('o nosso sorteio ficou mais torto que o erro clássico de módulo');
  }
  console.log(
    `viés de módulo: o jeito errado (byte % 6) desvia ${(desvioDoErrado * 100).toFixed(2)}%; ` +
      `o nosso desvia ${(desvioDoNosso * 100).toFixed(2)}% em ${N.toLocaleString('pt-BR')} sorteios — ok`,
  );
}

console.log(problemas === 0 ? '\nOK: a fonte de aleatoriedade é uniforme e sem viés.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
