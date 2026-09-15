/**
 * A MESA QUE A TELA MOSTRA É A MESA QUE O SERVIDOR ACEITA — no caso que quebrou.
 *
 *   npm run verify:degrau
 *
 * O CENÁRIO É O DO PRINT: saldo de 146,89 BILHÕES e NÍVEL 1. Era ali que as duas regras se
 * contradiziam — a validação olhava só o saldo (Ônix, mínimo 500 milhões) e o trilho vinha
 * do degrau econômico (Bronze, fichas de 50). A mesa oferecia ficha que ela mesma recusava,
 * e a linha vermelha "O mínimo em Grande é 500.000.000 fichas" aparecia por cima de um
 * trilho de 50.
 *
 * A conferência é simples e não dá pra passar por acaso: pega a MENOR ficha que a tela
 * oferece e manda pro servidor. Se ele recusar, as duas regras voltaram a divergir.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { DatabaseService } from '../../../database/database.service';
import { BancaFrancesaService } from './banca-francesa.service';
import { DegrauDoJogador } from '../shared/degrau-do-jogador.service';
import { BancaFrancesaTableService } from '../../rooms/banca-francesa-table.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get(DatabaseService);
  const banca = app.get(BancaFrancesaService);
  const degraus = app.get(DegrauDoJogador);
  const id = `prova-146bi-${Date.now()}`;

  try {
    // O cenário do print: 146,89 bilhões de fichas, NÍVEL BAIXO.
    await db.query(`INSERT INTO users (id, name, level) VALUES ($1, 'Prova 146bi', 1)`, [id]);
    await db.query(
      `INSERT INTO ledger_entries (user_id, type, amount, origin) VALUES ($1,'ajuste',146890000000,'prova')`,
      [id],
    );

    const quem = await degraus.de(id);
    const config = await banca.getConfig(id);
    console.log(`\n  saldo            ${quem.saldo.toLocaleString('pt-BR')}`);
    console.log(`  nível            ${quem.nivel}`);
    console.log(`  degrau econômico ${quem.degrau.nome} (mínimo ${quem.degrau.minimo.toLocaleString('pt-BR')})`);
    console.log(`  a tela recebe    minBet ${config.minBet.toLocaleString('pt-BR')}, fichas ${config.fichas.map((f: number) => f.toLocaleString('pt-BR')).join(' · ')}`);

    // A menor ficha que a tela OFERECE tem que ser aceita pelo servidor.
    const menorFicha = config.fichas[0];
    let recusa: string | null = null;
    try {
      await banca.apostar(id, [{ type: 'grande', amount: menorFicha }]);
    } catch (erro) {
      recusa = (erro as Error).message;
    }
    console.log(
      recusa
        ? `\n  FALHA mesa sozinho: a tela oferece ${menorFicha.toLocaleString('pt-BR')} e o servidor recusa: "${recusa}"`
        : `\n  ok   mesa sozinho: a menor ficha que a tela oferece (${menorFicha.toLocaleString('pt-BR')}) é aceita`,
    );

    /*
     * E A MESA COM GENTE — que é exatamente a do print. Ela tem caminho próprio
     * (`BancaFrancesaTableService`), e foi ELE que ficou pra trás quando os jogos solo
     * passaram a perguntar o degrau econômico. Conferir só o solo deixaria o defeito
     * fotografado exatamente onde ele estava.
     */
    const mesas = app.get(BancaFrancesaTableService);
    const mesa = await mesas.createTable(id, 'privada');
    let recusaNaMesa: string | null = null;
    try {
      await mesas.placeBets(id, mesa.id, [{ type: 'grande', amount: menorFicha }]);
    } catch (erro) {
      recusaNaMesa = (erro as Error).message;
    }
    console.log(
      recusaNaMesa
        ? `  FALHA mesa com gente: a tela oferece ${menorFicha.toLocaleString('pt-BR')} e o servidor recusa: "${recusaNaMesa}"`
        : `  ok   mesa com gente: a menor ficha que a tela oferece (${menorFicha.toLocaleString('pt-BR')}) é aceita`,
    );

    process.exitCode = recusa || recusaNaMesa ? 1 : 0;
  } finally {
    await db.query('DELETE FROM eventos_da_rodada WHERE usuario_id = $1', [id]).catch(() => undefined);
    await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [id]).catch(() => undefined);
    await db.query('DELETE FROM users WHERE id = $1', [id]).catch(() => undefined);
    await app.close();
  }
}
main();
