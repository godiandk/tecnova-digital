/**
 * A RECOMPENSA DIÁRIA DÁ O QUE ELA DIZ QUE DÁ, UMA VEZ POR DIA.
 *
 *   npm run verify:recompensas
 *
 * Cinco partes, e as duas últimas são onde erro custa dinheiro de verdade:
 *
 * 1. O CALENDÁRIO: o mês de verdade, cada dia valendo mais que o anterior, e o marco de
 *    fim de mês caindo no último dia SEJA ELE QUAL FOR.
 * 2. A ÂNCORA: o prêmio sai do NÍVEL e não do saldo — e é isso que desmonta a catraca de
 *    juros compostos que fazia um ano de coleta valer 102,3 quatrilhões de fichas.
 * 3. A SEQUÊNCIA, sem banco: coletou hoje, coletou ontem, faltou. É conta de calendário,
 *    e conta de calendário erra em silêncio — na virada do mês, no ano bissexto, no dia
 *    31 que o mês seguinte não tem.
 * 4. UM ANO INTEIRO percorrido dia a dia, atravessando fevereiro, bissexto e virada de ano.
 * 5. A COLETA EM SI, contra o banco de verdade: paga o valor certo, paga uma vez só mesmo
 *    com dez pedidos simultâneos, é idempotente por `claimId`, e não deixa nem marca sem
 *    pagamento nem pagamento sem marca.
 *
 * A parte 5 é a que importa mais. A proteção contra pagar duas vezes não está num `if` no
 * meio do código — está num índice único do banco, e a única forma de saber se ela
 * funciona é disparar os pedidos ao mesmo tempo e contar o dinheiro depois.
 */
import { DatabaseService } from '../../database/database.service';
import { WalletService } from '../wallet/wallet.service';
import { RecompensasService } from './recompensas.service';
import {
  TETO_DO_BONUS,
  bonusDeNivel,
  calendarioPara,
  casasDaGrade,
  ehMarco,
  estadoDaSequencia,
  multiplicadorDoDia,
  premioDoDia,
} from './calendario';
import { NIVEIS_DE_MESA } from '../games/shared/niveis-de-mesa';
import { diaSeguinte, diasDoMes } from '../../comum/dia-do-servidor';

let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

const BRONZE = NIVEIS_DE_MESA[0].minimo;

console.log('--- 1. o calendário é o MÊS DE VERDADE, não trinta dias fixos ---');
{
  for (const [hoje, esperado] of [['2024-02-10', 29], ['2023-02-10', 28], ['2025-04-10', 30], ['2025-07-10', 31]] as const) {
    const c = calendarioPara(1, hoje);
    confere(`${hoje.slice(0, 7)} tem ${esperado} casas`, c.length === esperado, `tem ${c.length}`);
    /*
     * O MARCO DE FIM DE MÊS CAI NO ÚLTIMO DIA, seja ele 28, 29, 30 ou 31. Antes o marco
     * era a chave `30` numa tabela à mão: em fevereiro nunca chegava, e em julho o dia 31
     * caía de volta na reta e pagava 70 no lugar de 500.
     */
    confere(
      `  e o marco de fim de mês cai no dia ${esperado}`,
      c[esperado - 1].marco && c[esperado - 1].premio === Math.max(...c.map((d) => d.premio)),
      `dia ${esperado} paga ${c[esperado - 1].premio}, o maior é ${Math.max(...c.map((d) => d.premio))}`,
    );
  }

  const c = calendarioPara(1, '2025-07-10');
  const marcos = c.filter((d) => d.marco).map((d) => d.dia);
  confere('os marcos de julho são 7, 14, 21 e 31', marcos.join(',') === '7,14,21,31', marcos.join(','));

  const quedas = c.filter((d, i) => i > 0 && d.premio <= c[i - 1].premio && !d.marco && !c[i - 1].marco);
  confere('o prêmio cresce todo dia', quedas.length === 0, `caiu nos dias ${quedas.map((d) => d.dia).join(',')}`);
  confere('todo marco paga mais que o dia anterior', c.filter((d) => d.marco).every((d) => d.premio > c[d.dia - 2].premio));
  confere('nenhum prêmio é fracionário', c.every((d) => Number.isInteger(d.premio)));
}

