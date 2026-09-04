/**
 * A RECOMPENSA DIÁRIA DÁ O QUE ELA DIZ QUE DÁ, UMA VEZ POR DIA.
 *
 * Duas partes, e as duas são lugares onde erro custa dinheiro de verdade:
 *
 * 1. A REGRA DA SEQUÊNCIA, conferida sem banco: coletou hoje, coletou ontem, faltou. É
 *    conta de calendário, e conta de calendário erra em silêncio — na virada do mês, no
 *    ano bissexto, no dia 31 que o mês seguinte não tem.
 *
 * 2. A COLETA EM SI, contra o banco de verdade: paga o valor certo, paga uma vez só
 *    mesmo com dez pedidos simultâneos, e deixa rastro no extrato.
 *
 * O segundo é o que importa mais. A proteção contra pagar duas vezes não está num `if`
 * no meio do código — está na condição do UPDATE, e a única forma de saber se ela
 * funciona é disparar os pedidos ao mesmo tempo e contar o dinheiro depois.
 */
import { DatabaseService } from '../../database/database.service';
import { WalletService } from '../wallet/wallet.service';
import { RecompensasService } from './recompensas.service';
import {
  DIAS_DO_CALENDARIO,
  calendarioPara,
  diasEntre,
  ehMarco,
  estadoDaSequencia,
  multiplicadorDoDia,
  premioDoDia,
} from './calendario';
import { NIVEIS_DE_MESA, nivelPara } from '../games/shared/niveis-de-mesa';

let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

const dia = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

console.log('--- 1. o calendário: trinta dias, cada um valendo mais que o anterior ---');
{
  const c = calendarioPara(0);
  confere('são trinta dias', c.length === DIAS_DO_CALENDARIO, `são ${c.length}`);
  confere('numerados de 1 a 30', c[0].dia === 1 && c[29].dia === 30);

  const marcos = c.filter((d) => d.marco).map((d) => d.dia);
  confere('os marcos são 7, 14, 21 e 30', marcos.join(',') === '7,14,21,30', marcos.join(','));

  // Todo dia paga mais que o anterior, ou é um marco (que paga muito mais).
  const quedas = c.filter((d, i) => i > 0 && d.premio <= c[i - 1].premio && !d.marco && !c[i - 1].marco);
  confere('o prêmio cresce todo dia', quedas.length === 0, `caiu nos dias ${quedas.map((d) => d.dia).join(',')}`);

  confere('todo marco paga mais que o dia anterior', c.filter((d) => d.marco).every((d) => d.premio > c[d.dia - 2].premio));
  confere('nenhum prêmio é fracionário', c.every((d) => Number.isInteger(d.premio)));
  confere('o dia 30 é o maior de todos', c[29].premio === Math.max(...c.map((d) => d.premio)));
}

console.log('\n--- 2. o prêmio acompanha o degrau: sempre as mesmas rodadas ---');
{
  /*
   * O ponto do prêmio ser múltiplo do mínimo da mesa é que ele vale a MESMA COISA EM
   * RODADAS pra todo mundo. Isto confere exatamente isso, do Bronze ao último degrau.
   */
  for (const saldoDeTeste of [0, 10_000, 60_000, 6_000_000, 99_000_000_000]) {
    const nivel = nivelPara(saldoDeTeste);
    const rodadas = premioDoDia(1, saldoDeTeste) / nivel.minimo;
    confere(
      `com ${saldoDeTeste.toLocaleString('pt-BR')} (mesa ${nivel.nome}): o dia 1 paga ${rodadas} rodadas mínimas`,
      rodadas === multiplicadorDoDia(1),
      `deu ${rodadas}`,
    );
  }
  const zerado = premioDoDia(1, 0);
  confere(
    `quem zerou a conta recebe ${zerado.toLocaleString('pt-BR')}, o bastante pra ${zerado / NIVEIS_DE_MESA[0].minimo} rodadas de Bronze`,
    zerado >= NIVEIS_DE_MESA[0].minimo,
  );
}

