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
    body: JSON.stringify({ email: `rec-${nome}-${Date.now()}@teste.local`, senha: 'senha-de-teste-123', nome, nomeCompleto: 'Conta De Vistoria', nascimento: '1990-01-01', aceitouTermos: true }),
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

/*
 * B CAI, A MESA ANDA UM LANÇAMENTO, B VOLTA. E de novo, até a rodada decidir.
 *
 * A versão anterior derrubava B, girava UMA vez e esperava ver PAGAMENTO no que foi
 * reenviado. Só que 153 das 216 combinações de três dados são NULAS — 70,8% —, e o nulo
 * não paga nem fecha a rodada: a conferência reprovava em sete de cada dez execuções,
 * sem nada estar quebrado. Uma conferência que falha sete vezes em dez é pior que uma
 * que falha sempre, porque ensina a ignorar o vermelho.
 *
 * Girar em laço com B fora também não serve: entre um lançamento e outro a mesa REABRE
 * as apostas por alguns segundos, e B ficaria fora tempo demais pra janela de reconexão
 * — que é curta de propósito. Então o ciclo é este: derruba, gira uma vez, volta,
 * confere. Se o lançamento foi nulo, repete. Isso testa a reconexão VÁRIAS vezes, que é
 * melhor do que testá-la uma, e o que se afirma no fim é sobre o ciclo em que a rodada
 * de fato decidiu.
 */
let socketB2 = socketB;
let volta = null;
let decidiu = false;

/* A rodada em que estamos, pra saber quando ela troca. Começa na que a mesa nasceu. */
let rodadaAnterior = criada.fase?.rodadaId;
let seqDoCiclo = seqAntes;

for (let ciclo = 0; ciclo < 12 && !decidiu; ciclo += 1) {
  socketB2.close();
  await new Promise((r) => setTimeout(r, 300));

  const giro = await pedir(socketA, 'banca-francesa:girar', { tableId: mesaId });
  const lancamentos = giro?.rodada?.lancamentos ?? [];
  const ultimo = lancamentos[lancamentos.length - 1];
  /*
   * Decidiu quando o último lançamento tem resultado OU quando a rodada trocou de id —
   * porque uma rodada que decide é liquidada e a mesa já abre a seguinte, e aí a lista
   * de lançamentos que volta é a da rodada NOVA, vazia.
   */
  decidiu = Boolean(ultimo && ultimo.outcome !== null) || giro?.rodada?.rodadaId !== rodadaAnterior;
  rodadaAnterior = giro?.rodada?.rodadaId;

  socketB2 = await conectar(tokenB);
  volta = await pedir(socketB2, 'reconectar', { mesaId, ultimoEventoVisto: seqDoCiclo });
  if (!volta.ok) falhar(`a reconexão falhou: ${JSON.stringify(volta)}`);
  if (!volta.dentroDaJanela) falhar('voltou fora da janela, mas foi menos de um segundo');

  if (!decidiu) {
    /* O próximo ciclo parte de onde este parou; senão o reenvio traria tudo de novo. */
    seqDoCiclo = volta?.estado?.fase?.seq ?? giro?.fase?.seq ?? seqDoCiclo;
    /* Deixa a próxima janela de apostas abrir antes de tentar de novo. */
    const esperaAte = giro?.fase?.terminaEm ?? 0;
    await new Promise((r) => setTimeout(r, Math.max(250, esperaAte - Date.now() + 200)));
  }
}
if (!decidiu) falhar('doze lançamentos sem decidir — improvável demais pra ser acaso');
console.log('a mesa andou e o convidado voltou a cada lançamento');


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
