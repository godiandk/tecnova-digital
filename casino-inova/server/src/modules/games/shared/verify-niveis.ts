import {
  NIVEIS_DE_MESA,
  MESAS_DE_ENTRADA,
  nivelPara,
  niveisDisponiveis,
  podeJogarNo,
  dividirOBolo,
} from './niveis-de-mesa';

/**
 * Confere as duas economias do jogo.
 *
 *   npx ts-node src/modules/games/shared/verify-niveis.ts
 *
 * Duas coisas têm que ser verdade, e nenhuma das duas é óbvia olhando a tabela:
 *
 * 1. A aposta pesa o MESMO em qualquer nível. Se o mínimo do Ouro fosse 1% do saldo
 *    de entrada e o do Bronze 0,1%, o jogo seria mais duro com quem tem mais — ou com
 *    quem tem menos, dependendo do erro. A conta abaixo mostra a faixa de cada nível
 *    em porcentagem do bolso de quem entra nele.
 *
 * 2. O bolo dos jogos entre jogadores NUNCA cria nem some ficha. Num livro-caixa de
 *    inteiros, uma divisão que não fecha é dinheiro aparecendo do nada — e isso é o
 *    tipo de erro que só aparece meses depois, num extrato que não bate.
 */
let ok = true;

console.log('MESAS CONTRA A CASA — a aposta pesa o mesmo em todo nível?\n');
console.log('  nível      entra com        mínimo         máximo     mín%    máx%   fichas do trilho');
for (const n of NIVEIS_DE_MESA) {
  const base = n.saldoDeEntrada || 10_000; // o Bronze entra com zero: uso a banca inicial
  const minPct = (n.minimo / base) * 100;
  const maxPct = (n.maximo / base) * 100;
  console.log(
    `  ${n.nome.padEnd(9)} ${n.saldoDeEntrada.toLocaleString('pt-BR').padStart(12)} ` +
      `${n.minimo.toLocaleString('pt-BR').padStart(14)} ${n.maximo.toLocaleString('pt-BR').padStart(14)} ` +
      `${minPct.toFixed(2).padStart(6)}% ${maxPct.toFixed(1).padStart(6)}%   ${n.fichas.map((f) => (f >= 1000 ? `${f / 1000}k` : f)).join(' ')}`,
  );
}

console.log('\n  as faixas batem entre si?');
const faixas = NIVEIS_DE_MESA.slice(1).map((n) => [(n.minimo / n.saldoDeEntrada) * 100, (n.maximo / n.saldoDeEntrada) * 100]);
const mesmoMin = faixas.every(([m]) => Math.abs(m - faixas[0][0]) < 1e-9);
const mesmoMax = faixas.every(([, m]) => Math.abs(m - faixas[0][1]) < 1e-9);
if (!mesmoMin || !mesmoMax) ok = false;
console.log(`    mínimo ${faixas[0][0].toFixed(2)}% e máximo ${faixas[0][1].toFixed(1)}% do saldo de entrada, igual em todos: ${mesmoMin && mesmoMax ? 'sim' : 'NÃO'}`);

// Uma aposta só não pode zerar quem acabou de chegar no nível.
const tetoSadio = NIVEIS_DE_MESA.every((n) => n.maximo <= (n.saldoDeEntrada || 10_000) / 4);
if (!tetoSadio) ok = false;
console.log(`    nenhuma aposta única passa de 1/4 do bolso de quem entra: ${tetoSadio ? 'sim' : 'NÃO'}`);

console.log('\n  quem tem quanto joga onde:');
for (const saldo of [10_000, 60_000, 900_000, 8_000_000]) {
  const disp = niveisDisponiveis(saldo).map((n) => n.nome).join(' ou ');
  console.log(`    ${saldo.toLocaleString('pt-BR').padStart(11)} → nível ${nivelPara(saldo).nome.padEnd(9)} joga em: ${disp}`);
}
// Ninguém desce dois degraus.
if (podeJogarNo(8_000_000, 'bronze') || podeJogarNo(900_000, 'bronze')) {
  console.log('    FALHOU: dá pra descer mais de um degrau');
  ok = false;
}

console.log('\n\nMESAS ENTRE JOGADORES — o bolo fecha?\n');
console.log('  nível      entrada    2 jogadores (1 ganha)     4 jogadores (dupla ganha)');
for (const m of MESAS_DE_ENTRADA) {
  const linhas: string[] = [];
  for (const [jogadores, vencedores] of [[2, 1], [4, 2]] as const) {
    const partes = dividirOBolo(m.entrada, jogadores, vencedores);
    const bolo = m.entrada * jogadores;
    const pago = partes.reduce((t, p) => t + p, 0);
    const inteiro = partes.every((p) => Number.isInteger(p));
    if (pago !== bolo || !inteiro) ok = false;
    linhas.push(
      `bolo ${bolo.toLocaleString('pt-BR')} → ${partes.map((p) => p.toLocaleString('pt-BR')).join(' + ')}` +
        ` ${pago === bolo && inteiro ? 'fecha' : 'NÃO FECHA'}`,
    );
  }
  console.log(`  ${m.nome.padEnd(9)} ${m.entrada.toLocaleString('pt-BR').padStart(10)}    ${linhas.join('     ')}`);
}

// Divisões que não são exatas: a sobra tem que ir pra alguém, nunca sumir.
console.log('\n  divisão que não é exata (3 jogadores, 2 vencedores):');
for (const entrada of [1_000, 10_000, 7]) {
  const partes = dividirOBolo(entrada, 3, 2);
  const bolo = entrada * 3;
  const pago = partes.reduce((t, p) => t + p, 0);
  if (pago !== bolo) ok = false;
  console.log(`    entrada ${String(entrada).padStart(6)} → bolo ${bolo} → ${partes.join(' + ')} = ${pago} ${pago === bolo ? 'fecha' : 'NÃO FECHA'}`);
}

console.log(`\n${ok ? 'TUDO CERTO' : 'ALGO FALHOU'}`);
process.exit(ok ? 0 : 1);
