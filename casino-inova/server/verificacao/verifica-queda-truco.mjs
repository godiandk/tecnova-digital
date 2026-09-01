/**
 * Prova que cair no meio de uma partida de truco não trava a mesa nem queima o buy-in
 * de ninguém.
 *
 * O que existia antes: os quatro pagam o buy-in na largada e o pote só é pago no fim.
 * Se alguém caísse na sua vez, a mesa ficava parada pra sempre — quatro buy-ins presos.
 * E se alguém SAÍSSE de propósito, a mesa era apagada sem pagar nada: uma pessoa
 * destruía o dinheiro de quatro.
 */
import { createRequire } from 'node:module';
const exigir = createRequire('/home/user/tecnova-digital/casino-inova/app/package.json');
const { io } = exigir('socket.io-client');

const BASE = 'http://localhost:3000';
let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`FALHOU: ${m}`); };

const criarConta = async (nome) => {
  const r = await fetch(`${BASE}/auth/cadastrar`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `tq-${nome}-${Date.now()}@teste.local`, senha: 'senha-de-teste-123', nome }),
  });
  const d = await r.json();
  return { token: d.token, userId: d.user.id };
};
const conectar = (token) => new Promise((ok) => {
  const s = io(BASE, { transports: ['websocket'], forceNew: true });
  s.on('connect', () => s.emit('identificar', { token }, () => ok(s)));
});
const pedir = (s, evento, corpo) => new Promise((ok, falha) => {
  const t = setTimeout(() => falha(new Error(`${evento} não respondeu`)), 8000);
  s.emit(evento, corpo, (r) => { clearTimeout(t); ok(r); });
});
const saldo = async (token) =>
  (await fetch(`${BASE}/wallet/saldo`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json())).balance;

const BUY_IN = 200;
const contas = await Promise.all(['A', 'B', 'C', 'D'].map((n) => criarConta(n)));
const sockets = await Promise.all(contas.map((c) => conectar(c.token)));
const saldosAntes = await Promise.all(contas.map((c) => saldo(c.token)));

// --- Monta a mesa de 4 ---
const criada = await pedir(sockets[0], 'truco:criar-mesa', { visibility: 'publica', buyIn: BUY_IN });
const mesaId = criada.id;
if (!mesaId) { console.log(JSON.stringify(criada).slice(0, 300)); throw new Error('não criou a mesa'); }
for (let i = 1; i < 4; i += 1) await pedir(sockets[i], 'truco:entrar-por-id', { tableId: mesaId });

const comecou = await pedir(sockets[0], 'truco:comecar', { tableId: mesaId });
if (comecou?.error) { console.log('erro ao começar:', comecou.message); throw new Error('não começou'); }
console.log(`mesa de 4 começou, buy-in ${BUY_IN} cada`);

const saldosDepoisDoBuyIn = await Promise.all(contas.map((c) => saldo(c.token)));
for (let i = 0; i < 4; i += 1) {
  if (saldosAntes[i] - saldosDepoisDoBuyIn[i] !== BUY_IN) {
    falhar(`jogador ${i} pagou ${saldosAntes[i] - saldosDepoisDoBuyIn[i]}, esperava ${BUY_IN}`);
  }
}
console.log('os quatro pagaram o buy-in — ok');

// --- Um cai no meio ---
// Cada socket acompanha o estado pelas atualizações que o servidor manda sozinho —
// é assim que o app de verdade funciona, e evita "ler" a mesa entrando nela de novo.
const visao = {};
sockets.forEach((s, i) => s.on('truco:mesa-atualizada', (v) => { visao[i] = v; }));
visao[0] = comecou;

sockets[2].close();
await new Promise((r) => setTimeout(r, 1200));
console.log('jogador C caiu');

// --- A partida tem que continuar até acabar ---
let voltas = 0;
let estado = visao[0] ?? comecou;
let travas = 0;

while (voltas < 400 && !estado?.finished) {
  voltas += 1;
  let agiu = false;

  for (const i of [0, 1, 3]) {
    const v = visao[i];
    if (!v || v.finished) continue;
    const meuAssento = v.seats?.find((a) => a.userId === contas[i].userId);
    if (!meuAssento || meuAssento.seatIndex !== v.turnSeat) continue;
    // A mão de cada um só vem pra ele: é o `hand` dentro do próprio assento.
    const minhaMao = meuAssento.hand ?? [];
    if (minhaMao.length === 0) continue;

    const r = await pedir(sockets[i], 'truco:jogar-carta', { tableId: mesaId, card: minhaMao[0] }).catch(() => null);
    if (r && !r.error) { visao[i] = r; estado = r; agiu = true; }
  }

  // O estado mais novo que qualquer um viu.
  for (const i of [0, 1, 3]) if (visao[i] && (!estado || visao[i].finished)) estado = visao[i];

  if (!agiu) {
    travas += 1;
    await new Promise((r) => setTimeout(r, 100));
    if (travas > 60) break;
  } else {
    travas = 0;
  }
}