console.log('\n--- 2. a âncora é o NÍVEL, e é isso que mata a catraca ---');
{
  /*
   * A CATRACA, dita com número: o prêmio era `mínimo da mesa do SALDO ATUAL × multiplicador
   * do dia`. Coletar aumenta o saldo, saldo maior sobe o degrau, degrau maior aumenta o
   * prêmio do dia seguinte — juros compostos. Quem só coletasse, sem jogar UMA rodada,
   * chegava ao Eclipse em 171 dias e a 102,3 quatrilhões de fichas em um ano.
   *
   * A conferência que fecha isso é estrutural: `premioDoDia` não recebe saldo. Não existe
   * argumento pra passar, então não existe caminho pelo qual o saldo volte pra conta.
   */
  confere('premioDoDia não recebe saldo — o laço não tem por onde se fechar', premioDoDia.length === 3, `recebe ${premioDoDia.length} argumentos`);

  const umAno = (nivel: number) => {
    let total = 0;
    for (let mes = 0; mes < 12; mes += 1) for (let d = 1; d <= 30; d += 1) total += premioDoDia(d, nivel, 30);
    return total;
  };
  for (const nivel of [1, 100, 10_000]) {
    const total = umAno(nivel);
    console.log(`     um ano só coletando, nível ${nivel}: ${total.toLocaleString('pt-BR')} fichas`);
    confere(`  nível ${nivel}: um ano de coleta não passa de 5 milhões de fichas`, total < 5_000_000, `deu ${total.toLocaleString('pt-BR')}`);
  }

  // O bônus de nível: meia vez a mais por década, com teto.
  for (const [nivel, esperado] of [[1, 1], [10, 1.5], [100, 2], [1_000, 2.5], [10_000, 3]] as const) {
    confere(`  nível ${nivel} vale ${esperado.toFixed(2)}x`, Math.abs(bonusDeNivel(nivel) - esperado) < 1e-9, `deu ${bonusDeNivel(nivel)}`);
  }
  confere('  o bônus tem teto, e nível absurdo não passa dele', bonusDeNivel(1e12) === TETO_DO_BONUS);
  confere('  nível inválido cai no piso de 1x', bonusDeNivel(Number.NaN) === 1 && bonusDeNivel(-5) === 1 && bonusDeNivel(0) === 1);

  /*
   * O TETO DE 3x NÃO PODE ALCANÇAR A DISTÂNCIA ENTRE DEGRAUS, que é de 10x. Se
   * alcançasse, o nível voltaria a mexer em QUAL MESA a pessoa joga — que é trabalho do
   * `economicTier`, não da recompensa.
   */
  confere('o bônus máximo não chega perto de um degrau (10x)', TETO_DO_BONUS < 10);

  // O piso pra quem quebrou continua funcionando: o dia 1 paga pra sentar numa mesa Bronze.
  const primeiroDia = premioDoDia(1, 1, 30);
  confere(
    `quem zerou recebe ${primeiroDia.toLocaleString('pt-BR')} no dia 1 — ${primeiroDia / BRONZE} apostas mínimas de Bronze`,
    primeiroDia >= BRONZE * 10,
  );
}

console.log('\n--- 3. a sequência: coletou hoje, coletou ontem, faltou ---');
{
  const nunca = estadoDaSequencia(null, 0, '2026-03-10');
  confere('quem nunca coletou começa na casa 1, aberta', nunca.diaAtual === 1 && nunca.podeColetar);

  const hoje = estadoDaSequencia('2026-03-10', 5, '2026-03-10');
  confere('coletou hoje: fechado, ainda na casa 5', !hoje.podeColetar && hoje.diaAtual === 5);
  confere('e a próxima abertura é amanhã', hoje.proximaAbertura === '2026-03-11', hoje.proximaAbertura);

  const ontem = estadoDaSequencia('2026-03-09', 5, '2026-03-10');
  confere('coletou ontem: abre a casa 6', ontem.podeColetar && ontem.diaAtual === 6 && !ontem.sequenciaPerdida);

  const faltou = estadoDaSequencia('2026-03-08', 5, '2026-03-10');
  confere('faltou um dia: volta pra casa 1 e avisa', faltou.podeColetar && faltou.diaAtual === 1 && faltou.sequenciaPerdida);

  /*
   * A GRADE RECOMEÇA NO TAMANHO DO MÊS EM QUE SE ESTÁ. Março tem 31, então a casa 31 é a
   * última — e a seguinte é a 1.
   */
  const fechou = estadoDaSequencia('2026-03-30', 31, '2026-03-31');
  confere('fechada a grade de 31, a próxima casa é a 1', fechou.diaAtual === 1 && !fechou.sequenciaPerdida);

  const fevereiro = estadoDaSequencia('2026-02-27', 28, '2026-02-28');
  confere('em fevereiro a grade fecha na casa 28', fevereiro.diaAtual === 1 && !fevereiro.sequenciaPerdida);

  // As armadilhas de calendário: virada de mês, virada de ano, ano bissexto.
  confere('31 de março -> 1º de abril é o dia seguinte', estadoDaSequencia('2026-03-31', 9, '2026-04-01').diaAtual === 10);
  confere('31 de dezembro -> 1º de janeiro é o dia seguinte', estadoDaSequencia('2026-12-31', 2, '2027-01-01').diaAtual === 3);
  confere('28 -> 29 de fevereiro em ano bissexto é o dia seguinte', estadoDaSequencia('2028-02-28', 4, '2028-02-29').diaAtual === 5);
  confere('28 de fevereiro -> 1º de março em ano comum é o dia seguinte', estadoDaSequencia('2027-02-28', 4, '2027-03-01').diaAtual === 5);

  /*
   * O RELÓGIO ANDANDO PRA TRÁS não pode pagar de novo. Acontece em ajuste de NTP e em
   * migração de máquina, e a resposta segura é não pagar.
   */
  const futuro = estadoDaSequencia('2026-03-12', 5, '2026-03-10');
  confere('última coleta no futuro (relógio pra trás): não paga', !futuro.podeColetar);
}

