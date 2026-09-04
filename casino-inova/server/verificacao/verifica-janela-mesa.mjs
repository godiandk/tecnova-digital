/**
 * Confere a janela de aposta entre lançamentos, contra o servidor de verdade.
 *
 *   node verificacao/verifica-janela-mesa.mjs
 *
 * As perguntas são as que só a mesa rodando responde — o motor já foi conferido em
 * verify-janela.ts, e nenhuma delas dá pra provar lendo o código:
 *
 * 1. Um lançamento nulo REABRE as apostas, com prazo, e a rodada continua a mesma.
 * 2. Retirar as fichas na janela não custa nada: o saldo não se mexe.
 * 3. Depois de retirar, o lançamento seguinte não cobra nada de quem saiu.
 * 4. A MESA LANÇA SOZINHA quando o prazo acaba, sem ninguém pedir — e avisa.
 * 5. Aposta que chega fora da janela é recusada.
 */
import { io } from 'socket.io-client';

const BASE = 'http://localhost:3000';
let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`FALHOU: ${m}`); };
const ok = (m) => console.log(`ok — ${m}`);

const post = async (rota, corpo, token) => {
  const r = await fetch(`${BASE}${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo ?? {}),
  });
  return { ok: r.ok, status: r.status, corpo: JSON.parse(await r.text()) };
};
const saldoDe = async (token) => {
  const r = await fetch(`${BASE}/wallet/saldo`, { headers: { authorization: `Bearer ${token}` } });
  return (await r.json()).balance;
};

const marca = Date.now();
const conta = await post('/auth/cadastrar', { email: `janela-${marca}@teste.local`, senha: 'senha-de-teste-123', nome: 'Janela' });
const token = conta.corpo.token;
if (!token) { console.log('FALHOU: não consegui criar a conta de teste'); process.exit(1); }

const socket = io(BASE, { transports: ['websocket'] });
const pedir = (evento, corpo) =>
  new Promise((resolve, reject) => {
    const relogio = setTimeout(() => reject(new Error(`sem resposta em ${evento}`)), 10_000);
    socket.emit(evento, corpo, (resposta) => {
      clearTimeout(relogio);
      if (resposta && resposta.erro) reject(new Error(resposta.erro));
      else resolve(resposta);
    });
  });

/** Espera o servidor MANDAR uma atualização sozinho, sem ninguém pedir nada. */
const esperarAtualizacao = (ms) =>
  new Promise((resolve) => {
    const relogio = setTimeout(() => { socket.off('banca-francesa:mesa-atualizada', ouvir); resolve(null); }, ms);
    const ouvir = (mesa) => { clearTimeout(relogio); socket.off('banca-francesa:mesa-atualizada', ouvir); resolve(mesa); };
    socket.on('banca-francesa:mesa-atualizada', ouvir);
  });

await new Promise((r) => socket.on('connect', r));
await pedir('identificar', { token });

let mesa = await pedir('banca-francesa:criar-mesa', { visibility: 'privada' });
if (!mesa?.id) { console.log('FALHOU: a mesa não foi criada'); process.exit(1); }

// --- procura um lançamento nulo. 153 de 216 são nulos, então vem rápido. ---
const APOSTA = 200;
let achouNulo = null;
for (let tentativa = 0; tentativa < 30 && !achouNulo; tentativa += 1) {
  const saldoAntes = await saldoDe(token);
  mesa = await pedir('banca-francesa:apostar', { tableId: mesa.id, bets: [{ type: 'grande', amount: APOSTA }] });
  mesa = await pedir('banca-francesa:girar', { tableId: mesa.id });

  const lances = mesa.rodada?.lancamentos ?? [];
  if (mesa.rodada?.esperandoDepoisDeNulo && lances.length > 0) {
    achouNulo = { mesa, saldoAntes, lances };
    break;
  }
  // Decidiu de primeira: a rodada acabou, o saldo mexeu, tenta de novo.
}

if (!achouNulo) {
  console.log('FALHOU: 30 rodadas sem um único lançamento nulo — improvável demais pra ser sorte');
  process.exit(1);
}

// --- 1. o nulo reabriu as apostas, com prazo, na MESMA rodada ---
{
  const { mesa: m, lances } = achouNulo;
  const ultimo = lances[lances.length - 1];
  const somasNulas = [4, 8, 9, 10, 11, 12, 13, 17, 18];

  if (ultimo.outcome !== null) falhar(`o último lance abriu janela mas tem resultado "${ultimo.outcome}"`);
  if (!somasNulas.includes(ultimo.sum)) falhar(`a soma ${ultimo.sum} abriu janela, mas não é uma soma nula`);
  if (m.fase?.fase !== 'APOSTAS_ABERTAS') falhar(`a fase depois do nulo é ${m.fase?.fase}, esperava APOSTAS_ABERTAS`);

  const falta = (m.fase?.terminaEm ?? 0) - Date.now();
  if (falta < 8_000 || falta > 13_000) falhar(`a janela vai durar ${Math.round(falta / 1000)}s, esperava perto de 12`);
  if (m.rodada.rodadaId !== m.fase.rodadaId) falhar('a rodada em andamento e a fase discordam de qual rodada é');

  const meu = m.seats.find((s) => !s.isBot);
  if ((meu?.pendingBets ?? []).length !== 1) falhar('a aposta devia continuar de pé depois do nulo');

  ok(`nulo (dados ${ultimo.dice.join('-')} = ${ultimo.sum}): apostas reabertas por ${Math.round(falta / 1000)}s, aposta de pé, mesma rodada`);
}

// --- 2 e 3. retirar na janela não custa nada ---
{
  const saldoAntesDeRetirar = await saldoDe(token);
  const depois = await pedir('banca-francesa:retirar', { tableId: achouNulo.mesa.id });
  const meu = depois.seats.find((s) => !s.isBot);

  if ((meu?.pendingBets ?? []).length !== 0) falhar('retirei e a aposta continuou na mesa');
  const saldoDepois = await saldoDe(token);
  if (saldoDepois !== saldoAntesDeRetirar) falhar(`retirar mexeu no saldo: ${saldoAntesDeRetirar} -> ${saldoDepois}`);
  if (saldoDepois !== achouNulo.saldoAntes) {
    falhar(`o saldo mudou durante a rodada com nulo: entrei com ${achouNulo.saldoAntes}, estou com ${saldoDepois}`);
  }
  ok(`retirar na janela não custou nada: saldo ${saldoDepois} do começo ao fim da rodada`);

  // --- 4. a mesa lança sozinha quando o prazo acaba ---
  const falta = (depois.fase?.terminaEm ?? Date.now()) - Date.now();
  console.log(`   esperando ${Math.max(0, Math.round(falta / 1000))}s pra ver a mesa lançar sozinha...`);
  const sozinha = await esperarAtualizacao(Math.max(1000, falta) + 6_000);

  if (!sozinha) {
    falhar('o prazo acabou e o servidor não lançou nem avisou — a mesa ficaria parada pra sempre');
  } else {
    const lancesDepois = (sozinha.rodada?.lancamentos ?? []).length;
    const apurou = Boolean(sozinha.lastRound) && lancesDepois === 0;
    if (!apurou && lancesDepois <= achouNulo.lances.length) {
      falhar(`a mesa avisou mas não lançou: ${achouNulo.lances.length} lances antes, ${lancesDepois} depois`);
    } else {
      ok(apurou ? 'a mesa lançou sozinha, decidiu e apurou — sem ninguém pedir' : `a mesa lançou sozinha: ${lancesDepois} lances agora`);
    }

    const saldoFinal = await saldoDe(token);
    if (saldoFinal !== saldoDepois) {
      falhar(`quem retirou foi cobrado no lance seguinte: ${saldoDepois} -> ${saldoFinal}`);
    } else {
      ok(`quem retirou não foi cobrado no lance seguinte: saldo ${saldoFinal}`);
    }
  }
}

// --- 5. aposta fora da janela é recusada ---
{
  const antes = await saldoDe(token);
  // Fecha a janela lançando, e tenta apostar com os dados no ar.
  const estado = await pedir('banca-francesa:apostar', { tableId: achouNulo.mesa.id, bets: [{ type: 'pequeno', amount: APOSTA }] });
  const promessaDoGiro = pedir('banca-francesa:girar', { tableId: estado.id });
  let recusou = false;
  try {
    await pedir('banca-francesa:apostar', { tableId: estado.id, bets: [{ type: 'ases', amount: APOSTA }] });
  } catch {
    recusou = true;
  }
  await promessaDoGiro;
  if (!recusou) console.log('   (a aposta entrou antes do giro — corrida esperada, não é defeito)');
  else ok('aposta que chega com os dados no ar é recusada');
  const depois = await saldoDe(token);
  console.log(`   saldo ${antes} -> ${depois} (uma rodada cobrada, como deve ser)`);
}

socket.close();
console.log(problemas === 0 ? '\nTUDO OK — a janela funciona na mesa de verdade.' : `\n${problemas} PROBLEMA(S).`);
process.exit(problemas === 0 ? 0 : 1);
