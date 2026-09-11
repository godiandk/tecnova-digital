import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DatabaseService } from '../../database/database.service';
import { WalletService } from './wallet.service';
import { TETO_DE_FICHAS, apostaMaximaSegura, fichaExata, problemaComOTeto } from '../../comum/teto-de-fichas';
import {
  MAIOR_MESA,
  NIVEIS_DE_MESA,
  degrauQueCabeNaConta,
  problemaComAAposta,
  problemaComAEntrada,
} from '../games/shared/niveis-de-mesa';
import { MAIOR_MULTIPLICADOR as SLOTS } from '../games/slots/slots.config';
import { MAIOR_MULTIPLICADOR as ROLETA } from '../games/roulette/roulette.config';
import { MAIOR_MULTIPLICADOR as BACARA } from '../games/baccarat/baccarat.config';
import { MAIOR_MULTIPLICADOR as BACBO } from '../games/bac-bo/bac-bo.config';
import { MAIOR_MULTIPLICADOR as BLACKJACK } from '../games/blackjack/blackjack.config';
import { MAIOR_MULTIPLICADOR as BOLSA } from '../games/stock-market/stock-market.config';
import { MAIOR_MULTIPLICADOR as BANCA } from '../games/banca-francesa/banca-francesa.config';

/**
 * A FICHA É EXATA DE PONTA A PONTA — de 50 a um trilhão, e até o teto.
 *
 *   npm run verify:precisao
 *
 * A pergunta que isto responde é simples e desagradável: em que ponto a conta das fichas
 * começa a mentir? Ela mente sem avisar. `9007199254740992 + 1` devolve ela mesma, e um
 * saldo assim não dá erro, não dá log, não dá nada — só para de subir.
 *
 * ENTÃO ISTO MEDE A LINHA, EM VEZ DE CONFIAR NELA. Seis frentes:
 *
 *   1. a escada de mesas inteira cabe na conta exata, degrau por degrau;
 *   2. cada jogo declara o maior prêmio que sabe pagar, e esse prêmio, na maior aposta
 *      que o jogo aceita, ainda cabe;
 *   3. a aposta que NÃO caberia é recusada ANTES de a ficha sair do saldo — porque
 *      recusar depois é exatamente a cena de "ganhei e o saldo não subiu";
 *   4. o Postgres e o JavaScript concordam sobre o mesmo número, na ida e na volta,
 *      inclusive no teto;
 *   5. o JSON não estraga o número no caminho até a tela;
 *   6. a carteira recusa um crédito que passaria do teto, em vez de guardar mentira.
 *
 * A REPRESENTAÇÃO ESCOLHIDA está escrita em `comum/teto-de-fichas.ts`, com o motivo de
 * não ser BigInt. Esta conferência é a prova de que a escolha se sustenta.
 */
let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`  ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`  FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

/** Os jogos e o maior retorno que cada um sabe pagar, em múltiplos da aposta. */
const JOGOS: Array<[string, number]> = [
  ['caça-níqueis', SLOTS],
  ['roleta', ROLETA],
  ['bacará', BACARA],
  ['bac bo', BACBO],
  ['blackjack', BLACKJACK],
  ['stock market', BOLSA],
  ['banca francesa', BANCA],
  ['mesas de entrada (truco, dominó, pôquer)', MAIOR_MESA],
];

/** Os valores que o dono pediu pra ver conferidos, de cinquenta a um trilhão. */
const VALORES = [
  50, 500, 5_000, 50_000, 500_000, 5_000_000, 50_000_000, 500_000_000,
  5_000_000_000, 50_000_000_000, 500_000_000_000, 1_000_000_000_000,
];

