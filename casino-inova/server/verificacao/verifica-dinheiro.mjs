/**
 * VISTORIA DO DINHEIRO — a aposta sai, o prêmio entra, e sem saldo não se joga.
 *
 *   node verificacao/verifica-dinheiro.mjs
 *
 * É a conferência que mais importa deste projeto. Um erro em qualquer jogo aqui é ficha
 * que some do bolso de alguém ou ficha que nasce do nada — e o saldo é a única coisa que
 * a pessoa confere de olho.
 *
 * O que é medido, jogo a jogo, contra o servidor de verdade:
 *
 * 1. O SALDO DEPOIS BATE COM A CONTA. saldo_final = saldo_inicial − apostado + recebido,
 *    exatamente, sem sobra nem falta de uma ficha.
 * 2. O EXTRATO FECHA COM O SALDO. O saldo é a SOMA dos lançamentos; se os dois
 *    discordarem, um dos dois está mentindo.
 * 3. SEM SALDO NÃO SE JOGA. Conta zerada tem toda aposta recusada, e o saldo continua
 *    zero — não vai a negativo, não "fica devendo".
 * 4. APOSTA ABAIXO DO MÍNIMO É RECUSADA, e sem tirar ficha nenhuma.
 * 5. A MESMA AÇÃO REPETIDA COBRA UMA VEZ SÓ. Rede ruim manda o mesmo pedido duas vezes;
 *    isso não pode virar duas rodadas.
 */
const BASE = 'http://localhost:3000';
let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`   FALHOU: ${m}`); };
const ok = (m) => console.log(`   ok — ${m}`);

const chamar = async (rota, { metodo = 'GET', corpo, token } = {}) => {
  const r = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { ok: r.ok, status: r.status, corpo: json };
};

const marca = Date.now();
const novaConta = async (etiqueta) => {
  const r = await chamar('/auth/cadastrar', {
    metodo: 'POST',
    corpo: {
      email: `dinheiro-${etiqueta}-${marca}@teste.local`,
      senha: 'senha-de-teste-123',
      nome: etiqueta.slice(0, 20),
      nomeCompleto: 'Conta De Vistoria',
      nascimento: '1990-01-01',
      aceitouTermos: true,
    },
  });
  if (!r.ok) throw new Error(`não deu pra criar conta: ${JSON.stringify(r.corpo)}`);
  return r.corpo.token;
};

const saldo = async (token) => (await chamar('/wallet/saldo', { token })).corpo.balance;
const extrato = async (token) => (await chamar('/wallet/historico', { token })).corpo;
const meuNivel = async (token) => (await chamar('/niveis/meu', { token })).corpo;

/** Os jogos que resolvem tudo numa chamada só, e como se aposta em cada um. */
const JOGOS = [
  { nome: 'Slots', rota: '/games/slots/girar', monta: (v, id) => ({ bet: v, actionId: id }) },
  { nome: 'Roleta', rota: '/games/roleta/girar', monta: (v, id) => ({ bet: { type: 'vermelho' }, amount: v, actionId: id }) },
  { nome: 'Bacará', rota: '/games/bacara/apostar', monta: (v, id) => ({ betType: 'jogador', amount: v, actionId: id }) },
  { nome: 'Bac Bo', rota: '/games/bac-bo/apostar', monta: (v, id) => ({ bets: [{ type: 'jogador', amount: v }], actionId: id }) },
  { nome: 'Banca Francesa', rota: '/games/banca-francesa/apostar', monta: (v, id) => ({ bets: [{ type: 'grande', amount: v }], actionId: id }) },
  { nome: 'Stock Market', rota: '/games/stock-market/apostar', monta: (v, id) => ({ direction: 'alta', amount: v, actionId: id }) },
];

/**
 * Quanto voltou pro jogador, seja qual for o nome do campo naquele jogo.
 *
 * Cada motor batizou o seu: slots devolve `totalWin`, os outros `totalReturn`. Ler só um
 * nome fez este próprio script acusar o slots de erro — ele lia zero onde tinha prêmio.
 * Aqui a única fonte confiável é o SALDO, e o campo serve pra conferir se o jogo conta a
 * mesma história que a carteira.
 */
const quantoVoltou = (resposta) =>
  resposta.totalReturn ?? resposta.totalWin ?? resposta.payout ?? 0;