console.log('\n--- 3. a sequência: coletou hoje, coletou ontem, faltou ---');
{
  const nunca = estadoDaSequencia(null, 0, dia('2026-03-10'));
  confere('quem nunca coletou começa no dia 1, aberto', nunca.diaAtual === 1 && nunca.podeColetar);

  const hoje = estadoDaSequencia(dia('2026-03-10'), 5, dia('2026-03-10'));
  confere('coletou hoje: fechado, ainda no dia 5', !hoje.podeColetar && hoje.diaAtual === 5);
  confere(
    'e a próxima abertura é a meia-noite de amanhã',
    hoje.proximaAbertura.toISOString() === '2026-03-11T00:00:00.000Z',
    hoje.proximaAbertura.toISOString(),
  );

  const ontem = estadoDaSequencia(dia('2026-03-09'), 5, dia('2026-03-10'));
  confere('coletou ontem: abre o dia 6', ontem.podeColetar && ontem.diaAtual === 6 && !ontem.sequenciaPerdida);

  const faltou = estadoDaSequencia(dia('2026-03-08'), 5, dia('2026-03-10'));
  confere('faltou um dia: volta pro dia 1 e avisa', faltou.podeColetar && faltou.diaAtual === 1 && faltou.sequenciaPerdida);

  const fechou = estadoDaSequencia(dia('2026-03-09'), 30, dia('2026-03-10'));
  confere('depois do dia 30, o calendário recomeça no 1', fechou.diaAtual === 1 && !fechou.sequenciaPerdida);

  // As armadilhas de calendário: virada de mês, virada de ano, ano bissexto.
  const viradaDeMes = estadoDaSequencia(dia('2026-03-31'), 9, dia('2026-04-01'));
  confere('31 de março -> 1º de abril conta como o dia seguinte', viradaDeMes.diaAtual === 10 && !viradaDeMes.sequenciaPerdida);

  const viradaDeAno = estadoDaSequencia(dia('2026-12-31'), 2, dia('2027-01-01'));
  confere('31 de dezembro -> 1º de janeiro conta como o dia seguinte', viradaDeAno.diaAtual === 3 && !viradaDeAno.sequenciaPerdida);

  const bissexto = estadoDaSequencia(dia('2028-02-28'), 4, dia('2028-02-29'));
  confere('28 -> 29 de fevereiro num ano bissexto conta como o dia seguinte', bissexto.diaAtual === 5);

  const puloBissexto = estadoDaSequencia(dia('2027-02-28'), 4, dia('2027-03-01'));
  confere('28 de fevereiro -> 1º de março num ano comum conta como o dia seguinte', puloBissexto.diaAtual === 5);

  confere('diasEntre ignora a hora do dia', diasEntre(new Date('2026-03-09T23:59:00Z'), new Date('2026-03-10T00:01:00Z')) === 1);
}

console.log('\n--- 4. trinta dias seguidos: a sequência anda até o fim e recomeça ---');
{
  let ultima: Date | null = null;
  let ultimoDia = 0;
  const percorridos: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    const hoje = new Date(Date.UTC(2026, 4, 1 + i, 12));
    const e = estadoDaSequencia(ultima, ultimoDia, hoje);
    percorridos.push(e.diaAtual);
    ultima = hoje;
    ultimoDia = e.diaAtual;
  }
  const esperado = [...Array.from({ length: 30 }, (_, i) => i + 1), 1, 2];
  confere('trinta e dois dias seguidos percorrem 1..30 e voltam ao 1 e 2', percorridos.join(',') === esperado.join(','), percorridos.join(','));
  confere('nenhum marco foi pulado', [7, 14, 21, 30].every((d) => percorridos.includes(d) && ehMarco(d)));
}

