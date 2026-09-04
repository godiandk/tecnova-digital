/**
 * O EXTRATO É UMA CORRENTE, E A CORRENTE NÃO PODE TER ELO SOLTO.
 *
 * Cada movimento grava o saldo de ANTES e o de DEPOIS na própria linha. Isso transforma
 * o extrato de uma lista de valores numa corrente que se confere sozinha:
 *
 *   1. `balance_before + amount = balance_after`, em toda linha.
 *   2. O `balance_after` de uma linha é o `balance_before` da seguinte.
 *   3. O `balance_after` da última linha é o saldo do jogador.
 *   4. Nenhum `balance_after` é negativo.
 *
 * POR QUE ISSO IMPORTA. Antes, o saldo era só a soma das entradas — e a soma de uma
 * lista à qual falta uma linha continua sendo uma soma válida. Um movimento perdido (por
 * gravação fora de transação, por corrida entre duas requisições, por apagamento) sumia
 * sem deixar marca. Na corrente, o mesmo sumiço quebra num ponto exato, que dá pra
 * apontar com id e valor.
 *
 * A parte que mais importa é a 5ª: DEZ MOVIMENTOS SIMULTÂNEOS do mesmo jogador. É aí que
 * a corrente quebraria se a trava não existisse — dois movimentos leriam o mesmo "antes"
 * e gravariam o mesmo "depois". Um `if` no meio do código não pega isso; só disparar
 * junto e conferir depois pega.
 */
import { DatabaseService } from '../../database/database.service';
import { WalletService } from './wallet.service';

let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

interface Linha {
  id: string;
  amount: string;
  balance_before: string | null;
  balance_after: string | null;
  type: string;
  round_id: string | null;
  action_id: string | null;
}

async function correnteDe(db: DatabaseService, userId: string): Promise<Linha[]> {
  return db.query<Linha>(
    `SELECT id, amount, balance_before, balance_after, type, round_id, action_id
       FROM ledger_entries WHERE user_id = $1 ORDER BY id`,
    [userId],
  );
}

/** Confere os quatro elos e devolve o que quebrou, se quebrou. */
function problemasDaCorrente(linhas: Linha[], saldoFinal: number): string[] {
  const problemas: string[] = [];
  let esperado = 0;
  for (const l of linhas) {
    const antes = Number(l.balance_before);
    const depois = Number(l.balance_after);
    const valor = Number(l.amount);
    if (l.balance_before === null || l.balance_after === null) {
      problemas.push(`linha ${l.id} sem saldo gravado`);
      continue;
    }
    if (antes + valor !== depois) {
      problemas.push(`linha ${l.id}: ${antes} + ${valor} deveria dar ${antes + valor}, gravou ${depois}`);
    }
    if (antes !== esperado) {
      problemas.push(`linha ${l.id}: o elo anterior terminou em ${esperado}, esta começa em ${antes}`);
    }
    if (depois < 0) problemas.push(`linha ${l.id}: saldo negativo (${depois})`);
    esperado = depois;
  }
  if (linhas.length > 0 && esperado !== saldoFinal) {
    problemas.push(`a corrente termina em ${esperado}, mas o saldo somado é ${saldoFinal}`);
  }
  return problemas;
}

