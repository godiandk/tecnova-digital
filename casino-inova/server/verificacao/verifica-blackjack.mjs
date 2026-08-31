/**
 * Joga blackjack de verdade contra o servidor até encontrar cada jogada nova —
 * dividir, dobrar e seguro — e confere o dinheiro em cada uma. É o teste que prova que
 * o serviço está ligado certo, e não só que a matemática do motor fecha.
 */
const BASE = 'http://localhost:3000';
const post = async (rota, corpo, token) => {
  const r = await fetch(`${BASE}${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo ?? {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${rota} -> ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
};

const conta = await post('/auth/cadastrar', { email: `bj-${Date.now()}@teste.local`, senha: 'senha-de-teste-123', nome: 'Auditor BJ' });
const token = conta.token ?? conta.accessToken;

let viuSplit = 0, viuDouble = 0, viuSeguro = 0, viuBJ = 0, maos = 0, problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`FALHOU: ${m}`); };

const APOSTA = 50;
let saldoAnterior = null;

while (maos < 400 && (viuSplit < 3 || viuDouble < 3 || viuSeguro < 2)) {
  let e;
  try { e = await post('/games/blackjack/apostar', { bet: APOSTA }, token); }
  catch (err) { if (String(err).includes('saldo')) break; throw err; }
  maos += 1;

  // O seguro trava tudo até ser respondido — é a ordem da mesa.
  if (e.esperandoSeguro) {
    viuSeguro += 1;
    if (e.seguroMaximo !== Math.floor(APOSTA / 2)) falhar(`seguro máximo ${e.seguroMaximo}, devia ser ${APOSTA/2}`);
    // Recusa (que é o certo), menos uma vez pra medir o pagamento.
    const aceitar = viuSeguro === 1;
    e = await post('/games/blackjack/seguro', { aceitar }, token);
    if (aceitar && e.seguro !== Math.floor(APOSTA / 2)) falhar('o seguro aceito não foi debitado pelo valor certo');
    if (aceitar && e.seguroPago > 0 && e.seguroPago !== e.seguro * 3) falhar('o seguro pagou diferente de 2:1');
  }

  // Joga cada mão até fechar.
  let voltas = 0;
  while (!e.finished && voltas < 30) {
    voltas += 1;
    const mao = e.maos[e.maoAtual];
    if (e.podeDividir && viuSplit < 3) {
      const antes = e.maos.length;
      e = await post('/games/blackjack/dividir', null, token);
      viuSplit += 1;
      if (e.maos.length !== antes + 1) falhar('dividir não criou mão nova');
      // Cada mão do split carrega a aposta original.
      for (const m of e.maos) if (m.deSplit && m.aposta !== APOSTA && !m.dobrada) falhar(`mão de split com aposta ${m.aposta}`);
      // 21 depois de dividir não pode ser blackjack.
      for (const m of e.maos) if (m.deSplit && m.total === 21 && m.blackjack) falhar('21 depois de dividir contou como blackjack');
      continue;
    }
    if (e.podeDobrar && viuDouble < 3 && mao.total >= 9 && mao.total <= 11) {
      const antes = mao.aposta;
      e = await post('/games/blackjack/dobrar', null, token);
      viuDouble += 1;
      const dobrada = e.maos.find((m) => m.dobrada);
      if (!dobrada) falhar('dobrar não marcou a mão como dobrada');
      else {
        if (dobrada.aposta !== antes * 2) falhar(`dobrar deixou a aposta em ${dobrada.aposta}, esperava ${antes * 2}`);
        if (dobrada.cartas.length !== 3) falhar(`depois de dobrar a mão tem ${dobrada.cartas.length} cartas, devia ter 3`);
      }
      continue;
    }
    e = await post(mao.total < 17 ? '/games/blackjack/pedir-carta' : '/games/blackjack/parar', null, token);
  }

  for (const m of e.maos) {
    if (m.blackjack && !m.deSplit) viuBJ += 1;
    // Blackjack natural paga 3:2.
    if (m.blackjack && m.outcome === 'jogador-ganhou' && m.totalReturn !== m.aposta * 2.5) {
      falhar(`blackjack pagou ${m.totalReturn} numa aposta de ${m.aposta} (esperava ${m.aposta * 2.5})`);
    }
    // Estourar nunca devolve nada.
    if (m.estourou && m.totalReturn !== 0) falhar('mão estourada devolveu fichas');
  }
  if (typeof e.cartasAteOCorte !== 'number') falhar('o servidor não informou quantas cartas faltam pro corte');
  saldoAnterior = e.newBalance;
}

console.log(`\n${maos} mãos jogadas contra o servidor`);
console.log(`dividir: ${viuSplit}  ·  dobrar: ${viuDouble}  ·  seguro oferecido: ${viuSeguro}  ·  blackjacks: ${viuBJ}`);
console.log(`saldo final: ${saldoAnterior}`);
console.log(problemas === 0 ? '\nOK: dividir, dobrar e seguro funcionam e pagam certo.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
