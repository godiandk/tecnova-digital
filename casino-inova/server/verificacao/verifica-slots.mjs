/**
 * Confere, contra o servidor de verdade, que o que o slot PAGA bate com o que a grade
 * MOSTRA. Reimplementa a leitura da linha aqui de propósito: se o motor mudar e esta
 * conta independente discordar, é sinal de que a tela e o prêmio saíram de sincronia.
 */
const BASE = 'http://localhost:3000';
const email = `audita-${Date.now()}@teste.local`;

const post = async (rota, corpo, token) => {
  const r = await fetch(`${BASE}${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${rota} -> ${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
};

const conta = await post('/auth/cadastrar', { email, senha: 'senha-de-teste-123', nome: 'Auditor' });
const token = conta.token ?? conta.accessToken ?? conta.access_token;
if (!token) throw new Error(`sem token no cadastro: ${JSON.stringify(conta).slice(0, 200)}`);

const config = await fetch(`${BASE}/games/slots/config`).then((r) => r.json());
const premio = Object.fromEntries(config.symbols.map((s) => [s.id, s.payout]));

let giros = 0, comPremio = 0, problemas = 0;
const vistos = { 3: 0, 4: 0, 5: 0 };

while (giros < 220) {
  let r;
  try { r = await post('/games/slots/girar', { bet: config.minBet }, token); }
  catch (e) { if (String(e).includes('saldo')) break; throw e; }
  giros += 1;

  // Conta as linhas por fora, do jeito que a regra manda: começa no rolo 1 e anda.
  const esperado = [];
  for (const linha of config.paylines) {
    const primeiro = r.grid[linha.cells[0]];
    let n = 1;
    while (n < linha.cells.length && r.grid[linha.cells[n]] === primeiro) n += 1;
    if (n >= config.minMatch) {
      esperado.push({ payline: linha.name, symbolId: primeiro, matched: n, win: config.minBet * premio[primeiro][n] });
    }
  }
  const total = esperado.reduce((s, l) => s + l.win, 0);

  if (total !== r.totalWin) {
    problemas += 1;
    console.log(`DIVERGIU: servidor pagou ${r.totalWin}, a grade dá ${total}`);
    console.log('  grade:', r.grid.join(' '));
  }
  for (const linha of r.winningLines) {
    vistos[linha.matched] = (vistos[linha.matched] ?? 0) + 1;
    // As células acesas têm que ser exatamente as que casaram, nem mais nem menos.
    const def = config.paylines.find((l) => l.name === linha.payline);
    const certas = def.cells.slice(0, linha.matched);
    if (linha.cells.join(',') !== certas.join(',')) {
      problemas += 1;
      console.log(`CELULAS ERRADAS na ${linha.payline}: ${linha.cells} != ${certas}`);
    }
    // E todas têm que ter mesmo o símbolo que a linha diz.
    if (!certas.every((c) => r.grid[c] === linha.symbolId)) {
      problemas += 1;
      console.log(`SIMBOLO ERRADO na ${linha.payline}: diz ${linha.symbolId}, grade tem ${certas.map((c) => r.grid[c])}`);
    }
  }
  if (r.totalWin > 0) comPremio += 1;
}

console.log(`\n${giros} giros de ${config.minBet} fichas`);
console.log(`giros premiados: ${comPremio} (${((comPremio / giros) * 100).toFixed(1)}%)`);
console.log(`combinações vistas — 3 iguais: ${vistos[3] ?? 0}, 4 iguais: ${vistos[4] ?? 0}, 5 iguais: ${vistos[5] ?? 0}`);
console.log(problemas === 0 ? '\nOK: cada ficha paga bate com o que a grade mostra.' : `\n${problemas} divergência(s).`);
process.exit(problemas === 0 ? 0 : 1);
