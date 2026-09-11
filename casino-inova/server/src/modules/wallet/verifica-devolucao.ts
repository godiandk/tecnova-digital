import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DatabaseService } from '../../database/database.service';
import { WalletService } from './wallet.service';
import { DevolveRodadasPresas } from './devolve-rodadas-presas.service';
import { RodadasRepository } from '../games/core/rodadas.repository';
import { BlackjackService } from '../games/blackjack/blackjack.service';

/**
 * O QUE FICOU PRESO VOLTA — e volta UMA vez só.
 *
 *   npm run verify:devolucao
 *
 * O DEFEITO QUE ISTO GUARDA: blackjack, truco, dominó e pôquer guardam a partida em
 * memória e cobram a aposta antes de ela acabar. Um reinício no meio apaga a partida e
 * NÃO devolve a ficha — o jogador apostou, não jogou, e perdeu. Do lado dele isso não
 * parece um defeito de servidor: parece "sumiram minhas fichas".
 *
 * A conferência não simula o defeito com números inventados: ela ABRE UMA MÃO DE
 * BLACKJACK de verdade pelo serviço de verdade, deixa a mão sem terminar (que é
 * exatamente o que um reinício faz), e pergunta à carteira se a ficha voltou.
 *
 * E confere as duas bordas que separam "devolver" de "dar dinheiro de graça":
 *   • rodar duas vezes não paga duas vezes (a devolução é idempotente);
 *   • uma rodada RECÉM-ABERTA não é devolvida — senão a devolução viraria um jeito de
 *     desistir de uma mão ruim e receber a aposta de volta.
 */