// ─────────────────────────────────────────────────────────────
console.log('\n=== 1. A conta do saldo fecha em cada jogo? ===');
for (const jogo of JOGOS) {
  console.log(`\n${jogo.nome}`);
  const token = await novaConta(jogo.nome.replace(/\W/g, ''));
  const nivel = await meuNivel(token);
  const valor = nivel.nivel.minimo;

  let erradas = 0;
  let rodadas = 0;
  let apostadoTotal = 0;
  let recebidoTotal = 0;

  for (let i = 0; i < 12; i += 1) {
    const antes = await saldo(token);
    if (antes < valor) break;

    const r = await chamar(jogo.rota, { metodo: 'POST', token, corpo: jogo.monta(valor, `vist-${marca}-${jogo.nome}-${i}`) });
    if (!r.ok) { falhar(`rodada recusada: ${JSON.stringify(r.corpo).slice(0, 120)}`); break; }

    const depois = await saldo(token);
    const recebido = quantoVoltou(r.corpo);
    const esperado = antes - valor + recebido;

    rodadas += 1;
    apostadoTotal += valor;
    recebidoTotal += recebido;
    if (depois !== esperado) {
      erradas += 1;
      if (erradas <= 2) falhar(`rodada ${i}: saldo ${antes} − ${valor} + ${recebido} devia dar ${esperado}, deu ${depois}`);
    }
    // O servidor também devolve o saldo novo: os dois têm que concordar.
    if (r.corpo.newBalance !== undefined && r.corpo.newBalance !== depois) {
      falhar(`o jogo disse saldo ${r.corpo.newBalance} e a carteira diz ${depois}`);
    }
  }

  if (rodadas === 0) { falhar('nenhuma rodada aconteceu'); continue; }
  if (erradas === 0) ok(`${rodadas} rodadas, apostou ${apostadoTotal.toLocaleString('pt-BR')}, recebeu ${recebidoTotal.toLocaleString('pt-BR')} — a conta fecha em todas`);

  // --- o extrato tem que somar exatamente o saldo ---
  const linhas = await extrato(token);
  const somaDoExtrato = (Array.isArray(linhas) ? linhas : []).reduce((s, l) => s + Number(l.amount ?? 0), 0);
  const saldoAgora = await saldo(token);
  if (!Array.isArray(linhas)) falhar('não consegui ler o extrato');
  else if (somaDoExtrato !== saldoAgora) falhar(`o extrato soma ${somaDoExtrato} e o saldo é ${saldoAgora}`);
  else ok(`o extrato (${linhas.length} lançamentos) soma exatamente o saldo`);
}

// ─────────────────────────────────────────────────────────────
console.log('\n=== 2. Sem saldo, ninguém joga ===');
{
  const token = await novaConta('zerado');
  const nivel = await meuNivel(token);
  /*
   * Torra a banca apostando TUDO a cada rodada. Sem teto de mesa isso é permitido — e é
   * justamente o caminho mais rápido pra chegar ao zero, que é o estado que interessa
   * conferir aqui.
   */
  for (let i = 0; i < 200; i += 1) {
    const atual = await saldo(token);
    if (atual < nivel.nivel.minimo) break;
    await chamar('/games/slots/girar', { metodo: 'POST', token, corpo: { bet: atual, actionId: `torra-${marca}-${i}` } });
  }
  const restou = await saldo(token);
  console.log(`   restou ${restou} fichas`);

  const tentativa = await chamar('/games/slots/girar', { metodo: 'POST', token, corpo: { bet: nivel.nivel.minimo, actionId: `semsaldo-${marca}` } });
  const depois = await saldo(token);
  if (tentativa.ok && restou < nivel.nivel.minimo) falhar('deixou apostar sem ter o saldo');
  else if (restou < nivel.nivel.minimo) ok(`aposta sem saldo recusada: "${tentativa.corpo.message}"`);
  if (depois < 0) falhar(`o saldo ficou NEGATIVO: ${depois}`);
  else ok(`o saldo nunca fica negativo (está em ${depois})`);
}

// ─────────────────────────────────────────────────────────────
console.log('\n=== 3. Abaixo do mínimo é recusado, e sem custar nada ===');
{
  const token = await novaConta('minimo');
  const nivel = await meuNivel(token);
  const antes = await saldo(token);
  const r = await chamar('/games/slots/girar', { metodo: 'POST', token, corpo: { bet: Math.max(1, nivel.nivel.minimo - 1), actionId: `abaixo-${marca}` } });
  const depois = await saldo(token);
  if (r.ok) falhar(`aceitou aposta de ${nivel.nivel.minimo - 1} com mínimo de ${nivel.nivel.minimo}`);
  else ok(`abaixo do mínimo recusado: "${r.corpo.message}"`);
  if (depois !== antes) falhar(`a recusa mexeu no saldo: ${antes} -> ${depois}`);
  else ok('a recusa não tirou ficha nenhuma');

  // E acima do saldo também é recusado (o teto agora é o bolso, não a mesa).
  const acima = await chamar('/games/slots/girar', { metodo: 'POST', token, corpo: { bet: antes + 1, actionId: `acima-${marca}` } });
  if (acima.ok) falhar('deixou apostar mais do que tem no saldo');
  else ok(`acima do saldo recusado: "${acima.corpo.message}"`);
}

// ─────────────────────────────────────────────────────────────
console.log('\n=== 4. O mesmo pedido duas vezes cobra uma vez só ===');
{
  const token = await novaConta('repetido');
  const nivel = await meuNivel(token);
  const antes = await saldo(token);
  const acao = `repetido-${marca}`;
  const corpo = { bet: nivel.nivel.minimo, actionId: acao };

  const [a, b] = await Promise.all([
    chamar('/games/slots/girar', { metodo: 'POST', token, corpo }),
    chamar('/games/slots/girar', { metodo: 'POST', token, corpo }),
  ]);
  const depois = await saldo(token);
  const recebido = a.corpo.totalReturn ?? 0;
  const esperado = antes - nivel.nivel.minimo + recebido;

  if (depois !== esperado) falhar(`dois pedidos iguais cobraram: ${antes} -> ${depois}, esperava ${esperado}`);
  else ok(`dois pedidos iguais viraram uma rodada só (saldo ${antes} -> ${depois})`);
  if (JSON.stringify(a.corpo.reels ?? a.corpo) !== JSON.stringify(b.corpo.reels ?? b.corpo)) {
    console.log('   (as duas respostas diferem no formato, mas a cobrança foi única)');
  }
}

console.log(problemas === 0 ? '\nTUDO OK — o dinheiro entra e sai certo em todos os jogos.' : `\n${problemas} PROBLEMA(S).`);
process.exit(problemas === 0 ? 0 : 1);
