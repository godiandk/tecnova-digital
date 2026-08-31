import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { WalletService } from './wallet.service';
import { DatabaseService } from '../../database/database.service';

/**
 * O teste que a especificação pede em 28/Economia: "100 requisições duplicadas com o
 * mesmo actionId debitam uma vez".
 *
 * Por que isso importa fora do papel: sem chave de idempotência, um toque duplo no botão
 * de apostar, ou um retry do app depois de um timeout de rede (em que a primeira
 * requisição CHEGOU e a resposta é que se perdeu), debita duas vezes. O jogador perde
 * fichas por uma aposta que fez uma vez só, e do lado do servidor nada parece errado —
 * são dois débitos válidos.
 *
 *   DATABASE_URL=... npx ts-node src/modules/wallet/verify-idempotencia.ts
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const wallet = app.get(WalletService);
  const db = app.get(DatabaseService);

  let problemas = 0;
  const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

  const userId = `teste-idem-${Date.now()}`;
  await db.query('INSERT INTO users (id, name) VALUES ($1, $2)', [userId, 'Teste Idempotência']);
  await wallet.credit(userId, 100_000, 'ajuste', 'teste');
  const saldoInicial = await wallet.balanceOf(userId);

  // --- 1. Cem débitos simultâneos com a MESMA chave: um só pode valer ---
  {
    const chave = `aposta-${Date.now()}`;
    const resultados = await Promise.allSettled(
      Array.from({ length: 100 }, () => wallet.debit(userId, 500, 'aposta', 'blackjack', chave)),
    );
    const ok = resultados.filter((r) => r.status === 'fulfilled');
    if (ok.length !== 100) falhar(`${100 - ok.length} chamadas falharam; todas deviam responder`);

    const novas = ok.filter((r: any) => !r.value.repetida).length;
    if (novas !== 1) falhar(`${novas} débitos foram criados; devia ser exatamente 1`);

    // Todas têm que apontar pra MESMA linha do ledger.
    const ids = new Set(ok.map((r: any) => r.value.id));
    if (ids.size !== 1) falhar(`as respostas apontam pra ${ids.size} lançamentos diferentes`);

    const saldo = await wallet.balanceOf(userId);
    if (saldo !== saldoInicial - 500) falhar(`o saldo caiu ${saldoInicial - saldo}, devia ter caído 500`);
    console.log(`100 débitos simultâneos com a mesma chave: 1 lançamento criado, saldo -500 — ok`);
  }

  // --- 2. Chaves diferentes debitam cada uma a sua vez ---
  {
    const antes = await wallet.balanceOf(userId);
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => wallet.debit(userId, 100, 'aposta', 'roleta', `chave-diferente-${i}`)),
    );
    const depois = await wallet.balanceOf(userId);
    if (antes - depois !== 1000) falhar(`10 apostas de 100 tiraram ${antes - depois}, deviam tirar 1000`);
    console.log('10 chaves diferentes: 10 débitos, como tem que ser — ok');
  }

  // --- 3. Sem chave, cada chamada é uma aposta nova (o comportamento de antes) ---
  {
    const antes = await wallet.balanceOf(userId);
    await Promise.all(Array.from({ length: 5 }, () => wallet.debit(userId, 100, 'aposta', 'slots')));
    const depois = await wallet.balanceOf(userId);
    if (antes - depois !== 500) falhar(`5 apostas sem chave tiraram ${antes - depois}, deviam tirar 500`);
    console.log('5 chamadas sem chave: 5 débitos — ok (quem não manda chave aceita o risco)');
  }

  // --- 4. Crédito repetido também não paga duas vezes ---
  {
    const antes = await wallet.balanceOf(userId);
    const chave = `premio-${Date.now()}`;
    const resultados = await Promise.all(
      Array.from({ length: 50 }, () => wallet.credit(userId, 700, 'premio', 'blackjack', chave)),
    );
    const novos = resultados.filter((r) => !r.repetida).length;
    if (novos !== 1) falhar(`${novos} créditos criados; devia ser 1`);
    const depois = await wallet.balanceOf(userId);
    if (depois - antes !== 700) falhar(`50 prêmios com a mesma chave creditaram ${depois - antes}, devia ser 700`);
    console.log('50 créditos simultâneos com a mesma chave: pagou 700 uma vez só — ok');
  }

  // --- 5. A chave é POR JOGADOR: a mesma chave de outra pessoa não colide ---
  {
    const outro = `teste-idem-b-${Date.now()}`;
    await db.query('INSERT INTO users (id, name) VALUES ($1, $2)', [outro, 'Teste Idempotência B']);
    await wallet.credit(outro, 5_000, 'ajuste', 'teste');
    const chave = 'chave-compartilhada';
    await wallet.debit(userId, 300, 'aposta', 'bacara', chave);
    const doOutro = await wallet.debit(outro, 300, 'aposta', 'bacara', chave);
    if (doOutro.repetida) falhar('a chave de um jogador bloqueou a de outro');
    if (await wallet.balanceOf(outro) !== 4_700) falhar('o débito do segundo jogador não aconteceu');
    console.log('mesma chave em jogadores diferentes: cada um debitou o seu — ok');
    await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [outro]);
    await db.query('DELETE FROM users WHERE id = $1', [outro]);
  }

  // --- 6. Saldo insuficiente continua recusando, com chave ou sem ---
  {
    const saldo = await wallet.balanceOf(userId);
    let recusou = false;
    try {
      await wallet.debit(userId, saldo + 1, 'aposta', 'poker', `alem-do-saldo-${Date.now()}`);
    } catch {
      recusou = true;
    }
    if (!recusou) falhar('deixou apostar mais fichas do que o jogador tem');
    console.log('aposta maior que o saldo: recusada — ok');
  }

  await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
  await app.close();

  console.log(problemas === 0 ? '\nOK: a mesma ação nunca debita nem credita duas vezes.' : `\n${problemas} problema(s).`);
  process.exit(problemas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error('ERRO:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
