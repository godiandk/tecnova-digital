/**
 * Prova as duas coisas que a persistência precisa entregar — e que a versão em
 * memória não entregava:
 *
 * 1. O saldo sobrevive ao servidor reiniciar. Era o problema número um do projeto:
 *    num jogo onde a pessoa PAGA pelas fichas, perder o saldo de todo mundo num
 *    deploy é o pior tipo de falha que existe.
 *
 * 2. Duas apostas simultâneas do mesmo jogador não conseguem gastar a mesma ficha
 *    duas vezes. Enquanto tudo vivia num processo só, ler o saldo e gravar o débito
 *    era instantâneo e ninguém passava no meio. Com banco de verdade e requisições
 *    concorrentes, passa — a não ser que o débito seja atômico, que é o que o
 *    SELECT ... FOR UPDATE do WalletService garante.
 */
import { DatabaseService } from './database.service';
import { WalletService } from '../modules/wallet/wallet.service';
import { UsersService } from '../modules/users/users.service';

let falhas = 0;

function checa(nome: string, condicao: boolean, detalhe = '') {
  if (condicao) {
    console.log(`OK   ${nome}`);
  } else {
    falhas += 1;
    console.log(`FALHA ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  }
}

/** Cada "processo" é um DatabaseService novo — é o que um restart produz. */
async function novoProcesso() {
  const db = new DatabaseService();
  await db.onModuleInit();
  return { db, wallet: new WalletService(db), users: new UsersService(db) };
}

async function main() {
  // Base limpa.
  {
    const { db } = await novoProcesso();
    await db.query(
      `TRUNCATE tournament_settlements, tournament_rounds, coupon_redemptions,
                ledger_entries, friend_requests, coupons, users CASCADE`,
    );
    await db.onModuleDestroy();
  }

  // ---------- 1. O saldo sobrevive ao restart ----------
  let saldoAntes = 0;
  {
    const { db, wallet, users } = await novoProcesso();
    await users.seedIfEmpty();

    await wallet.credit('u1', 5_000, 'compra', 'ouro');
    await wallet.debit('u1', 1_200, 'aposta', 'slots');
    saldoAntes = await wallet.balanceOf('u1');
    checa('semente + compra - aposta bate', saldoAntes === 12_500 + 5_000 - 1_200, String(saldoAntes));
    await db.onModuleDestroy();
  }
  {
    // Processo novo, pool novo: é o servidor subindo de novo.
    const { db, wallet, users } = await novoProcesso();
    await users.seedIfEmpty(); // não pode recriar nada nem zerar o saldo
    const saldoDepois = await wallet.balanceOf('u1');
    checa('o saldo sobrevive ao restart', saldoDepois === saldoAntes, `${saldoAntes} -> ${saldoDepois}`);

    const extrato = await wallet.historyOf('u1');
    checa('o extrato sobrevive inteiro', extrato.length === 3, `${extrato.length} entradas`);
    checa('a origem de cada entrada sobrevive', extrato[1]?.origin === 'ouro' && extrato[2]?.origin === 'slots');
    checa('a semente não roda de novo em base cheia', extrato.filter((e) => e.origin === 'semente').length === 1);
    await db.onModuleDestroy();
  }

  // ---------- 2. Débito atômico: não dá pra gastar a mesma ficha duas vezes ----------
  {
    const { db, wallet } = await novoProcesso();
    await db.query(`DELETE FROM ledger_entries WHERE user_id = 'u2'`);
    await wallet.credit('u2', 1_000, 'ajuste', 'teste');

    // 20 apostas de 100 disparadas ao mesmo tempo, com saldo pra exatamente 10.
    const tentativas = await Promise.allSettled(
      Array.from({ length: 20 }, () => wallet.debit('u2', 100, 'aposta', 'slots')),
    );
    const aprovadas = tentativas.filter((t) => t.status === 'fulfilled').length;
    const recusadas = tentativas.filter((t) => t.status === 'rejected').length;
    const saldoFinal = await wallet.balanceOf('u2');

    console.log(`     (${aprovadas} aprovadas, ${recusadas} recusadas, saldo final ${saldoFinal})`);
    checa('exatamente 10 apostas passam', aprovadas === 10, String(aprovadas));
    checa('as outras 10 são recusadas', recusadas === 10, String(recusadas));
    checa('o saldo nunca fica negativo', saldoFinal === 0, String(saldoFinal));
    await db.onModuleDestroy();
  }

  // ---------- 3. Jogadores diferentes não travam um ao outro ----------
  {
    const { db, wallet } = await novoProcesso();
    await db.query(`DELETE FROM ledger_entries WHERE user_id IN ('u3','u4')`);
    await wallet.credit('u3', 1_000, 'ajuste', 'teste');
    await wallet.credit('u4', 1_000, 'ajuste', 'teste');

    const comeco = Date.now();
    await Promise.all([
      ...Array.from({ length: 5 }, () => wallet.debit('u3', 100, 'aposta', 'slots')),
      ...Array.from({ length: 5 }, () => wallet.debit('u4', 100, 'aposta', 'slots')),
    ]);
    const duracao = Date.now() - comeco;
    checa('os dois debitam sem se atrapalhar', (await wallet.balanceOf('u3')) === 500 && (await wallet.balanceOf('u4')) === 500);
    checa('e sem demorar (a trava é por jogador, não global)', duracao < 3_000, `${duracao}ms`);
    await db.onModuleDestroy();
  }

  // ---------- 4. Crédito e débito recusam valor inválido ----------
  {
    const { db, wallet } = await novoProcesso();
    const recusa = async (fn: () => Promise<unknown>) => {
      try { await fn(); return false; } catch { return true; }
    };
    checa('crédito de zero é recusado', await recusa(() => wallet.credit('u1', 0, 'ajuste')));
    checa('débito negativo é recusado', await recusa(() => wallet.debit('u1', -50, 'aposta')));
    checa('débito de usuário inexistente é recusado', await recusa(() => wallet.debit('ninguem', 10, 'aposta')));
    await db.onModuleDestroy();
  }

  console.log(falhas === 0 ? '\nTodas as verificações de persistência passaram.' : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error('ERRO:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
