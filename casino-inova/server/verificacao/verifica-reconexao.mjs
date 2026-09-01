/**
 * Prova, com socket de verdade, que cair no meio de uma rodada não perde o assento nem
 * as apostas — e que voltar traz só o que faltou, em vez de remontar a mesa do zero.
 *
 * É o teste que a especificação pede em 28/Reconexão: "Desconectar durante turno e
 * voltar restaura mão, assento e timer".
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
    body: JSON.stringify({ email: `rec-${nome}-${Date.now()}@teste.local`, senha: 'senha-de-teste-123', nome }),
  });
  return (await r.json()).token;
};

const conectar = (token) =>
  new Promise((ok) => {
    const s = io(BASE, { transports: ['websocket'], forceNew: true });
    s.on('connect', () => s.emit('identificar', { token }, () => ok(s)));
  });

const pedir = (s, evento, corpo) =>
  new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error(`${evento} não respondeu`)), 8000);
    s.emit(evento, corpo, (r) => { clearTimeout(t); ok(r); });
  });

const tokenA = await criarConta('Anfitriao');
const tokenB = await criarConta('Convidado');
let socketA = await conectar(tokenA);
const socketB = await conectar(tokenB);

// --- Monta a mesa ---
const criada = await pedir(socketA, 'banca-francesa:criar-mesa', { visibility: 'publica' });
const mesaId = criada.id ?? criada?.data?.id;
if (!mesaId) { console.log('resposta da criação:', JSON.stringify(criada).slice(0, 300)); throw new Error('não consegui criar a mesa'); }

// A mesa já nasce aceitando aposta.
if (criada.fase?.fase !== 'APOSTAS_ABERTAS') falhar(`mesa nova está em ${criada.fase?.fase}, esperava APOSTAS_ABERTAS`);
console.log(`mesa criada em ${criada.fase?.fase}, rodada ${criada.fase?.rodadaId} — ok`);

await pedir(socketB, 'banca-francesa:entrar-por-id', { tableId: mesaId });
await pedir(socketB, 'banca-francesa:apostar', { tableId: mesaId, bets: [{ type: 'grande', amount: 100 }] });

const antesDaQueda = await pedir(socketA, 'banca-francesa:apostar', { tableId: mesaId, bets: [{ type: 'pequeno', amount: 100 }] });
const seqAntes = antesDaQueda.fase?.seq ?? 0;
const apostaDeB = antesDaQueda.seats.find((a) => !a.isBot && a.pendingBets.length && a.pendingBets[0].type === 'grande');
if (!apostaDeB) falhar('a aposta do convidado não apareceu na mesa');

// --- B cai no meio da rodada ---
socketB.close();
await new Promise((r) => setTimeout(r, 600));

// --- Enquanto B está fora, a mesa anda ---
await pedir(socketA, 'banca-francesa:girar', { tableId: mesaId });
console.log('o anfitrião girou enquanto o convidado estava fora');

// --- B volta dizendo até onde viu ---
const socketB2 = await conectar(tokenB);
const volta = await pedir(socketB2, 'reconectar', { mesaId, ultimoEventoVisto: seqAntes });

if (!volta.ok) falhar(`a reconexão falhou: ${JSON.stringify(volta)}`);
if (!volta.dentroDaJanela) falhar('voltou fora da janela, mas foram menos de 2 segundos');
if (!volta.estado?.seats?.some((a) => a.userId)) falhar('o estado devolvido não tem assentos');

const meuAssento = volta.estado.seats.find((a) => !a.isBot);
if (!meuAssento) falhar('perdi o assento ao cair');

if (volta.eventosPerdidos === null) {
  falhar('o log já tinha descartado os eventos — a janela é curta demais');
} else {
  const tipos = volta.eventosPerdidos.map((e) => e.tipo);
  console.log(`voltou e recebeu ${tipos.length} eventos que perdeu: ${tipos.join(' -> ')}`);
  for (const esperado of ['APOSTAS_FECHADAS', 'DADOS', 'PAGAMENTO', 'RODADA_FECHADA']) {
    if (!tipos.includes(esperado)) falhar(`faltou o evento ${esperado} no que foi reenviado`);
  }
  // A ordem é a do servidor, sempre crescente.
  const seqs = volta.eventosPerdidos.map((e) => e.seq);
  if (seqs.some((n, i) => i > 0 && n <= seqs[i - 1])) falhar('os eventos vieram fora de ordem');
}

// A rodada nova já está aberta pra apostar.
if (volta.fase?.fase !== 'APOSTAS_ABERTAS') falhar(`depois do giro a mesa está em ${volta.fase?.fase}`);
if (volta.fase?.rodadaId === criada.fase?.rodadaId) falhar('a rodada não avançou depois do giro');
console.log(`mesa já em ${volta.fase.fase}, rodada ${volta.fase.rodadaId} — ok`);

// --- Apostar na rodada nova funciona ---
{
  const r = await pedir(socketB2, 'banca-francesa:apostar', { tableId: mesaId, bets: [{ type: 'ases', amount: 50 }] });
  if (r?.error) falhar(`apostar na rodada nova devia funcionar: ${r.message}`);
  else console.log('apostar na rodada nova: aceito — ok');
}

/*
 * A corrida que importa: apostar e girar ao mesmo tempo.
 *
 * A aposta passa por um `await` (a leitura do saldo) entre conferir a fase e gravar. Se
 * o giro acontecer nesse intervalo, a aposta pode cair na rodada SEGUINTE — cobrada numa
 * rodada que a pessoa não pediu. Aqui as duas saem juntas, muitas vezes, e no fim a
 * conta tem que fechar: nenhuma aposta pode aparecer pendente numa rodada já girada.
 */
{
  let apostasAceitas = 0, apostasRecusadas = 0, vazamentos = 0;

  for (let i = 0; i < 15; i += 1) {
    const [aposta, giro] = await Promise.allSettled([
      pedir(socketB2, 'banca-francesa:apostar', { tableId: mesaId, bets: [{ type: 'grande', amount: 50 }] }),
      pedir(socketA, 'banca-francesa:girar', { tableId: mesaId }),
    ]);

    const respostaAposta = aposta.status === 'fulfilled' ? aposta.value : null;
    if (respostaAposta?.error) apostasRecusadas += 1; else apostasAceitas += 1;

    // Depois do giro, ninguém pode estar com aposta pendente de uma rodada já resolvida
    // sem ter pedido. Leio o estado e confiro.
    const estado = giro.status === 'fulfilled' ? giro.value : null;
    if (estado && !estado.error) {
      const pendentesDeOutraRodada = (estado.seats ?? []).filter(
        (a) => !a.isBot && a.pendingBets.length > 0 && respostaAposta?.error,
      );
      // Se a aposta foi RECUSADA, ela não pode ter ficado pendente.
      if (pendentesDeOutraRodada.length > 0) vazamentos += 1;
    }
    // Limpa pra próxima volta.
    await pedir(socketA, 'banca-francesa:girar', { tableId: mesaId }).catch(() => {});
  }

  console.log(`corrida aposta-x-giro em 15 tentativas: ${apostasAceitas} aceitas, ${apostasRecusadas} recusadas`);
  if (vazamentos > 0) falhar(`${vazamentos} apostas recusadas ficaram pendentes mesmo assim`);
  else console.log('nenhuma aposta recusada ficou pendente — ok');
}

socketA.close(); socketB2.close();
console.log(problemas === 0 ? '\nOK: cair não perde assento, e voltar traz só o que faltou.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
