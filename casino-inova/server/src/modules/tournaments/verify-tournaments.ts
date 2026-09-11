/**
 * Confere as regras do torneio rodando de verdade — mesma disciplina dos outros
 * verificadores do projeto. O que importa provar aqui:
 *
 * 1. A pontuação é proporcional: o tamanho da aposta não muda o ponto. É a promessa
 *    central do módulo, e a que seria mais fácil quebrar sem ninguém perceber.
 * 2. O mínimo de rodadas realmente barra quem teve uma sorte grande e parou.
 * 3. As janelas (dia, semana, mês) começam e terminam onde deveriam.
 * 4. O prêmio é pago uma vez só — inclusive DEPOIS de o servidor reiniciar, que é o
 *    caso que a versão em memória deste módulo errava.
 */
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { TournamentsService } from './tournaments.service';
import { DatabaseService } from '../../database/database.service';
import { POINTS_SCALE, windowFor } from './tournaments.config';
import { xpDoNivel } from '../progressao/niveis';

let falhas = 0;

function checa(nome: string, condicao: boolean, detalhe = '') {
  if (condicao) {
    console.log(`OK   ${nome}`);
  } else {
    falhas += 1;
    console.log(`FALHA ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  }
}

/**
 * Base limpa a cada cenário: apaga as tabelas e recria as contas de teste. Sem isso,
 * um cenário enxergaria as rodadas do anterior e o ranking sairia errado sem ninguém
 * entender por quê.
 *
 * Roda contra o banco apontado por TEST_DATABASE_URL — nunca deixe isso apontando pro
 * banco de verdade, porque o TRUNCATE abaixo apaga tudo.
 */
async function novoServico() {
  const db = new DatabaseService();
  await db.onModuleInit();
  await db.query(
    `TRUNCATE tournament_settlements, tournament_rounds, coupon_redemptions,
              ledger_entries, friend_requests, coupons, users CASCADE`,
  );

  const users = new UsersService(db);
  await users.seedIfEmpty();
  const wallet = new WalletService(db);
  return { db, users, wallet, tournaments: new TournamentsService(users, wallet, db) };
}

/**
 * Um saldo plausível para quem apostou `stake`.
 *
 * `recordRound` exige o saldo de ANTES da rodada porque é ele que diz o degrau da pessoa,
 * e o degrau é o que transforma ficha em XP. Aqui o número não é o objeto do teste — o
 * que importa é que seja coerente (ninguém aposta mais do que tem), senão o guarda de
 * plausibilidade derruba o XP pro piso e as conferências de XP abaixo mediriam o guarda
 * em vez da curva.
 */
const saldoDe = (stake: number) => stake * 100;

/**
 * Quanto XP entrou entre duas leituras do jogador, atravessando as viradas de nível.
 *
 * Comparar só o campo `xp` daria negativo toda vez que a pessoa subisse de nível — o XP
 * volta pra perto de zero e o resto virou nível. A conta certa soma o custo dos níveis
 * que foram vencidos no caminho.
 */
function xpGanho(antes: { level: number; xp: number }, depois: { level: number; xp: number }): number {
  let total = depois.xp - antes.xp;
  for (let n = antes.level; n < depois.level; n += 1) total += xpDoNivel(n);
  return total;
}

async function main() {
  // ---------- 1. Pontuação proporcional ----------
  {
    const { db, tournaments } = await novoServico();

    // u1 aposta baixo, u2 aposta 200x mais alto — mesmos resultados relativos.
    for (let i = 0; i < 10; i += 1) {
      await tournaments.recordRound('u1', 'slots', 50, 100, saldoDe(50)); // dobrou
      await tournaments.recordRound('u2', 'slots', 10_000, 20_000, saldoDe(10_000)); // dobrou igual
    }

    const ranking = await tournaments.leaderboard('diario-geral', 'u1');
    const u1 = ranking.rows.find((linha) => linha.userId === 'u1');
    const u2 = ranking.rows.find((linha) => linha.userId === 'u2');

    checa('aposta alta e aposta baixa pontuam igual', u1?.points === u2?.points, `${u1?.points} vs ${u2?.points}`);
    checa('dobrar a aposta vale +100 por rodada', u1?.points === 10 * POINTS_SCALE, String(u1?.points));
    await db.onModuleDestroy();
  }

  // ---------- 2. Perder tudo, e empatar ----------
  {
    const { db, tournaments } = await novoServico();
    for (let i = 0; i < 10; i += 1) {
      await tournaments.recordRound('u1', 'slots', 100, 0, saldoDe(100)); // perdeu tudo
      await tournaments.recordRound('u2', 'slots', 100, 100, saldoDe(100)); // empatou (devolveu a ficha)
    }
    const ranking = await tournaments.leaderboard('diario-geral');
    const u1 = ranking.rows.find((linha) => linha.userId === 'u1');
    const u2 = ranking.rows.find((linha) => linha.userId === 'u2');

    checa('perder tudo vale -100 por rodada', u1?.points === -10 * POINTS_SCALE, String(u1?.points));
    checa('devolver a ficha vale 0', u2?.points === 0, String(u2?.points));
    checa('quem empatou fica na frente de quem perdeu', (u2?.position ?? 9) < (u1?.position ?? 0));
    await db.onModuleDestroy();
  }

  // ---------- 3. Mínimo de rodadas ----------
  {
    const { db, tournaments } = await novoServico();
    // u1 acerta um 62x na primeira aposta e para de jogar.
    await tournaments.recordRound('u1', 'banca-francesa', 100, 6_200, saldoDe(100));
    // u2 joga as 10 rodadas exigidas, com resultado modesto.
    for (let i = 0; i < 10; i += 1) await tournaments.recordRound('u2', 'banca-francesa', 100, 200, saldoDe(100));

    const ranking = await tournaments.leaderboard('diario-geral', 'u1');
    checa('uma rodada de sorte não entra no ranking', !ranking.rows.some((linha) => linha.userId === 'u1'));
    checa('quem cumpriu o mínimo entra', ranking.rows.some((linha) => linha.userId === 'u2'));
    checa('a tela sabe quantas rodadas faltam', ranking.roundsToQualify === 9, String(ranking.roundsToQualify));
    await db.onModuleDestroy();
  }

  // ---------- 4. Torneio filtra por jogo ----------
  {
    const { db, tournaments } = await novoServico();
    for (let i = 0; i < 25; i += 1) await tournaments.recordRound('u1', 'slots', 100, 300, saldoDe(100));
    for (let i = 0; i < 25; i += 1) await tournaments.recordRound('u2', 'truco', 100, 200, saldoDe(100));

    const semanal = await tournaments.leaderboard('semanal-mesas');
    checa('torneio de mesas ignora slots', !semanal.rows.some((linha) => linha.userId === 'u1'));
    checa('torneio de mesas conta truco', semanal.rows.some((linha) => linha.userId === 'u2'));

    const diario = await tournaments.leaderboard('diario-geral');
    checa('torneio geral conta os dois', diario.rows.length === 2, String(diario.rows.length));
    await db.onModuleDestroy();
  }

  // ---------- 5. Desempate por menos rodadas ----------
  {
    const { db, tournaments } = await novoServico();
    // Os dois chegam a +1000 pontos: u1 em 10 rodadas, u2 em 20.
    for (let i = 0; i < 10; i += 1) await tournaments.recordRound('u1', 'slots', 100, 200, saldoDe(100));
    for (let i = 0; i < 10; i += 1) await tournaments.recordRound('u2', 'slots', 100, 200, saldoDe(100));
    for (let i = 0; i < 10; i += 1) await tournaments.recordRound('u2', 'slots', 100, 100, saldoDe(100));

    const ranking = await tournaments.leaderboard('diario-geral');
    const u1 = ranking.rows.find((linha) => linha.userId === 'u1');
    const u2 = ranking.rows.find((linha) => linha.userId === 'u2');
    checa('mesmos pontos nos dois', u1?.points === u2?.points, `${u1?.points} vs ${u2?.points}`);
    checa('desempate favorece quem jogou menos rodadas', u1?.position === 1, `u1 ficou em ${u1?.position}`);
    await db.onModuleDestroy();
  }

  // ---------- 6. Janelas ----------
  {
    // Quarta-feira, 12 de agosto de 2026, 15h UTC.
    const quarta = new Date(Date.UTC(2026, 7, 12, 15, 0, 0));

    const dia = windowFor('diario', quarta);
    checa('dia começa à meia-noite', dia.startsAt.toISOString() === '2026-08-12T00:00:00.000Z', dia.startsAt.toISOString());
    checa('dia dura 24h', dia.endsAt.getTime() - dia.startsAt.getTime() === 86_400_000);

    const semana = windowFor('semanal', quarta);
    checa('semana começa na segunda', semana.startsAt.toISOString() === '2026-08-10T00:00:00.000Z', semana.startsAt.toISOString());
    checa('semana dura 7 dias', semana.endsAt.getTime() - semana.startsAt.getTime() === 7 * 86_400_000);

    // Domingo é o último dia da semana, não o primeiro — é o caso que quebra fácil.
    const domingo = new Date(Date.UTC(2026, 7, 16, 23, 59, 0));
    checa(
      'domingo ainda pertence à semana que começou na segunda',
      windowFor('semanal', domingo).startsAt.toISOString() === '2026-08-10T00:00:00.000Z',
    );

    const mes = windowFor('mensal', quarta);
    checa('mês começa no dia 1', mes.startsAt.toISOString() === '2026-08-01T00:00:00.000Z', mes.startsAt.toISOString());
    checa('mês termina no dia 1 do mês seguinte', mes.endsAt.toISOString() === '2026-09-01T00:00:00.000Z', mes.endsAt.toISOString());

    // Virada de ano: dezembro tem que apontar pra janeiro do ano seguinte.
    const dezembro = new Date(Date.UTC(2026, 11, 20, 10, 0, 0));
    checa('dezembro termina em 1º de janeiro', windowFor('mensal', dezembro).endsAt.toISOString() === '2027-01-01T00:00:00.000Z');
  }

  // ---------- 7. Prêmio pago uma vez só, mesmo reiniciando o servidor ----------
  {
    const { db, wallet, tournaments } = await novoServico();

    /*
     * Rodadas de ONTEM, no meio do dia de ontem.
     *
     * Antes isto era `now() - interval '26 hours'`, e funcionava — exceto entre
     * meia-noite e duas da manhã. Às 00:12 UTC, 26 horas atrás é às 22:12 de ANTEONTEM,
     * que cai na janela do dia retrasado e não na de ontem; a apuração diária, que só
     * fecha a janela imediatamente anterior, não achava nada e a conferência reprovava.
     *
     * Uma conferência que passa vinte e duas horas por dia e reprova nas outras duas é
     * pior que uma que reprova sempre: ela ensina a equipe a ignorar o vermelho. Agora a
     * data é CALCULADA a partir do início do dia de hoje, e não medida no relógio: meio
     * dia de ontem cai no meio da janela de ontem em qualquer hora que isto rode.
     */
    for (let i = 0; i < 10; i += 1) {
      await db.query(
        `INSERT INTO tournament_rounds (user_id, game_id, stake, returned, played_at)
         VALUES ('u1','slots',100,300, date_trunc('day', now() AT TIME ZONE 'UTC') - interval '12 hours')`,
      );
    }

    const saldoAntes = await wallet.balanceOf('u1');
    await tournaments.leaderboard('diario-geral');
    const saldoDepois = await wallet.balanceOf('u1');
    checa('prêmio do dia anterior é creditado', saldoDepois > saldoAntes, `${saldoAntes} -> ${saldoDepois}`);

    // Mais três leituras não podem pagar de novo.
    await tournaments.leaderboard('diario-geral');
    await tournaments.leaderboard('diario-geral');
    await tournaments.listTournaments();
    checa('não paga duas vezes na mesma sessão', (await wallet.balanceOf('u1')) === saldoDepois);

    /*
     * O caso que a versão em memória errava: o "já paguei" vivia num Set do processo,
     * então reiniciar o servidor pagava tudo de novo. Aqui a marca está no banco, e um
     * serviço novo — que é o que um restart produz — enxerga a mesma marca.
     */
    const outroProcesso = await (async () => {
      const db2 = new DatabaseService();
      await db2.onModuleInit();
      const users2 = new UsersService(db2);
      const wallet2 = new WalletService(db2);
      return { db2, wallet2, tournaments2: new TournamentsService(users2, wallet2, db2) };
    })();
    await outroProcesso.tournaments2.leaderboard('diario-geral');
    const saldoDepoisDoRestart = await outroProcesso.wallet2.balanceOf('u1');
    checa(
      'não paga de novo depois de reiniciar o servidor',
      saldoDepoisDoRestart === saldoDepois,
      `${saldoDepois} -> ${saldoDepoisDoRestart}`,
    );
    await outroProcesso.db2.onModuleDestroy();

    const extrato = (await wallet.historyOf('u1')).filter((entrada) => entrada.origin === 'diario-geral');
    checa('o prêmio fica rastreável no extrato, uma vez só', extrato.length === 1, `${extrato.length} entradas`);
    await db.onModuleDestroy();
  }

  // ---------- 7. O XP passa por aqui, e ele é a única porta ----------
  {
    /*
     * ESTE CENÁRIO EXISTE PORQUE A PORTA ERA FÁCIL DE PERDER DE VISTA. `recordRound` é o
     * único caminho pelo qual jogar vira nível: os dez jogos e as três salas passam por
     * ele, e nada mais soma XP de rodada. Um jogo novo que esqueça de chamá-lo tem uma
     * barra que não anda, e ninguém descobre até um jogador reclamar.
     *
     * O que se prova aqui é o que a função pura não consegue provar sozinha: que o
     * caminho inteiro — chamada, degrau, transação, banco — entrega o XP certo.
     */
    const { db, tournaments, users } = await novoServico();

    const antes = await users.findById('u1');
    /* 50 fichas com 10.000 no bolso: degrau Bronze, aposta mínima. */
    await tournaments.recordRound('u1', 'slots', 50, 0, 10_000);
    const depois = await users.findById('u1');
    const ganhouAlgo = (depois!.level > antes!.level) || (depois!.xp > antes!.xp);
    checa('jogar move a barra', ganhouAlgo, `nível ${antes!.level}/${antes!.xp} -> ${depois!.level}/${depois!.xp}`);

    /*
     * A PROVA DE QUE NÍVEL NÃO SE COMPRA, feita pelo caminho de verdade e não pela
     * fórmula: u1 é Bronze e aposta 50; u2 tem cem mil vezes mais e aposta cem mil vezes
     * mais. A mesma aposta RELATIVA tem que dar o mesmo XP.
     */
    const u2Antes = await users.findById('u2');
    await tournaments.recordRound('u2', 'slots', 5_000_000, 0, 1_000_000_000);
    const u2Depois = await users.findById('u2');
    const ganhoDeU1 = xpGanho(antes!, depois!);
    const ganhoDeU2 = xpGanho(u2Antes!, u2Depois!);
    checa(
      'apostar o mínimo do próprio degrau vale o mesmo em qualquer degrau',
      ganhoDeU1 === ganhoDeU2,
      `Bronze apostando 50 ganhou ${ganhoDeU1}; o degrau alto apostando 5 milhões ganhou ${ganhoDeU2}`,
    );

    /*
     * O TETO DO DIA. Apostar muito, muitas vezes, para de somar — e é isto que impede um
     * robô de subir de nível mais rápido do que gente.
     */
    let rodadas = 0;
    let anterior = await users.findById('u1');
    let parou = false;
    while (rodadas < 2_000 && !parou) {
      await tournaments.recordRound('u1', 'slots', 1_000, 0, 10_000);
      rodadas += 1;
      const agora = await users.findById('u1');
      if (xpGanho(anterior!, agora!) === 0) parou = true;
      anterior = agora;
    }
    checa('o teto do dia existe e é alcançável', parou, `${rodadas} rodadas sem parar de somar`);
    checa(
      'o teto do dia não aperta antes de um dia inteiro de jogo',
      rodadas > 1_000,
      `parou de somar em ${rodadas} rodadas`,
    );

    /*
     * E O DIA VIRA. Ontem cheio não pode deixar hoje travado — se deixasse, quem jogou
     * muito num dia começaria o seguinte com a barra morta.
     */
    const noTeto = await users.findById('u1');
    await users.somarExperienciaDaRodada('u1', 1_000, 10_000, '2099-12-31');
    const amanha = await users.findById('u1');
    checa('virar o dia zera o teto', xpGanho(noTeto!, amanha!) > 0, 'a barra continuou travada no dia seguinte');

    /*
     * O GUARDA DO SALDO. Um saldo menor que a aposta é impossível — e como saldo baixo
     * significa degrau baixo significa MAIS XP, é exatamente a direção que alguém
     * tentaria forçar. Tem que pagar o piso, não o máximo.
     */
    const u3Antes = await users.findById('u2');
    await tournaments.recordRound('u2', 'slots', 5_000_000, 0, 0);
    const u3Depois = await users.findById('u2');
    checa(
      'aposta maior que o saldo paga o piso, e não o XP máximo',
      xpGanho(u3Antes!, u3Depois!) <= 1,
      `ganhou ${xpGanho(u3Antes!, u3Depois!)} XP com saldo zerado`,
    );

    await db.onModuleDestroy();
  }

  console.log(falhas === 0 ? '\nTodas as verificações de torneio passaram.' : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error('ERRO:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