async function main() {
  console.log('\n=== A FICHA É EXATA? ===\n');
  console.log(`  o teto da conta exata é ${TETO_DE_FICHAS.toLocaleString('pt-BR')} fichas (2^53 − 1)\n`);

  console.log('--- 1. a escada de mesas cabe inteira ---\n');
  for (const nivel of NIVEIS_DE_MESA) {
    const valores = [nivel.saldoDeEntrada, nivel.minimo, nivel.maximo, ...nivel.fichas];
    confere(
      `  ${nivel.nome.padEnd(10)} entra com ${nivel.saldoDeEntrada.toLocaleString('pt-BR').padStart(19)}`,
      valores.every(fichaExata),
      valores.filter((v) => !fichaExata(v)).join(', '),
    );
  }

  console.log('\n--- 2. o maior prêmio de cada jogo cabe na maior aposta que ele aceita ---\n');
  for (const [nome, multiplicador] of JOGOS) {
    const maxima = apostaMaximaSegura(multiplicador);
    const premio = maxima * multiplicador;
    console.log(
      `  ${nome.padEnd(42)} paga até ${String(multiplicador).padStart(6)}x   ` +
        `aposta máxima ${maxima.toLocaleString('pt-BR').padStart(19)}`,
    );
    confere(`  ${nome}: o prêmio máximo ainda é exato`, fichaExata(premio), `daria ${premio}`);
  }

  console.log('\n--- 3. de 50 a um trilhão: o que cada jogo aceita ---\n');
  const nivelMaximo = 10_000;
  for (const valor of VALORES) {
    const saldo = Math.max(valor, valor * 2);
    const recusados = JOGOS.filter(([, m]) => problemaComOTeto(valor, m) !== null).map(([n]) => n);
    console.log(
      `  ${valor.toLocaleString('pt-BR').padStart(19)}  ` +
        (recusados.length === 0 ? 'aceita em todas as mesas' : `recusada em: ${recusados.join(', ')}`),
    );
    /*
     * A conferência aqui não é "todo valor passa" — um trilhão de aposta no caça-níqueis
     * DEVE ser recusado, porque oitenta mil vezes um trilhão não cabe. O que se confere é
     * que a recusa, quando vem, é a do teto, e que nada é recusado sem motivo.
     */
    confere(
      `  ${valor.toLocaleString('pt-BR')}: nenhuma recusa sem ser a do teto`,
      JOGOS.every(([, m]) => {
        const problema = problemaComAAposta(valor, saldo, nivelMaximo, m);
        if (problema === null) return true;
        return problema === problemaComOTeto(valor, m) || problema.includes('aposta mínima');
      }),
    );
  }

  console.log('\n--- 4. o trilho de fichas para onde a conta para de ser exata ---\n');
  /*
   * O DEFEITO QUE ESTA SEÇÃO ENCONTROU, e que agora ela guarda: no Eclipse a aposta
   * mínima é 5 trilhões e o caça-níqueis paga até 80.000x — o mínimo da mesa era MAIOR
   * que o máximo aritmético, e nenhuma aposta era legal. A mesa mais alta do jogo mais
   * popular era impossível de jogar, e a tela nem sabia.
   */
  for (const [nome, multiplicador] of JOGOS) {
    const topo = degrauQueCabeNaConta(NIVEIS_DE_MESA[NIVEIS_DE_MESA.length - 1], multiplicador);
    console.log(
      `  ${nome.padEnd(42)} no topo da escada, o trilho para no ${topo.nome} ` +
        `(ficha máxima ${topo.maximo.toLocaleString('pt-BR')})`,
    );
    confere(
      `  ${nome}: existe aposta legal em TODOS os degraus`,
      NIVEIS_DE_MESA.every((degrau) => {
        const cabe = degrauQueCabeNaConta(degrau, multiplicador);
        return cabe.minimo <= apostaMaximaSegura(multiplicador);
      }),
    );
  }

  console.log('\n--- 5. a recusa acontece ANTES de a ficha sair do saldo ---\n');
  const saldoEnorme = TETO_DE_FICHAS;
  const apostaQueNaoCabe = apostaMaximaSegura(SLOTS) + 1;
  confere(
    'uma aposta acima do teto é recusada pela regra de aposta',
    problemaComAAposta(apostaQueNaoCabe, saldoEnorme, nivelMaximo, SLOTS) !== null,
    'a regra deixou passar',
  );
  confere(
    'a mensagem da recusa explica a conta, e não só o número',
    (problemaComAAposta(apostaQueNaoCabe, saldoEnorme, nivelMaximo, SLOTS) ?? '').includes('x a aposta'),
  );
  confere(
    'a maior aposta que CABE não é recusada',
    problemaComOTeto(apostaMaximaSegura(SLOTS), SLOTS) === null,
  );
  confere(
    'uma entrada de mesa acima do teto também é recusada',
    problemaComAEntrada(apostaMaximaSegura(MAIOR_MESA) + 1, saldoEnorme, nivelMaximo) !== null,
  );

  console.log('\n--- 6. o Postgres e o JavaScript concordam sobre o mesmo número ---\n');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get(DatabaseService);
  const wallet = app.get(WalletService);
  const id = `teste-precisao-${Date.now()}`;

  try {
    await db.query(`INSERT INTO users (id, name, level) VALUES ($1, 'Teste Precisão', 1)`, [id]);

    /*
     * A IDA E A VOLTA, valor por valor. O `pg` devolve BIGINT como TEXTO justamente
     * porque um BIGINT pode não caber num `number`; `database.service.ts` converte pra
     * número. É essa conversão que está sendo medida aqui — e ela é medida no teto, que
     * é onde uma conversão descuidada quebraria.
     */
    for (const valor of [...VALORES, TETO_DE_FICHAS]) {
      const linha = await db.queryOne<{ v: number }>('SELECT $1::bigint AS v', [valor]);
      confere(
        `  ${valor.toLocaleString('pt-BR').padStart(19)} volta do banco igual`,
        linha?.v === valor && typeof linha?.v === 'number',
        `voltou ${linha?.v} (${typeof linha?.v})`,
      );
    }

    console.log('\n--- 7. o JSON não estraga o número no caminho até a tela ---\n');
    for (const valor of [...VALORES, TETO_DE_FICHAS]) {
      const voltou = JSON.parse(JSON.stringify({ saldo: valor })).saldo;
      confere(`  ${valor.toLocaleString('pt-BR').padStart(19)} sobrevive ao JSON`, voltou === valor, `virou ${voltou}`);
    }

    console.log('\n--- 8. a carteira soma certo nos valores grandes ---\n');
    /*
     * SOMAR DE VERDADE, e não conferir uma constante: doze créditos, um por degrau da
     * escada, e o saldo tem que ser exatamente a soma deles. É a mesma soma que o
     * `balanceOf` faz em produção, e o total passa de um trilhão e meio.
     */
    let esperado = 0;
    for (const valor of VALORES) {
      await wallet.credit(id, valor, 'ajuste', 'precisao');
      esperado += valor;
    }
    const saldo = await wallet.balanceOf(id);
    confere(
      'doze créditos de 50 a um trilhão somam exatamente',
      saldo === esperado,
      `esperado ${esperado.toLocaleString('pt-BR')}, real ${saldo.toLocaleString('pt-BR')}`,
    );
    confere('e o saldo continua sendo ficha exata', fichaExata(saldo), `${saldo}`);

    console.log('\n--- 9. a carteira recusa o que passaria do teto ---\n');
    let recusouAcimaDoTeto = false;
    await wallet
      .credit(id, TETO_DE_FICHAS, 'ajuste', 'precisao')
      .catch((erro: Error) => {
        recusouAcimaDoTeto = /teto/i.test(erro.message);
      });
    confere('um crédito que passaria do teto é recusado, com o motivo', recusouAcimaDoTeto);

    let recusouValorInseguro = false;
    await wallet
      .credit(id, TETO_DE_FICHAS + 2, 'ajuste', 'precisao')
      .catch(() => {
        recusouValorInseguro = true;
      });
    confere('um valor já fora do inteiro seguro é recusado na entrada', recusouValorInseguro);

    const saldoDepois = await wallet.balanceOf(id);
    confere(
      'e nenhuma das duas recusas mexeu no saldo',
      saldoDepois === esperado,
      `era ${esperado}, ficou ${saldoDepois}`,
    );
  } finally {
    await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [id]).catch(() => undefined);
    await db.query('DELETE FROM users WHERE id = $1', [id]).catch(() => undefined);
    await app.close();
  }

  console.log(
    falhas === 0
      ? '\nOK: a ficha é exata de 50 até o teto, e o que não cabe é recusado antes de custar.'
      : `\n${falhas} FALHA(S)`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