if (!estado?.finished) {
  falhar(`a partida não terminou (${voltas} voltas, ${travas} sem ninguém poder agir) — travou com os buy-ins presos`);
} else {
  console.log(`partida terminou em ${voltas} voltas: dupla ${estado.winnerTeam} venceu (${estado.score?.A} x ${estado.score?.B})`);
}

// --- O dinheiro tem que ter saído do limbo ---
const saldosFinais = await Promise.all(contas.map((c) => saldo(c.token)));
const pote = BUY_IN * 4;
const totalPago = saldosFinais.reduce((s, v, i) => s + (v - saldosDepoisDoBuyIn[i]), 0);
console.log(`pote ${pote}, total creditado de volta ${totalPago}`);
if (estado?.finished && totalPago !== pote) {
  falhar(`o pote era ${pote} e só ${totalPago} voltou pra alguém — sobrou dinheiro no limbo`);
}

sockets.forEach((s) => s.close());

/*
 * Segunda partida: alguém SAI de propósito no meio.
 *
 * Este era o caso pior. `leaveTable` numa mesa começada apagava a mesa inteira, sem
 * pagar nem devolver nada — os quatro buy-ins já tinham sido debitados. Uma pessoa
 * saindo destruía o dinheiro de quatro.
 */
{
  const contas2 = await Promise.all(['E', 'F', 'G', 'H'].map((n) => criarConta(n)));
  const sk = await Promise.all(contas2.map((c) => conectar(c.token)));
  const antes = await Promise.all(contas2.map((c) => saldo(c.token)));

  const criada2 = await pedir(sk[0], 'truco:criar-mesa', { visibility: 'publica', buyIn: BUY_IN });
  for (let i = 1; i < 4; i += 1) await pedir(sk[i], 'truco:entrar-por-id', { tableId: criada2.id });
  const inicio = await pedir(sk[0], 'truco:comecar', { tableId: criada2.id });

  const v2 = { 0: inicio };
  sk.forEach((s, i) => s.on('truco:mesa-atualizada', (v) => { v2[i] = v; }));

  const saida = await pedir(sk[2], 'truco:sair', { tableId: criada2.id });
  if (saida?.removed) falhar('sair de uma partida começada ainda apaga a mesa inteira');
  else console.log('jogador G saiu de propósito e a mesa continuou — ok');

  let estado2 = v2[0] ?? inicio;
  let voltas2 = 0, travas2 = 0;
  while (voltas2 < 400 && !estado2?.finished) {
    voltas2 += 1;
    let agiu = false;
    for (const i of [0, 1, 3]) {
      const v = v2[i];
      if (!v || v.finished) continue;
      const meu = v.seats?.find((a) => a.userId === contas2[i].userId);
      if (!meu || meu.seatIndex !== v.turnSeat || !(meu.hand ?? []).length) continue;
      const r = await pedir(sk[i], 'truco:jogar-carta', { tableId: criada2.id, card: meu.hand[0] }).catch(() => null);
      if (r && !r.error) { v2[i] = r; estado2 = r; agiu = true; }
    }
    for (const i of [0, 1, 3]) if (v2[i]?.finished) estado2 = v2[i];
    if (!agiu) { travas2 += 1; await new Promise((r) => setTimeout(r, 100)); if (travas2 > 60) break; }
    else travas2 = 0;
  }

  if (!estado2?.finished) falhar('a partida não terminou depois de alguém sair');
  else console.log(`partida terminou: dupla ${estado2.winnerTeam} venceu (${estado2.score?.A} x ${estado2.score?.B})`);

  const finais = await Promise.all(contas2.map((c) => saldo(c.token)));
  const pagoDeVolta = finais.reduce((s, v, i) => s + (v - (antes[i] - BUY_IN)), 0);
  const times = ['A (assento 0)', 'B (assento 1)', 'A (assento 2, saiu)', 'B (assento 3)'];
  finais.forEach((v, i) => console.log(`   ${['E','F','G','H'][i]} ${times[i]}: antes ${antes[i]}, depois ${v}, voltou ${v - (antes[i] - BUY_IN)}`));
  console.log(`pote ${BUY_IN * 4}, total creditado de volta ${pagoDeVolta}`);
  if (estado2?.finished && pagoDeVolta !== BUY_IN * 4) {
    falhar(`saiu ${BUY_IN * 4} em buy-in e só ${pagoDeVolta} voltou — dinheiro sumiu`);
  }
  sk.forEach((s) => s.close());
}

console.log(problemas === 0 ? '\nOK: quem cai ou sai não trava a mesa nem queima o buy-in de ninguém.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
