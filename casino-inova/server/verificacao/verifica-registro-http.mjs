/**
 * PROVA QUE O REGISTRO ESCREVE O QUE PRECISA, NUM SERVIDOR DE VERDADE.
 *
 * A verificação de unidade (`npm run verify:registro`) prova que a linha sai certa e que
 * segredo não vaza. O que ela NÃO consegue provar é o que só existe com um servidor no ar:
 *
 *   - que a recusa do guard vira linha. Esta foi a falha de verdade: com só um
 *     interceptor, o 401 do `AuthGuard` era lançado ANTES do interceptor existir, e cem
 *     tentativas com token inválido não deixavam UMA linha. Justamente as que mais
 *     importam, que são a assinatura de alguém tentando entrar numa conta alheia.
 *   - que o `X-Pedido` da resposta é o mesmo `pedido` da linha — senão o número que a
 *     pessoa manda no print não acha nada.
 *   - que o número da rodada aparece na linha de um giro, ligando a reclamação às tabelas
 *     do P0.2.
 *   - que um token mandado no cabeçalho não aparece na saída.
 *
 * Ela sobe o próprio servidor, numa porta separada, e lê a saída dele. Não precisa de
 * servidor no ar de antemão.
 */
import { spawn } from 'node:child_process';
import { setTimeout as espera } from 'node:timers/promises';

const PORTA = 3199;
const BASE = `http://127.0.0.1:${PORTA}`;
const BANCO = process.env.TEST_DATABASE_URL
  ?? process.env.DATABASE_URL
  ?? 'postgres://postgres@localhost:5432/casino_inova_test';

const TOKEN_FALSO = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWxzbyJ9.NAO_PODE_APARECER_NO_REGISTRO';

let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`  FALHOU  ${m}`); };
const ok = (m) => console.log(`  ok   ${m}`);