console.log('\n--- 4. um ano inteiro, dia a dia ---');
{
  /*
   * Percorre 2024 (bissexto) inteiro coletando todo dia, e exige que a casa ande de 1 em
   * 1 sem buraco, que a grade recomece exatamente no tamanho de cada mês, e que a virada
   * do mês NUNCA quebre a sequência. É a conferência que pega o erro que só aparece em
   * fevereiro — o tipo que chega ao ar e some por onze meses.
   */
  let ultima: string | null = null;
  let ultimoDia = 0;
  let dia = '2024-01-01';
  let quebras = 0;
  let saltos = 0;
  const casasVistas = new Set<number>();
  for (let i = 0; i < 366; i += 1) {
    const e = estadoDaSequencia(ultima, ultimoDia, dia);
    if (e.sequenciaPerdida) quebras += 1;
    if (ultimoDia > 0 && e.diaAtual !== 1 && e.diaAtual !== ultimoDia + 1) saltos += 1;
    casasVistas.add(e.diaAtual);
    ultima = dia;
    ultimoDia = e.diaAtual;
    dia = diaSeguinte(dia);
  }
  confere('366 dias seguidos: a sequência nunca quebra', quebras === 0, `${quebras} quebras`);
  confere('e a casa nunca salta', saltos === 0, `${saltos} saltos`);
  confere('as casas de 1 a 31 foram todas visitadas', [...casasVistas].sort((a, b) => a - b).join(',') === Array.from({ length: 31 }, (_, i) => i + 1).join(','));

  // E o marco de fim de mês existe em todo mês do ano, com o número certo de casas.
  const semMarco = ['2024-01-15', '2024-02-15', '2024-04-15', '2024-12-15']
    .filter((d) => !ehMarco(diasDoMes(d), diasDoMes(d)) || casasDaGrade(d) !== diasDoMes(d));
  confere('todo mês tem marco no último dia', semMarco.length === 0, semMarco.join(','));
}

