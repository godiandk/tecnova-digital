import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { DatabaseService } from '../../database/database.service';
import { WalletService } from '../wallet/wallet.service';

/**
 * O JOGO PAGA O QUE ELE DIZ QUE PAGOU.
 *
 *   npm run verify:liquidacao
 *
 * O DEFEITO QUE ISTO VEIO CAÇAR foi relatado jogando: ganhar, ver o prêmio na tela, e o
 * saldo não subir. Parte era da interface (uma corrida que fazia o número voltar atrás —
 * ver `verifica-saldo-na-tela`), mas "parte" não serve: a outra metade da pergunta é se o
 * SERVIDOR move a ficha certa. É isso que se prova aqui.
 *
 * A INVARIANTE, e ela vale para os dez jogos sem que nenhum precise ser conhecido:
 *
 *     para toda rodada:  soma dos lançamentos do ledger  ==  retorno − apostado
 *
 * Toda rodada grava um evento LIQUIDADA com `apostado` e `retorno` — é o que o jogo DIZ
 * que aconteceu. Todo lançamento de carteira carrega o `round_id` — é o que a carteira
 * FEZ. Se um jogo creditasse só o lucro quando devia devolver a aposta junto (ou o
 * contrário), os dois números discordariam nessa rodada, e a conta acusa na hora.
 *
 * POR QUE ASSIM, E NÃO DEZ TESTES DE PAYOUT: um teste por jogo prova o que o autor dele
 * pensou em provar. Esta conta não pergunta nada ao jogo — ela compara a promessa com o
 * movimento, e um jogo novo entra na conferência sem escrever uma linha.
 *
 * O QUE ELA NÃO PROVA, dito de frente: que a REGRA DE PAGAMENTO está certa. Se a banca
 * francesa pagasse 5x onde devia pagar 62x, `retorno` e ledger continuariam batendo — os
 * dois estariam errados juntos. Quem cuida disso são as conferências de RTP de cada jogo,
 * que conferem a matemática contra a referência publicada. Esta aqui cuida do caminho
 * entre a regra e a carteira.
 */
let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

interface LinhaDeDivergencia {
  rodada_id: string;
  jogo: string;
  apostado: string;
  retorno: string;
  movido: string;
}

