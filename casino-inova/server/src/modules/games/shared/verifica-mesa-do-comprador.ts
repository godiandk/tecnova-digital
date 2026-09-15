import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { DatabaseService } from '../../../database/database.service';
import { DegrauDoJogador } from './degrau-do-jogador.service';
import { NIVEIS_DE_MESA } from './niveis-de-mesa';
import { SlotsService } from '../slots/slots.service';
import { RouletteService } from '../roulette/roulette.service';
import { BaccaratService } from '../baccarat/baccarat.service';
import { BacBoService } from '../bac-bo/bac-bo.service';
import { BlackjackService } from '../blackjack/blackjack.service';
import { StockMarketService } from '../stock-market/stock-market.service';
import { BancaFrancesaService } from '../banca-francesa/banca-francesa.service';
import { TrucoService } from '../truco/truco.service';
import { DominoService } from '../domino/domino.service';
import { PokerService } from '../poker/poker.service';

/**
 * QUEM COMPRA FICHA PODE JOGAR COM ELA — EM TODAS AS MESAS, NO PRIMEIRO MINUTO.
 *
 *   npm run verify:mesa-do-comprador
 *
 * O CASO QUE ESTA CONFERÊNCIA EXISTE PRA IMPEDIR, dito pelo dono do jogo com o print na
 * mão: alguém acaba de criar a conta, compra dez mil reais em fichas, entra na mesa — e
 * fica preso apostando CINQUENTA, porque o nível dele é 1.
 *
 * A causa era a regra `degrauEconomico = min(saldo, nível)`, que eu tinha escrito pra
 * impedir que comprar ficha virasse passagem pra mesa de cima. Ela impedia — e junto
 * impedia a pessoa de usar o que pagou. Não existe defesa que valha isso: um jogo que
 * recebe o pagamento e depois tranca a mesa não é cauteloso, é quebrado.
 *
 * A REGRA HOJE: quem manda é o SALDO. E a conferência varre a escada inteira com NÍVEL 1 —
 * a conta mais nova possível — provando, degrau por degrau e jogo por jogo, que a mesa
 * oferecida é a que combina com o bolso e que o servidor aceita a menor ficha dela.
 *
 * O pay-to-level continua barrado onde ele mora: o XP sai da aposta em unidades da mesa, e
 * a recompensa diária é ancorada no Bronze. Mesa alta não compra nível.
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
  const degraus = app.get(DegrauDoJogador);

  /** Os sete jogos contra a casa: cada um publica `minBet` e as fichas do trilho. */
  const contraACasa: Array<[string, (id: string) => Promise<{ minBet: number; fichas: number[] }>]> = [
    ['caça-níqueis', (id) => app.get(SlotsService).getConfig(id)],
    ['roleta', (id) => app.get(RouletteService).getConfig(id)],
    ['bacará', (id) => app.get(BaccaratService).getConfig(id)],
    ['bac bo', (id) => app.get(BacBoService).getConfig(id)],
    ['blackjack', (id) => app.get(BlackjackService).getConfig(id)],
    ['stock market', (id) => app.get(StockMarketService).getConfig(id)],
    ['banca francesa', (id) => app.get(BancaFrancesaService).getConfig(id)],
  ];

  /** As três mesas de entrada: publicam as entradas possíveis, e não fichas de aposta. */
  const mesasDeEntrada: Array<[string, (id: string) => Promise<{ minBuyIn: number; entradas: unknown[] }>]> = [
    ['truco', (id) => app.get(TrucoService).getConfig(id)],
    ['dominó', (id) => app.get(DominoService).getConfig(id)],
    ['pôquer', (id) => app.get(PokerService).getConfig(id)],
  ];

  console.log('\n=== QUEM COMPRA FICHA PODE JOGAR COM ELA ===');
  console.log('    (conta nova: NÍVEL 1 em todos os casos)\n');

  try {
    for (const degrau of NIVEIS_DE_MESA) {
      /*
       * O SALDO DE ENTRADA DO DEGRAU, que é o que a pessoa teria acabado de comprar. O
       * Bronze entra com zero, então ali o teste usa a banca de boas-vindas.
       */
      const saldo = degrau.saldoDeEntrada > 0 ? degrau.saldoDeEntrada : 10_000;
      const id = `comprador-${degrau.id}-${Date.now()}`;
      await db.query(`INSERT INTO users (id, name, level) VALUES ($1, 'Comprador', 1)`, [id]);
      await db.query(
        `INSERT INTO ledger_entries (user_id, type, amount, origin) VALUES ($1,'compra',$2,'prova')`,
        [id, saldo],
      );

      try {
        const quem = await degraus.de(id);
        console.log(
          `  comprou ${saldo.toLocaleString('pt-BR').padStart(21)} → mesa ${quem.degrau.nome}` +
            ` (mínimo ${quem.degrau.minimo.toLocaleString('pt-BR')})`,
        );
        confere(
          `  ${degrau.nome}: a mesa é a do saldo, e não a do nível 1`,
          quem.degrau.id === degrau.id,
          `caiu em ${quem.degrau.nome}`,
        );

        for (const [nome, ler] of contraACasa) {
          const config = await ler(id);
          const menor = config.fichas[0] ?? config.minBet;
          /*
           * A menor ficha que a tela OFERECE tem que ser >= o mínimo que o servidor EXIGE.
           * É a contradição do print, medida: trilho de 50 com recusa em 500 milhões.
           */
          confere(
            `    ${nome}: a menor ficha do trilho alcança o mínimo publicado`,
            menor >= config.minBet,
            `trilho começa em ${menor.toLocaleString('pt-BR')} e o mínimo é ${config.minBet.toLocaleString('pt-BR')}`,
          );
          confere(
            `    ${nome}: o trilho cabe no saldo de quem acabou de comprar`,
            menor <= quem.saldo,
            `a menor ficha é ${menor.toLocaleString('pt-BR')} e ele tem ${quem.saldo.toLocaleString('pt-BR')}`,
          );
        }

        for (const [nome, ler] of mesasDeEntrada) {
          const config = await ler(id);
          confere(
            `    ${nome}: existe entrada possível pra quem acabou de comprar`,
            config.entradas.length > 0,
            `nenhuma entrada entre ${config.minBuyIn.toLocaleString('pt-BR')} e o saldo`,
          );
        }
      } finally {
        await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [id]).catch(() => undefined);
        await db.query('DELETE FROM users WHERE id = $1', [id]).catch(() => undefined);
      }
    }
  } finally {
    await app.close();
  }

  console.log(
    falhas === 0
      ? '\nOK: em todo degrau da escada, quem compra ficha joga com ela — em todas as mesas.'
      : `\n${falhas} FALHA(S)`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
