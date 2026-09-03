import { rollOnce, rollUntilDecisive } from '../banca-francesa/banca-francesa.engine';
import { roll as rolarBacBo } from '../bac-bo/bac-bo.engine';

/**
 * Confere que os dados dos dois jogos de dado são dados de verdade.
 *
 *   npx ts-node src/modules/games/shared/verify-dados.ts
 *
 * Três perguntas por jogo, com resposta medida e não prometida:
 *
 * 1. Cada dado mostra as SEIS faces, de 1 a 6? Nenhuma presa, nenhuma faltando.
 * 2. As seis saem com a mesma frequência? Qui-quadrado contra o esperado, 5 graus de
 *    liberdade — acima de 20,52 o dado não passa (é o corte de 99,9%).
 * 3. A soma cobre a faixa inteira? Três dados vão de 3 a 18; dois vão de 2 a 12.
 *
 * UM CUIDADO NA MEDIDA, que custou um susto: a lealdade do dado tem que ser medida no
 * lançamento CRU, não na saída de rollUntilDecisive. Medindo a saída dela, 1 e 6
 * apareciam em 17,2% contra 16,3% das outras faces, com qui-quadrado 244 — número que
 * grita "dado viciado". Não era: as somas que decidem a rodada são justamente as
 * extremas (3, 5, 6, 7, 14, 15, 16), então o lançamento que ENCERRA a rodada tende a
 * ter face extrema, e contar só esses enviesa a conta. O dado estava certo; a medida
 * é que estava olhando pro lugar errado.
 *
 * E uma quarta pergunta, que é a que confunde quem olha a Banca Francesa jogar: a soma FINAL
 * nunca é 4, nem 8 a 13, nem 17 ou 18 — essas não decidem nada e os dados voltam pro
 * copo. O que decide é sempre uma de sete somas: 3, 5, 6, 7, 14, 15 ou 16. Isso é
 * regra do jogo, não dado viciado, e o script mostra as duas coisas lado a lado pra
 * ninguém confundir uma com a outra.
 */
const RODADAS = 200_000;
const CORTE_QUI = 20.52;

let tudoOk = true;

function conferir(jogo: string, quantosDados: number, lances: number[][], faixa: [number, number]) {
  console.log(`\n=== ${jogo} — ${quantosDados} dados ===`);
  const porDado = Array.from({ length: quantosDados }, () => new Map<number, number>());
  const somas = new Set<number>();
  let total = 0;

  for (const lance of lances) {
    total += 1;
    lance.forEach((face, d) => porDado[d].set(face, (porDado[d].get(face) ?? 0) + 1));
    somas.add(lance.reduce((t, f) => t + f, 0));
  }

  console.log(`  ${total.toLocaleString('pt-BR')} lançamentos`);
  console.log('  1. cada dado mostra as seis faces, e com que frequência:');
  porDado.forEach((contagem, d) => {
    const esperado = total / 6;
    let qui = 0;
    const partes: string[] = [];
    for (let face = 1; face <= 6; face += 1) {
      const n = contagem.get(face) ?? 0;
      if (n === 0) tudoOk = false;
      qui += (n - esperado) ** 2 / esperado;
      partes.push(`${face}:${((n / total) * 100).toFixed(2)}%`);
    }
    const uniforme = qui < CORTE_QUI;
    if (!uniforme) tudoOk = false;
    console.log(`     dado ${d + 1}  ${partes.join('  ')}   qui² ${qui.toFixed(2)} ${uniforme ? 'uniforme' : 'VICIADO'}`);
  });

  const [min, max] = faixa;
  const faltando: number[] = [];
  for (let s = min; s <= max; s += 1) if (!somas.has(s)) faltando.push(s);
  console.log(`  2. somas de ${min} a ${max}: ${faltando.length === 0 ? 'todas apareceram' : `FALTOU ${faltando.join(', ')}`}`);
  if (faltando.length) tudoOk = false;
}

// --- Banca Francesa: 3 dados, soma de 3 a 18. Lançamento cru, sem filtro. ---
const lancesBanca: number[][] = [];
for (let i = 0; i < RODADAS * 3; i += 1) lancesBanca.push(rollOnce());
conferir('BANCA FRANCESA', 3, lancesBanca, [3, 18]);

// As somas que decidem — aqui o filtro é o assunto, não o erro.
const decisivas = new Map<number, number>();
for (let i = 0; i < RODADAS; i += 1) {
  const { sum } = rollUntilDecisive();
  decisivas.set(sum, (decisivas.get(sum) ?? 0) + 1);
}
console.log('  3. das somas acima, as que DECIDEM a rodada:');
for (const [s, n] of [...decisivas.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`     soma ${String(s).padStart(2)} → ${((n / RODADAS) * 100).toFixed(2)}% das rodadas`);
}
console.log('     (4, 8 a 13, 17 e 18 saem nos dados, mas não decidem: os dados voltam pro copo)');

// --- Bac Bo: 2 dados por lado, soma de 2 a 12 em cada lado ---
const lancesBacBo: number[][] = [];
for (let i = 0; i < RODADAS; i += 1) {
  const r = rolarBacBo();
  lancesBacBo.push(r.playerDice);
  lancesBacBo.push(r.bankerDice);
}
conferir('BAC BO (cada lado)', 2, lancesBacBo, [2, 12]);

console.log(`\n${tudoOk ? 'TUDO CERTO' : 'ALGO FALHOU'}`);
process.exit(tudoOk ? 0 : 1);
