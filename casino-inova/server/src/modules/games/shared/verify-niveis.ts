import {
  NIVEIS_DE_MESA,
  MESAS_DE_ENTRADA,
  NIVEL_PARA_ABRIR_O_DEGRAU,
  nivelPara,
  degrauDoNivel,
  degrauEconomico,
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

console.log('\n  quem tem quanto joga onde (com nível alto, que não segura nada):');
for (const saldo of [10_000, 60_000, 900_000, 8_000_000]) {
  const disp = niveisDisponiveis(saldo, 10_000).map((n) => n.nome).join(' ou ');
  console.log(`    ${saldo.toLocaleString('pt-BR').padStart(11)} → degrau ${nivelPara(saldo).nome.padEnd(9)} joga em: ${disp}`);
}
// Ninguém desce dois degraus.
if (podeJogarNo(8_000_000, 10_000, 'bronze') || podeJogarNo(900_000, 10_000, 'bronze')) {
  console.log('    FALHOU: dá pra descer mais de um degrau');
  ok = false;
}

/* ------------------------------------------------------------------ *
 * O DEGRAU ECONÔMICO — comprar ficha não compra mesa.
 * ------------------------------------------------------------------ */
console.log('\n\nO DEGRAU ECONÔMICO — o nível segura o que o saldo sozinho abriria?\n');
console.log('  degrau      abre no nível      saldo de entrada');
for (let i = 0; i < NIVEIS_DE_MESA.length; i += 1) {
  console.log(
    `  ${NIVEIS_DE_MESA[i].nome.padEnd(10)} ${String(NIVEL_PARA_ABRIR_O_DEGRAU[i]).padStart(13)} ` +
      `${NIVEIS_DE_MESA[i].saldoDeEntrada.toLocaleString('pt-BR').padStart(22)}`,
  );
}

/*
 * A CONFERÊNCIA QUE IMPORTA: comprar fichas não pode mudar o degrau de quem tem nível
 * baixo. É o exploit que a loja abriria — R$ 1.800 em pacotes chegavam ao Eclipse em um
 * ano, e depois não havia mais nada pra comprar.
 */
{
  const comprouTudo = degrauEconomico(5_000_000_000_000_000, 1);
  if (comprouTudo.id !== 'bronze') {
    console.log(`    FALHOU: nível 1 com 5 quatrilhões caiu no degrau ${comprouTudo.nome}, devia ser Bronze`);
    ok = false;
  } else {
    console.log('\n    nível 1 com 5 quatrilhões de fichas joga no BRONZE: comprar não compra mesa — ok');
  }

  // E o contrário também: nível alto com bolso vazio não abre mesa cara.
  const nivelSemFicha = degrauEconomico(0, 10_000);
  if (nivelSemFicha.id !== 'bronze') {
    console.log(`    FALHOU: nível 10.000 sem fichas caiu no degrau ${nivelSemFicha.nome}, devia ser Bronze`);
    ok = false;
  } else {
    console.log('    nível 10.000 com saldo zero joga no BRONZE: nível não paga a mesa — ok');
  }

  // O degrau econômico nunca passa de nenhum dos dois lados.
  let passou = 0;
  for (const saldo of [0, 10_000, 60_000, 900_000, 8e6, 8e9, 8e12, 5e15]) {
    for (const nivel of [1, 19, 20, 99, 100, 999, 1_200, 5_999, 10_000, 99_999]) {
      const e = NIVEIS_DE_MESA.indexOf(degrauEconomico(saldo, nivel));
      if (e > NIVEIS_DE_MESA.indexOf(nivelPara(saldo)) || e > NIVEIS_DE_MESA.indexOf(degrauDoNivel(nivel))) passou += 1;
    }
  }
  if (passou > 0) { console.log(`    FALHOU: o degrau econômico passou de um dos dois lados em ${passou} casos`); ok = false; }
  else console.log('    em 80 combinações de saldo x nível, nunca passa do saldo nem do nível — ok');

  /*
   * A ESCADA DE NÍVEIS PRECISA SER CRESCENTE, senão `degrauEconomico` compara posições
   * que não significam mais "mais alto".
   */
  const crescente = NIVEL_PARA_ABRIR_O_DEGRAU.every((n, i) => i === 0 || n > NIVEL_PARA_ABRIR_O_DEGRAU[i - 1]);
  if (!crescente) { console.log('    FALHOU: os níveis de abertura não são crescentes'); ok = false; }
  if (NIVEL_PARA_ABRIR_O_DEGRAU.length !== NIVEIS_DE_MESA.length) {
    console.log('    FALHOU: sobra ou falta nível de abertura pra algum degrau'); ok = false;
  }
  if (NIVEL_PARA_ABRIR_O_DEGRAU[0] !== 1) { console.log('    FALHOU: o Bronze precisa abrir no nível 1'); ok = false; }
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