const saida = [];
const servidor = spawn('npx', ['ts-node', 'src/main.ts'], {
  env: { ...process.env, PORT: String(PORTA), DATABASE_URL: BANCO, JWT_SECRET: process.env.JWT_SECRET ?? 'verificacao-do-registro' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
servidor.stdout.on('data', (d) => saida.push(String(d)));
servidor.stderr.on('data', (d) => saida.push(String(d)));

/** As linhas de registro (JSON) que o servidor escreveu até agora. */
const linhas = () => saida.join('').split('\n')
  .filter((l) => l.startsWith('{'))
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter(Boolean);

/** Espera o servidor responder, em vez de dormir um tempo chutado. */
async function esperarSubir(ateMs = 90000) {
  const limite = Date.now() + ateMs;
  while (Date.now() < limite) {
    if (servidor.exitCode !== null) throw new Error(`o servidor morreu na subida:\n${saida.join('').slice(-1500)}`);
    try {
      const r = await fetch(`${BASE}/lobby/jogos`);
      if (r.ok) return;
    } catch { /* ainda não subiu */ }
    await espera(500);
  }
  throw new Error(`o servidor não subiu em ${ateMs} ms:\n${saida.join('').slice(-1500)}`);
}

try {
  console.log('\nO REGISTRO, NUM SERVIDOR DE VERDADE\n');
  await esperarSubir();

  // --- 1. O X-Pedido da resposta é o mesmo pedido da linha ---
  {
    const r = await fetch(`${BASE}/lobby/jogos`);
    const numero = r.headers.get('x-pedido');
    await espera(250);
    if (!numero) falhar('a resposta não trouxe o cabeçalho X-Pedido');
    else if (!linhas().some((l) => l.pedido === numero)) {
      falhar(`o X-Pedido "${numero}" não aparece em nenhuma linha — o número do print não acharia nada`);
    } else ok(`o X-Pedido da resposta acha a linha (${numero})`);
  }

  // --- 2. A recusa do guard vira linha. Era isto que faltava. ---
  {
    const antes = linhas().length;
    const r = await fetch(`${BASE}/wallet/saldo`);
    await espera(250);
    const novas = linhas().slice(antes);
    const recusa = novas.find((l) => l.status === 401);
    if (r.status !== 401) falhar(`esperava 401 sem token, veio ${r.status}`);
    else if (!recusa) falhar('um 401 do guard NÃO deixou linha nenhuma — a falha que esta verificação existe pra pegar');
    else if (recusa.nivel !== 'aviso') falhar(`o 401 saiu como "${recusa.nivel}", devia ser "aviso" (4xx é do pedido, não nosso)`);
    else ok('a recusa do guard vira linha, com nível de aviso');
  }

  // --- 3. Token no cabeçalho não vaza ---
  {
    await fetch(`${BASE}/wallet/saldo`, { headers: { authorization: `Bearer ${TOKEN_FALSO}` } });
    await espera(250);
    if (saida.join('').includes('NAO_PODE_APARECER_NO_REGISTRO')) {
      falhar('o token mandado no cabeçalho VAZOU para a saída');
    } else ok('token mandado no cabeçalho não aparece na saída');
  }

  // --- 4. Um giro deixa linha com jogo e rodada ---
  {
    const conta = await fetch(`${BASE}/auth/cadastrar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `registro-${Date.now()}@teste.local`, senha: 'senha-de-teste-123',
        nome: 'Auditor do Registro', nomeCompleto: 'Conta De Vistoria',
        nascimento: '1990-01-01', aceitouTermos: true,
      }),
    }).then((r) => r.json());
    const token = conta.token ?? conta.accessToken;
    if (!token) { falhar(`não consegui criar conta: ${JSON.stringify(conta).slice(0, 200)}`); }
    else {
      const antes = linhas().length;
      const giro = await fetch(`${BASE}/games/slots/girar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ bet: 100 }),
      });
      await espera(400);
      const novas = linhas().slice(antes);

      if (!giro.ok) falhar(`o giro falhou: ${giro.status}`);

      const daRodada = novas.filter((l) => l.rodada);
      if (daRodada.length === 0) {
        falhar('nenhuma linha do giro carrega o número da rodada — a reclamação não liga nas tabelas do P0.2');
      } else ok(`${daRodada.length} linhas do giro carregam a rodada (${daRodada[0].rodada})`);

      const liquidada = novas.find((l) => l.onde === 'rodada' && l.mensagem === 'liquidada');
      if (!liquidada) falhar('não saiu a linha "rodada liquidada"');
      else if (typeof liquidada.apostado !== 'number' || typeof liquidada.retorno !== 'number') {
        falhar('a linha de liquidação não traz apostado e retorno como número');
      } else ok(`a liquidação sai com apostado ${liquidada.apostado} e retorno ${liquidada.retorno}`);

      const doHttp = novas.find((l) => l.onde === 'http' && l.status === 201 || l.onde === 'http' && l.status === 200);
      if (doHttp && !doHttp.rodada) {
        falhar('a linha do HTTP não herdou a rodada aberta lá dentro');
      } else if (doHttp) ok('a linha do HTTP herda a rodada aberta no meio do pedido');

      const mesmoPedido = new Set(novas.filter((l) => l.pedido).map((l) => l.pedido));
      if (mesmoPedido.size > 1) falhar(`as linhas do giro ficaram em ${mesmoPedido.size} pedidos diferentes`);
      else if (mesmoPedido.size === 1) ok('todas as linhas do giro estão sob o mesmo número de pedido');
    }
  }

  // --- 5. Nenhuma linha traz e-mail, mesmo tendo passado um no cadastro ---
  {
    const tudo = JSON.stringify(linhas());
    if (/@teste\.local/.test(tudo)) falhar('um e-mail apareceu no registro');
    else ok('nenhum e-mail apareceu no registro');
  }

  console.log(problemas === 0 ? '\nTudo certo.\n' : `\n${problemas} problema(s).\n`);
} catch (erro) {
  problemas += 1;
  console.log(`\nERRO: ${erro.message}\n`);
} finally {
  servidor.kill('SIGTERM');
  await espera(300);
  if (servidor.exitCode === null) servidor.kill('SIGKILL');
}

process.exit(problemas === 0 ? 0 : 1);