async function principal() {
  const db = new DatabaseService();
  await db.onModuleInit();
  const wallet = new WalletService(db);

  const id = `teste-corrente-${Date.now()}`;
  await db.query(
    `INSERT INTO users (id, name, level, xp, vip_tier, role)
     VALUES ($1, 'Teste Corrente', 1, 0, 'bronze', 'jogador')`,
    [id],
  );

  try {
    console.log('--- 1. um movimento grava antes e depois ---');
    const c1 = await wallet.credit(id, 1000, 'presente', 'teste');
    confere('crédito de 1000 numa conta zerada: antes 0, depois 1000',
      c1.balanceBefore === 0 && c1.balanceAfter === 1000,
      `antes ${c1.balanceBefore}, depois ${c1.balanceAfter}`);

    const d1 = await wallet.debit(id, 250, 'aposta', 'jogo-de-teste', undefined, 'rodada-1');
    confere('débito de 250: antes 1000, depois 750',
      d1.balanceBefore === 1000 && d1.balanceAfter === 750,
      `antes ${d1.balanceBefore}, depois ${d1.balanceAfter}`);
    confere('o débito guardou a rodada', d1.roundId === 'rodada-1', String(d1.roundId));

    console.log('\n--- 2. aposta e prêmio da mesma rodada compartilham o identificador ---');
    await wallet.credit(id, 500, 'premio', 'jogo-de-teste', undefined, 'rodada-1');
    const daRodada = await db.query<{ n: string; soma: string }>(
      `SELECT COUNT(*)::text AS n, SUM(amount)::text AS soma
         FROM ledger_entries WHERE user_id = $1 AND round_id = 'rodada-1'`,
      [id],
    );
    confere('a rodada-1 tem dois movimentos somando +250',
      daRodada[0].n === '2' && daRodada[0].soma === '250',
      `${daRodada[0].n} movimentos, soma ${daRodada[0].soma}`);

    console.log('\n--- 3. a corrente fecha ---');
    let linhas = await correnteDe(db, id);
    let problemas = problemasDaCorrente(linhas, await wallet.balanceOf(id));
    confere(`${linhas.length} movimentos, corrente sem elo solto`, problemas.length === 0, problemas.join('; '));

    console.log('\n--- 4. saldo nunca fica negativo ---');
    let recusou = false;
    await wallet.debit(id, 999_999, 'aposta', 'jogo-de-teste').catch(() => { recusou = true; });
    confere('débito maior que o saldo é recusado', recusou);
    confere('e nada foi gravado', (await correnteDe(db, id)).length === linhas.length);

    console.log('\n--- 5. valor quebrado, NaN e infinito são recusados, não arredondados ---');
    for (const [nome, valor] of [
      ['NaN', NaN],
      ['infinito', Infinity],
      ['fração pequena', 0.4],
      ['fração no meio de um valor grande', 100.4],
      ['negativo', -5],
      ['zero', 0],
    ] as const) {
      let barrou = false;
      await wallet.credit(id, valor, 'ajuste', 'teste').catch(() => { barrou = true; });
      confere(`crédito de ${nome} recusado`, barrou);
    }

    console.log('\n--- 6. DEZ MOVIMENTOS SIMULTÂNEOS: é aqui que a corrente quebraria ---');
    const saldoAntes = await wallet.balanceOf(id);
    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) => wallet.credit(id, 100, 'presente', `corrida-c${i}`)),
      ...Array.from({ length: 5 }, (_, i) => wallet.debit(id, 40, 'aposta', `corrida-d${i}`)),
    ]);
    const saldoDepois = await wallet.balanceOf(id);
    confere('o saldo mexeu exatamente 5×100 − 5×40 = +300',
      saldoDepois - saldoAntes === 300, `mexeu ${saldoDepois - saldoAntes}`);

    linhas = await correnteDe(db, id);
    problemas = problemasDaCorrente(linhas, saldoDepois);
    confere(`a corrente continua fechando depois da corrida (${linhas.length} movimentos)`,
      problemas.length === 0, problemas.slice(0, 3).join('; '));

    console.log('\n--- 7. a mesma chave duas vezes move uma vez só ---');
    const antesDaRepetida = await wallet.balanceOf(id);
    const chave = `chave-${Date.now()}`;
    const [a, b] = await Promise.all([
      wallet.debit(id, 70, 'aposta', 'jogo-de-teste', chave),
      wallet.debit(id, 70, 'aposta', 'jogo-de-teste', chave),
    ]);
    confere('o saldo caiu 70 uma vez só', (await wallet.balanceOf(id)) === antesDaRepetida - 70);
    confere('e uma das duas veio marcada como repetida', Boolean(a.repetida) !== Boolean(b.repetida));
    confere('as duas apontam para a mesma linha', a.id === b.id, `${a.id} e ${b.id}`);

    console.log('\n--- 8. a corrente inteira, no fim de tudo ---');
    linhas = await correnteDe(db, id);
    problemas = problemasDaCorrente(linhas, await wallet.balanceOf(id));
    confere(`${linhas.length} movimentos e nenhum elo solto`, problemas.length === 0, problemas.slice(0, 3).join('; '));
  } finally {
    await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [id]);
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    await db.onModuleDestroy();
  }
}

principal()
  .then(() => {
    console.log(falhas === 0 ? '\nOK: o extrato é uma corrente, e ela fecha.' : `\n${falhas} FALHA(S)`);
    process.exit(falhas === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.log('ERRO:', e.message);
    process.exit(1);
  });