let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`  ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`  FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get(DatabaseService);
  const wallet = app.get(WalletService);
  const devolucao = app.get(DevolveRodadasPresas);
  const rodadas = app.get(RodadasRepository);
  const blackjack = app.get(BlackjackService);

  const id = `teste-devolucao-${Date.now()}`;
  const SALDO = 1_000_000;
  const APOSTA = 50_000;

  try {
    await db.query(`INSERT INTO users (id, name, level) VALUES ($1, 'Teste Devolução', 50)`, [id]);
    await db.query(
      `INSERT INTO ledger_entries (user_id, type, amount, origin) VALUES ($1,'ajuste',$2,'teste')`,
      [id, SALDO],
    );

    console.log('\n=== O QUE FICOU PRESO VOLTA ===\n');
    console.log('--- 1. uma mão que não terminou segura a aposta ---\n');

    await blackjack.startHand(id, APOSTA);
    const saldoComAMaoAberta = await wallet.balanceOf(id);
    confere(
      'a aposta saiu do saldo assim que a mão abriu',
      saldoComAMaoAberta === SALDO - APOSTA,
      `esperado ${SALDO - APOSTA}, real ${saldoComAMaoAberta}`,
    );

    console.log('\n--- 2. uma mão RECÉM-aberta não é devolvida ---\n');
    /*
     * A CARÊNCIA É O QUE IMPEDE A EXPLORAÇÃO. Sem ela, um jogador que visse uma mão ruim
     * poderia largar a partida e receber a aposta de volta — a casa perderia sempre, e o
     * blackjack deixaria de ser blackjack. Aqui a mão tem segundos de idade, e a
     * devolução com dez minutos de carência tem que ignorá-la.
     */
    const cedoDemais = await devolucao.devolver(10);
    confere(
      'a devolução com carência de 10 minutos não toca numa mão de agora',
      cedoDemais.length === 0,
      `devolveu ${cedoDemais.length}`,
    );
    confere(
      'e o saldo continua igual',
      (await wallet.balanceOf(id)) === SALDO - APOSTA,
    );

    console.log('\n--- 3. depois do reinício, a ficha volta ---\n');
    /*
     * O REINÍCIO SIMULADO COM HONESTIDADE: o que um reinício faz é apagar a memória e
     * deixar a rodada velha no banco. Envelhecer a rodada é a mesma situação vista pela
     * devolução — e é assim que dá pra medir sem derrubar o processo no meio do teste.
     */
    await db.query(
      `UPDATE rodadas SET aberta_em = now() - interval '1 hour'
        WHERE fechada_em IS NULL
          AND id IN (SELECT round_id FROM ledger_entries WHERE user_id = $1 AND round_id IS NOT NULL)`,
      [id],
    );

    const devolvidas = await devolucao.devolver(10);
    const saldoDepois = await wallet.balanceOf(id);
    confere('a rodada presa foi devolvida', devolvidas.length === 1, `${devolvidas.length} devolvidas`);
    confere(
      'o saldo voltou exatamente ao que era antes da aposta',
      saldoDepois === SALDO,
      `esperado ${SALDO}, real ${saldoDepois}`,
    );

    console.log('\n--- 4. rodar de novo não paga de novo ---\n');
    const segundaVez = await devolucao.devolver(10);
    const saldoFinal = await wallet.balanceOf(id);
    confere('a segunda passada não devolve nada', segundaVez.length === 0, `${segundaVez.length}`);
    confere('e o saldo não se mexeu', saldoFinal === SALDO, `virou ${saldoFinal}`);

    console.log('\n--- 5. nem duas devoluções ao mesmo tempo pagam duas vezes ---\n');
    /*
     * A SEÇÃO DE CIMA PASSAVA PELO MOTIVO ERRADO, e a mutação mostrou: tirando a chave de
     * idempotência, ela continuava verde. Duas razões, e nenhuma era a chave — a primeira
     * passada FECHA a rodada, e mesmo reaberta ela não é mais escolhida, porque a conta
     * dela já voltou a zero e a busca só pega soma NEGATIVA.
     *
     * Ou seja: o desenho se protege sozinho no caminho sequencial, e isso é melhor que
     * depender de chave. A chave serve pro caminho que sobra — DUAS DEVOLUÇÕES AO MESMO
     * TEMPO, cada uma lendo a soma antes de a outra gravar. É esse o caso medido aqui, e
     * é o único em que tirar a chave faz o jogador receber duas vezes.
     */
    await db.query(
      `UPDATE rodadas SET fechada_em = NULL, aberta_em = now() - interval '1 hour'
        WHERE id = ANY($1::text[])`,
      [devolvidas.map((d) => d.rodadaId)],
    );
    await db.query(
      `DELETE FROM ledger_entries WHERE user_id = $1 AND origin = 'rodada-presa'`,
      [id],
    );
    const aoMesmoTempo = await Promise.all([
      devolucao.devolver(10),
      devolucao.devolver(10),
      devolucao.devolver(10),
    ]);
    const pagasAoMesmoTempo = aoMesmoTempo.reduce((total, lista) => total + lista.length, 0);
    const saldoDepoisDaCorrida = await wallet.balanceOf(id);
    confere(
      'três devoluções simultâneas pagam uma só vez',
      pagasAoMesmoTempo === 1,
      `pagaram ${pagasAoMesmoTempo}`,
    );
    confere(
      'e o saldo é o de antes da aposta, nem uma ficha a mais',
      saldoDepoisDaCorrida === SALDO,
      `esperado ${SALDO}, real ${saldoDepoisDaCorrida}`,
    );

    console.log('\n--- 6. a devolução se explica no extrato ---\n');
    const extrato = await wallet.historyOf(id);
    const linha = extrato.find((e) => e.origin === 'rodada-presa');
    confere('existe uma linha de devolução, com origem nomeada', linha !== undefined);
    confere('e ela vale exatamente a aposta presa', linha?.amount === APOSTA, `${linha?.amount}`);

    const abertas = await rodadas.abertas();
    const aindaAberta = abertas.some((r) =>
      devolvidas.some((d) => d.rodadaId === r.id),
    );
    confere('a rodada devolvida saiu da lista das abertas', !aindaAberta);
  } finally {
    await db.query(
      `DELETE FROM eventos_da_rodada WHERE rodada_id IN
         (SELECT DISTINCT round_id FROM ledger_entries WHERE user_id = $1 AND round_id IS NOT NULL)`,
      [id],
    ).catch(() => undefined);
    await db.query(
      `DELETE FROM rodadas WHERE id IN
         (SELECT DISTINCT round_id FROM ledger_entries WHERE user_id = $1 AND round_id IS NOT NULL)`,
      [id],
    ).catch(() => undefined);
    await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [id]).catch(() => undefined);
    await db.query('DELETE FROM users WHERE id = $1', [id]).catch(() => undefined);
    await app.close();
  }

  console.log(
    falhas === 0
      ? '\nOK: o que ficou preso volta, volta uma vez só, e não dá pra desistir de uma mão ruim.'
      : `\n${falhas} FALHA(S)`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
