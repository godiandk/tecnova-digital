/**
 * Prova pela API de verdade que dois cliques na mesma aposta debitam uma vez só —
 * que é o cenário real: dedo duplo, ou o app reenviando depois de um timeout.
 */
const BASE = 'http://localhost:3000';
const post = async (rota, corpo, token) => {
  const r = await fetch(`${BASE}${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo ?? {}),
  });
  return { ok: r.ok, status: r.status, corpo: JSON.parse(await r.text()) };
};
const saldo = async (token) =>
  (await fetch(`${BASE}/wallet/saldo`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json())).balance;

const conta = await post('/auth/cadastrar', { email: `idem-${Date.now()}@teste.local`, senha: 'senha-de-teste-123', nome: 'Auditor Idem' });
const token = conta.corpo.token ?? conta.corpo.accessToken;

let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`FALHOU: ${m}`); };

// --- 1. Mesmo actionId, 20 vezes ao mesmo tempo ---
{
  const antes = await saldo(token);
  const acao = `giro-${Date.now()}`;
  const respostas = await Promise.all(Array.from({ length: 20 }, () => post('/games/slots/girar', { bet: 100, actionId: acao }, token)));
  const oks = respostas.filter((r) => r.ok);
  if (oks.length !== 20) falhar(`${20 - oks.length} respostas falharam`);
  const depois = await saldo(token);
  const cobrado = antes - depois + oks.reduce((s, r) => 0, 0);
  // O saldo tem que ter caído 100 (a aposta) e subido o prêmio, se houve. Comparo pela
  // grade: todas as respostas de uma mesma ação deviam contar a MESMA rodada.
  const grades = new Set(oks.map((r) => r.corpo.grid.join(',')));
  if (grades.size !== 1) falhar(`20 chamadas da mesma ação geraram ${grades.size} rodadas diferentes`);
  const premio = oks[0].corpo.totalWin;
  const esperado = antes - 100 + premio;
  if (depois !== esperado) falhar(`saldo ficou ${depois}, esperava ${esperado} (antes ${antes}, aposta 100, prêmio ${premio})`);
  console.log(`20 giros simultâneos com o mesmo actionId: 1 rodada, cobrou 100, pagou ${premio} — ok`);
}

// --- 2. Sem actionId, cada chamada é um giro novo ---
{
  const antes = await saldo(token);
  const respostas = await Promise.all(Array.from({ length: 5 }, () => post('/games/slots/girar', { bet: 100 }, token)));
  const premios = respostas.filter((r) => r.ok).reduce((s, r) => s + r.corpo.totalWin, 0);
  const depois = await saldo(token);
  if (depois !== antes - 500 + premios) falhar(`5 giros sem chave: saldo ${depois}, esperava ${antes - 500 + premios}`);
  console.log('5 giros sem actionId: 5 rodadas, cobrou 500 — ok');
}

// --- 3. Blackjack: apostar duas vezes com a mesma chave não abre duas mãos ---
{
  const antes = await saldo(token);
  const acao = `mao-${Date.now()}`;
  const a = await post('/games/blackjack/apostar', { bet: 100, actionId: acao }, token);
  const b = await post('/games/blackjack/apostar', { bet: 100, actionId: acao }, token);
  if (!a.ok) falhar('a primeira aposta de blackjack falhou');
  // A segunda ou devolve a mesma mão, ou recusa por já ter mão em andamento —
  // o que NÃO pode é cobrar de novo.
  const depois = await saldo(token);
  const cobrado = antes - depois;
  if (cobrado !== 100) falhar(`blackjack cobrou ${cobrado} por duas chamadas da mesma ação; devia cobrar 100`);
  console.log(`blackjack, mesma ação duas vezes: cobrou ${cobrado} — ok`);
}

console.log(problemas === 0 ? '\nOK: a mesma aposta nunca é cobrada duas vezes.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