// --- 5. contra o banco de verdade ---
async function contraOBanco() {
  console.log('\n--- 5. a coleta no banco: paga o valor certo, uma vez só ---');
  const db = new DatabaseService();
  await db.onModuleInit();
  const wallet = new WalletService(db);
  const servico = new RecompensasService(db, wallet);

  const id = `teste-recompensa-${Date.now()}`;
  await db.query(
    `INSERT INTO users (id, name, level, xp, vip_tier, role)
     VALUES ($1, 'Teste Recompensa', 1, 0, 'bronze', 'jogador')`,
    [id],
  );

  try {
    const antes = await servico.calendarioDe(id);
    confere('quem nunca coletou pode coletar, no dia 1', antes.podeColetar && antes.diaAtual === 1);

    const saldoAntes = await wallet.balanceOf(id);
    const r = await servico.coletar(id);
    const saldoDepois = await wallet.balanceOf(id);
    confere(
      `pagou ${r.premio.toLocaleString('pt-BR')} e o saldo subiu exatamente isso`,
      saldoDepois - saldoAntes === r.premio,
      `subiu ${saldoDepois - saldoAntes}`,
    );
    confere('o prêmio pago é o que o calendário anunciava', r.premio === antes.premioDeHoje, `anunciou ${antes.premioDeHoje}, pagou ${r.premio}`);
    confere('e ficou marcado como dia 1, sequência 1', r.dia === 1 && r.diasSeguidos === 1);

    const depois = await servico.calendarioDe(id);
    confere('agora não dá mais pra coletar hoje', !depois.podeColetar);

    let recusou = false;
    await servico.coletar(id).catch(() => { recusou = true; });
    confere('a segunda tentativa no mesmo dia é recusada', recusou);
    confere('e o saldo não mudou com a recusa', (await wallet.balanceOf(id)) === saldoDepois);

    // Dez pedidos AO MESMO TEMPO: é aqui que um `if` no meio do código deixaria passar.
    await db.query('UPDATE daily_rewards SET last_claim_on = CURRENT_DATE - 1 WHERE user_id = $1', [id]);
    const saldoAntesDaCorrida = await wallet.balanceOf(id);
    const resultados = await Promise.allSettled(Array.from({ length: 10 }, () => servico.coletar(id)));
    const pagaram = resultados.filter((x) => x.status === 'fulfilled');
    const creditado = (await wallet.balanceOf(id)) - saldoAntesDaCorrida;
    confere('dez coletas simultâneas: só uma foi aceita', pagaram.length === 1, `${pagaram.length} aceitas`);
    confere(
      'e o saldo subiu o valor de UMA coleta',
      pagaram.length === 1 && creditado === (pagaram[0] as PromiseFulfilledResult<{ premio: number }>).value.premio,
      `subiu ${creditado}`,
    );

    const extrato = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM ledger_entries WHERE user_id = $1 AND origin = 'recompensa-diaria'`,
      [id],
    );
    confere('o extrato tem exatamente dois presentes, um por coleta aceita', extrato[0].n === '2', `tem ${extrato[0].n}`);

    // A sequência caiu: volta pro dia 1 mesmo tendo coletado o dia 2.
    await db.query('UPDATE daily_rewards SET last_claim_on = CURRENT_DATE - 3 WHERE user_id = $1', [id]);
    const perdida = await servico.calendarioDe(id);
    confere('depois de três dias sem coletar, volta pro dia 1 e avisa', perdida.diaAtual === 1 && perdida.sequenciaPerdida);
  } finally {
    await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [id]);
    await db.query('DELETE FROM daily_rewards WHERE user_id = $1', [id]);
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    await db.onModuleDestroy();
  }
}

contraOBanco()
  .then(() => {
    console.log(falhas === 0 ? '\nOK: a recompensa diária paga o que anuncia, uma vez por dia.' : `\n${falhas} FALHA(S)`);
    process.exit(falhas === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.log('ERRO:', e.message);
    process.exit(1);
  });