// --- 5. contra o banco de verdade ---
async function contraOBanco() {
  console.log('\n--- 5. a coleta no banco: paga o valor certo, uma vez só ---');
  const db = new DatabaseService();
  await db.onModuleInit();
  const wallet = new WalletService(db);
  const servico = new RecompensasService(db, wallet);

  const id = `teste-recompensa-${Date.now()}`;
  await db.query(`INSERT INTO users (id, name, level) VALUES ($1, 'Teste Recompensa', 100)`, [id]);

  const HOJE = '2026-05-10';
  /* O dia seguinte: é nele que a corrida de dez pedidos acontece. */
  const AMANHA = '2026-05-11';

  try {
    const antes = await servico.calendarioDe(id, HOJE);
    confere('quem nunca coletou pode coletar, na casa 1', antes.podeColetar && antes.diaAtual === 1);
    confere('o calendário já sai com o nível da pessoa', antes.nivel === 100 && antes.bonusDeNivel === 2);

    const saldoAntes = await wallet.balanceOf(id);
    const r = await servico.coletar(id, HOJE, 'claim-1');
    const saldoDepois = await wallet.balanceOf(id);
    confere(
      `pagou ${r.premio.toLocaleString('pt-BR')} e o saldo subiu exatamente isso`,
      saldoDepois - saldoAntes === r.premio,
      `subiu ${saldoDepois - saldoAntes}`,
    );
    confere('o prêmio pago é o que o calendário anunciava', r.premio === antes.premioDeHoje, `anunciou ${antes.premioDeHoje}, pagou ${r.premio}`);
    confere('e ficou marcado como casa 1, sequência 1', r.dia === 1 && r.diasSeguidos === 1);

    /*
     * IDEMPOTÊNCIA POR claimId: o MESMO pedido repetido devolve o MESMO resultado, e não
     * um erro. Do ponto de vista de quem tocou o botão duas vezes, a coleta deu certo —
     * mostrar "você já coletou" seria transformar um retry em uma má notícia.
     */
    const repetido = await servico.coletar(id, HOJE, 'claim-1').catch((e) => e as Error);
    confere(
      'o mesmo claimId devolve o mesmo prêmio, e não um erro',
      !(repetido instanceof Error) && repetido.premio === r.premio && repetido.repetida,
      repetido instanceof Error ? `lançou "${repetido.message}"` : '',
    );
    confere('e o saldo não mudou com o repetido', (await wallet.balanceOf(id)) === saldoDepois);

    // Um claimId DIFERENTE no mesmo dia é outra intenção — e essa tem que ser recusada.
    let recusou = false;
    await servico.coletar(id, HOJE, 'claim-2').catch(() => { recusou = true; });
    confere('um claimId novo no mesmo dia é recusado', recusou);
    confere('e o saldo não mudou com a recusa', (await wallet.balanceOf(id)) === saldoDepois);

    // Dez pedidos AO MESMO TEMPO, cada um com sua chave: é aqui que um `if` deixaria passar.
    const saldoAntesDaCorrida = await wallet.balanceOf(id);
    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => servico.coletar(id, AMANHA, `corrida-${i}`)),
    );
    const pagaram = resultados.filter((x) => x.status === 'fulfilled');
    const creditado = (await wallet.balanceOf(id)) - saldoAntesDaCorrida;
    confere('dez coletas simultâneas: só uma foi aceita', pagaram.length === 1, `${pagaram.length} aceitas`);
    confere(
      'e o saldo subiu o valor de UMA coleta',
      pagaram.length === 1 && creditado === (pagaram[0] as PromiseFulfilledResult<{ premio: number }>).value.premio,
      `subiu ${creditado}`,
    );

    /*
     * NEM MARCA SEM PAGAMENTO, NEM PAGAMENTO SEM MARCA. É a janela que existia: a linha
     * era marcada antes do crédito, fora de transação, e morrer no meio deixava a pessoa
     * marcada e sem receber. Agora as duas contagens têm que bater sempre.
     */
    const coletas = await db.query<{ n: string; soma: string }>(
      'SELECT COUNT(*)::text AS n, COALESCE(SUM(chips),0)::text AS soma FROM daily_reward_claims WHERE user_id = $1',
      [id],
    );
    const extrato = await db.query<{ n: string; soma: string }>(
      `SELECT COUNT(*)::text AS n, COALESCE(SUM(amount),0)::text AS soma
         FROM ledger_entries WHERE user_id = $1 AND origin = 'recompensa-diaria'`,
      [id],
    );
    confere('uma linha de coleta para cada presente no extrato', coletas[0].n === extrato[0].n, `${coletas[0].n} coletas, ${extrato[0].n} presentes`);
    confere('e a soma das duas bate', coletas[0].soma === extrato[0].soma, `${coletas[0].soma} vs ${extrato[0].soma}`);

    // O histórico guarda a conta, e não só o valor.
    const historico = await servico.historicoDe(id);
    confere('o histórico tem as duas coletas', historico.length === 2, `tem ${historico.length}`);
    confere(
      'e guarda nível, multiplicador e bônus de cada uma',
      historico.every((h) => h.nivel === 100 && h.bonusDeNivel === 2 && h.multiplicadorDoDia > 0),
    );
    confere(
      'o prêmio guardado é exatamente nível x multiplicador x âncora',
      historico.every((h) => h.premio === Math.round(BRONZE * h.multiplicadorDoDia * h.bonusDeNivel)),
    );

    /*
     * A MESMA CHAVE EM OUTRO DIA É OUTRO PEDIDO. Um cliente com uma chave fixa escrita no
     * código dele bateria na chave primária no segundo dia — e a transação inteira cairia,
     * entregando erro no lugar do prêmio. Compondo a chave guardada com o dia, o retry de
     * hoje continua sendo o mesmo pedido e o de amanhã é outro.
     */
    const doisDiasDepois = '2026-05-12';
    const comChaveReusada = await servico.coletar(id, doisDiasDepois, 'claim-1').catch((e) => e as Error);
    confere(
      'a mesma chave em outro dia coleta normalmente, e não estoura',
      !(comChaveReusada instanceof Error) && comChaveReusada.premio > 0 && !comChaveReusada.repetida,
      comChaveReusada instanceof Error ? `lançou "${comChaveReusada.message}"` : '',
    );

    // A sequência caiu: volta pra casa 1 mesmo tendo coletado a casa 2.
    const perdida = await servico.calendarioDe(id, '2026-05-20');
    confere('depois de dez dias sem coletar, volta pra casa 1 e avisa', perdida.diaAtual === 1 && perdida.sequenciaPerdida);
    confere('e a sequência mostrada zera', perdida.diasSeguidos === 0, `mostrou ${perdida.diasSeguidos}`);
  } finally {
    await db.query('DELETE FROM daily_reward_claims WHERE user_id = $1', [id]);
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
  .catch((erro) => {
    console.error('ERRO:', erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