async function main() {
  /*
   * SOBE O APLICATIVO DE VERDADE, e não um punhado de serviços montados à mão. Os jogos
   * dependem uns dos outros (máquina de rodada, carteira, degrau, torneio), e montar isso
   * no teste provaria a montagem do teste. Aqui a injeção é a mesma de produção.
   */
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get(DatabaseService);
  const wallet = app.get(WalletService);

  try {
    console.log('--- 1. toda rodada moveu exatamente o que declarou ---\n');

    /*
     * A conta em SQL, e não em JavaScript, por um motivo de precisão: `amount` é BIGINT, e
     * somar do lado de cá passaria pelo número do JavaScript — que é exato só até 2^53.
     * Com fichas na casa dos quatrilhões, é justamente aqui que a soma começaria a mentir.
     */
    const divergentes = await db.query<LinhaDeDivergencia>(`
      WITH liquidadas AS (
        SELECT r.id AS rodada_id,
               r.jogo,
               (e.dados->>'apostado')::numeric AS apostado,
               (e.dados->>'retorno')::numeric  AS retorno
          FROM rodadas r
          JOIN eventos_da_rodada e ON e.rodada_id = r.id AND e.tipo = 'LIQUIDADA'
      ),
      movimento AS (
        SELECT round_id, COALESCE(SUM(amount), 0)::numeric AS movido
          FROM ledger_entries
         WHERE round_id IS NOT NULL
         GROUP BY round_id
      )
      SELECT l.rodada_id, l.jogo, l.apostado::text, l.retorno::text,
             COALESCE(m.movido, 0)::text AS movido
        FROM liquidadas l
        LEFT JOIN movimento m ON m.round_id = l.rodada_id
       WHERE COALESCE(m.movido, 0) <> (l.retorno - l.apostado)
       ORDER BY l.rodada_id
       LIMIT 20
    `);

    const total = await db.queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM rodadas r
        JOIN eventos_da_rodada e ON e.rodada_id = r.id AND e.tipo = 'LIQUIDADA'`,
    );
    const quantas = Number(total?.n ?? 0);

    console.log(`     ${quantas.toLocaleString('pt-BR')} rodadas liquidadas no banco\n`);
    confere(
      'nenhuma rodada moveu valor diferente do que declarou',
      divergentes.length === 0,
      divergentes
        .map((d) => `${d.jogo}/${d.rodada_id}: declarou ${d.retorno}−${d.apostado}, moveu ${d.movido}`)
        .join(' | '),
    );

    /*
     * E POR JOGO, pra a resposta ser útil quando falhar. Uma linha por jogo com o total
     * apostado, o total pago e o retorno efetivo — que é o número que dá pra comparar com
     * o RTP publicado de cada mesa.
     */
    console.log('\n--- 2. o que cada jogo apostou e pagou, no banco ---\n');
    const porJogo = await db.query<{ jogo: string; rodadas: string; apostado: string; retorno: string; movido: string }>(`
      WITH liquidadas AS (
        SELECT r.id AS rodada_id, r.jogo,
               (e.dados->>'apostado')::numeric AS apostado,
               (e.dados->>'retorno')::numeric  AS retorno
          FROM rodadas r
          JOIN eventos_da_rodada e ON e.rodada_id = r.id AND e.tipo = 'LIQUIDADA'
      )
      SELECT l.jogo,
             COUNT(*)::text AS rodadas,
             SUM(l.apostado)::text AS apostado,
             SUM(l.retorno)::text  AS retorno,
             COALESCE(SUM((SELECT SUM(amount) FROM ledger_entries le WHERE le.round_id = l.rodada_id)), 0)::text AS movido
        FROM liquidadas l
       GROUP BY l.jogo
       ORDER BY l.jogo
    `);

    if (porJogo.length === 0) {
      console.log('     (nenhuma rodada no banco — rode os jogos antes, ou use o banco de produção)');
    }
    console.log('     jogo               rodadas        apostado         retorno    retorno efetivo');
    for (const j of porJogo) {
      const apostado = Number(j.apostado);
      const retorno = Number(j.retorno);
      const efetivo = apostado > 0 ? `${((retorno / apostado) * 100).toFixed(2)}%` : '—';
      console.log(
        `     ${j.jogo.padEnd(18)} ${j.rodadas.padStart(7)} ${j.apostado.padStart(15)} ${j.retorno.padStart(15)} ${efetivo.padStart(18)}`,
      );
      /* A conta de cada jogo também tem que fechar isoladamente. */
      confere(
        `  ${j.jogo}: o ledger moveu exatamente retorno − apostado`,
        BigInt(j.movido) === BigInt(j.retorno) - BigInt(j.apostado),
        `moveu ${j.movido}, devia mover ${BigInt(j.retorno) - BigInt(j.apostado)}`,
      );
    }

    console.log('\n--- 3. o extrato de cada jogador fecha com o saldo ---\n');
    /*
     * O SALDO É A SOMA DO EXTRATO — não existe campo de saldo guardado, e é essa a decisão
     * que torna esta conferência possível. Aqui ela é feita pelo caminho que o jogo usa
     * (`balanceOf`) contra a soma bruta em SQL: se os dois discordassem, o jogo estaria
     * lendo um número que o extrato não explica.
     */
    const jogadores = await db.query<{ user_id: string; soma: string }>(`
      SELECT user_id, SUM(amount)::text AS soma
        FROM ledger_entries GROUP BY user_id ORDER BY user_id LIMIT 200
    `);
    let divergiu = 0;
    for (const j of jogadores) {
      const lido = await wallet.balanceOf(j.user_id);
      if (BigInt(lido) !== BigInt(j.soma)) {
        divergiu += 1;
        console.log(`FALHA ${j.user_id}: balanceOf devolveu ${lido}, o extrato soma ${j.soma}`);
      }
    }
    if (divergiu > 0) falhas += divergiu;
    confere(`os ${jogadores.length} extratos batem com o saldo lido`, divergiu === 0);

    /*
     * NENHUM SALDO NEGATIVO. A carteira recusa débito que deixaria o saldo negativo, mas
     * "recusa" é uma promessa do código — esta linha confere o resultado dela no banco.
     */
    const negativos = await db.query<{ user_id: string; soma: string }>(`
      SELECT user_id, SUM(amount)::text AS soma
        FROM ledger_entries GROUP BY user_id HAVING SUM(amount) < 0
    `);
    confere(
      'nenhum jogador tem saldo negativo',
      negativos.length === 0,
      negativos.map((n) => `${n.user_id}: ${n.soma}`).join(', '),
    );

    console.log('\n--- 4. nenhum prêmio pago duas vezes pela mesma rodada ---\n');
    /*
     * Uma rodada tem UM débito de aposta e no máximo UM crédito de prêmio. Dois créditos de
     * prêmio na mesma rodada é reentrega paga duas vezes — o defeito que a idempotência
     * existe pra impedir, conferido aqui pelo resultado e não pela intenção.
     */
    const duplicados = await db.query<{ round_id: string; tipo: string; n: string }>(`
      SELECT round_id, type AS tipo, COUNT(*)::text AS n
        FROM ledger_entries
       WHERE round_id IS NOT NULL AND type IN ('aposta', 'premio')
       GROUP BY round_id, type
      HAVING COUNT(*) > 1
       LIMIT 20
    `);
    confere(
      'nenhuma rodada tem aposta ou prêmio lançado duas vezes',
      duplicados.length === 0,
      duplicados.map((d) => `${d.round_id}: ${d.n}x ${d.tipo}`).join(', '),
    );
  } finally {
    await app.close();
  }

  console.log(falhas === 0 ? '\nOK: o que os jogos declaram é exatamente o que a carteira moveu.' : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error('ERRO:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
