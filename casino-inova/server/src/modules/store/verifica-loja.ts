import { DatabaseService } from '../../database/database.service';
import { WalletService } from '../wallet/wallet.service';
import { DegrauDoJogador } from '../games/shared/degrau-do-jogador.service';
import { StoreService } from './store.service';
import { Promocoes } from './promocoes';
import { MOEDAS, PRECOS, escreverPreco, fichasDoPacote } from './pacotes';
import { NIVEIS_DE_MESA } from '../games/shared/niveis-de-mesa';
import { bonusDeNivel } from '../recompensas/calendario';

/**
 * A LOJA ENTREGA O QUE ANUNCIA, E NÃO VIRA UMA CATRACA.
 *
 *   npm run verify:loja
 *
 * Quatro perguntas, e a terceira é a que custa dinheiro de verdade:
 *
 * 1. O pacote vale a MESMA COISA EM RODADAS em todo degrau. Era o defeito: o maior pacote
 *    comprava uma banca inteira no Bronze e NEM UMA APOSTA no Rubi.
 * 2. Comprar não sobe de mesa. Com o degrau econômico travado pelo nível, a espiral
 *    "compra -> saldo -> degrau -> pacote maior" não fecha.
 * 3. A compra é idempotente e o valor nunca vem de fora: reentrega do provedor não
 *    credita duas vezes, e a quantidade de fichas é calculada aqui.
 * 4. A promoção tem prazo de verdade, respeita o limite por pessoa, e não empilha.
 */
let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

console.log('--- 1. o pacote vale as mesmas rodadas em todo degrau ---');
{
  for (const [id, preco] of Object.entries(PRECOS)) {
    const emCadaDegrau = NIVEIS_DE_MESA.map((n) => fichasDoPacote(preco.k, n, 1) / n.minimo);
    const iguais = emCadaDegrau.every((r) => r === preco.k);
    confere(`pacote ${id}: ${preco.k} apostas mínimas nos 12 degraus`, iguais, emCadaDegrau.join(', '));
  }

  /*
   * O NÚMERO QUE OBRIGOU A MUDANÇA: com a tabela antiga (números fixos), o maior pacote —
   * 120.000 fichas por R$ 149,90 — comprava isto:
   */
  const ANTIGO_MAIOR = 120_000;
  const rubi = NIVEIS_DE_MESA[4];
  console.log(
    `     [antes] 120.000 fichas fixas compravam ${Math.floor(ANTIGO_MAIOR / NIVEIS_DE_MESA[0].minimo)} apostas no Bronze ` +
      `e ${Math.floor(ANTIGO_MAIOR / rubi.minimo)} no ${rubi.nome}`,
  );
  confere('[antes] o maior pacote não comprava nem uma aposta no Rubi', Math.floor(ANTIGO_MAIOR / rubi.minimo) === 0);
  confere(
    `[agora] compra ${PRECOS.diamante.k} apostas no ${rubi.nome}`,
    fichasDoPacote(PRECOS.diamante.k, rubi, 1) / rubi.minimo === PRECOS.diamante.k,
  );

  // E no Bronze nada mudou pra quem já jogava — foi assim que o `k` foi calibrado.
  const bronze = NIVEIS_DE_MESA[0];
  const deAntes: Record<string, number> = { bronze: 5_000, prata: 15_000, ouro: 40_000, diamante: 120_000 };
  for (const [id, preco] of Object.entries(PRECOS)) {
    confere(`no Bronze o pacote ${id} continua dando ${deAntes[id].toLocaleString('pt-BR')}`, fichasDoPacote(preco.k, bronze, 1) === deAntes[id]);
  }
}

console.log('\n--- 2. o bônus de nível é o mesmo da recompensa, e tem teto ---');
{
  const bronze = NIVEIS_DE_MESA[0];
  for (const [nivel, esperado] of [[1, 1], [10, 1.5], [100, 2], [1_000, 2.5], [10_000, 3]] as const) {
    confere(
      `  nível ${nivel}: ${esperado}x`,
      fichasDoPacote(100, bronze, nivel) === Math.round(100 * bronze.minimo * esperado),
      `deu ${fichasDoPacote(100, bronze, nivel)}`,
    );
  }
  /*
   * O TETO DE 3x NÃO PODE ALCANÇAR A DISTÂNCIA ENTRE DEGRAUS (10x). Se alcançasse, um
   * nível alto compraria, no degrau de baixo, mais fichas do que o degrau de cima entrega —
   * e o pacote deixaria de ser proporcional à mesa.
   */
  confere('o bônus máximo não chega a um degrau', bonusDeNivel(1e9) < 10);
  confere('nenhum pacote sai fracionário', Object.values(PRECOS).every((p) =>
    NIVEIS_DE_MESA.every((n) => Number.isInteger(fichasDoPacote(p.k, n, 7)))));
}

console.log('\n--- 3. moedas: três tabelas, e nenhuma conversão de câmbio ---');
{
  for (const moeda of MOEDAS) {
    const faltando = Object.entries(PRECOS).filter(([, p]) => !Number.isInteger(p.precos[moeda]) || p.precos[moeda] <= 0);
    confere(`${moeda}: os quatro pacotes têm preço inteiro em centavos`, faltando.length === 0, faltando.map(([id]) => id).join(','));
  }
  confere('R$ 9,90 é escrito assim', escreverPreco(990, 'BRL') === 'R$ 9,90', escreverPreco(990, 'BRL'));
  confere('US$ 1,99 é escrito assim', escreverPreco(199, 'USD') === 'US$ 1.99', escreverPreco(199, 'USD'));
  /*
   * OS PREÇOS CRESCEM JUNTO COM O `k` — um pacote maior não pode custar menos por aposta
   * mínima do que um menor, senão o pacote pequeno vira uma armadilha pra quem tem pouco.
   */
  for (const moeda of MOEDAS) {
    const porAposta = Object.values(PRECOS).map((p) => p.precos[moeda] / p.k);
    const decrescente = porAposta.every((v, i) => i === 0 || v <= porAposta[i - 1] + 1e-9);
    confere(`${moeda}: o pacote maior nunca sai mais caro por aposta`, decrescente, porAposta.map((v) => v.toFixed(3)).join(' > '));
  }
}

// --- 4. contra o banco ---
async function contraOBanco() {
  console.log('\n--- 4. a compra no banco: uma vez só, e o valor sai daqui ---');
  const db = new DatabaseService();
  await db.onModuleInit();
  const wallet = new WalletService(db);
  const degraus = new DegrauDoJogador(db, wallet);
  const promocoes = new Promocoes(db);
  const loja = new StoreService(wallet, db, degraus, promocoes);

  const id = `teste-loja-${Date.now()}`;
  await db.query(`INSERT INTO users (id, name, level) VALUES ($1, 'Teste Loja', 100)`, [id]);

  try {
    const vitrine = loja.listPackages('BRL');
    confere('a vitrine pública é a do Bronze — o que uma conta nova recebe', vitrine.every((p) => p.degrau.id === 'bronze'));

    const minha = await loja.lojaDe(id, 'BRL');
    confere('a loja da pessoa usa o degrau econômico dela', minha.every((p) => p.degrau.id === 'bronze'), minha[0].degrau.id);
    confere('e aplica o bônus do nível 100 (2x)', minha[0].chips === 100 * 50 * 2, `deu ${minha[0].chips}`);
    confere('e diz quantas apostas mínimas isso compra', minha[0].apostasMinimas === 200, `${minha[0].apostasMinimas}`);

    // A compra credita, e a reentrega do provedor NÃO credita de novo.
    const antes = await wallet.balanceOf(id);
    const compra = { eventoId: 'evt-1', userId: id, pacoteId: 'bronze', precoEmCentavos: 990, moeda: 'BRL', porta: 'revenuecat' as const };
    const r1 = await loja.fulfillPurchase(compra);
    const depoisDaPrimeira = await wallet.balanceOf(id);
    confere('a compra credita o que a loja anunciava', depoisDaPrimeira - antes === minha[0].chips, `creditou ${depoisDaPrimeira - antes}`);
    confere('e o pacote comprado é o do degrau, não um número fixo', r1.chips === minha[0].chips);

    const r2 = await loja.fulfillPurchase(compra);
    confere('a reentrega do mesmo evento não credita de novo', r2.repetido && (await wallet.balanceOf(id)) === depoisDaPrimeira);

    /*
     * A COMPRA GUARDA O QUE EXPLICAVA O TAMANHO DO PACOTE. Sem isso, "por que este pacote
     * veio com 10.000 fichas?" seis meses depois não tem resposta: o degrau e o nível
     * mudaram, e recalcular daria outro número.
     */
    const historico = await loja.historicoDe(id);
    confere('a compra guarda degrau, nível, preço e porta', historico[0].degrau === 'bronze' && historico[0].nivel === 100
      && historico[0].preco === 'R$ 9,90' && historico[0].porta === 'revenuecat');

    // --- promoção ---
    await db.query(
      `INSERT INTO store_promotions (promotion_id, nome, starts_at, ends_at, bonus_percent, package_ids, purchase_limit)
       VALUES ('promo-teste','Semana de teste','2026-01-01','2999-12-31',50,ARRAY['bronze'],1)`,
    );
    const comPromocao = await loja.lojaDe(id, 'BRL');
    confere('a promoção aparece no pacote em que vale', comPromocao[0].promocao?.id === 'promo-teste');
    confere('e acrescenta 50% de fichas', comPromocao[0].chips === minha[0].chips + Math.floor(minha[0].chips / 2), `deu ${comPromocao[0].chips}`);
    confere('e não vaza pros outros pacotes', comPromocao[1].promocao === undefined);
    confere('a tela recebe a DATA de fim, não um cronômetro', comPromocao[0].promocao?.terminaEm === '2999-12-31');

    const saldoAntesDaPromo = await wallet.balanceOf(id);
    await loja.fulfillPurchase({ ...compra, eventoId: 'evt-2' });
    confere(
      'comprar com promoção credita o pacote mais o bônus',
      (await wallet.balanceOf(id)) - saldoAntesDaPromo === comPromocao[0].chips,
    );

    /*
     * O LIMITE POR PESSOA É TETO, E NÃO GATILHO: ele existe pra impedir que uma promoção
     * boa vire porta de inflação, e não pra empurrar ninguém a comprar antes que acabe.
     */
    const depoisDoLimite = await loja.lojaDe(id, 'BRL');
    confere('gasto o limite por pessoa, a promoção some pra ela', depoisDoLimite[0].promocao === undefined);

    // Promoção fora da janela não vale, mesmo ativa.
    await db.query(`UPDATE store_promotions SET ends_at = '2026-01-02', purchase_limit = NULL WHERE promotion_id = 'promo-teste'`);
    confere('promoção com prazo vencido não aparece', (await promocoes.valendoHoje('2026-06-01')).length === 0);
    confere('e dentro do prazo, aparece', (await promocoes.valendoHoje('2026-01-01')).length === 1);
  } finally {
    await db.query(`DELETE FROM store_promotions WHERE promotion_id = 'promo-teste'`);
    await db.query('DELETE FROM purchases WHERE user_id = $1', [id]);
    await db.query('DELETE FROM ledger_entries WHERE user_id = $1', [id]);
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    await db.onModuleDestroy();
  }
}

contraOBanco()
  .then(() => {
    console.log(falhas === 0 ? '\nOK: a loja entrega o que anuncia, e não vira catraca.' : `\n${falhas} FALHA(S)`);
    process.exit(falhas === 0 ? 0 : 1);
  })
  .catch((erro) => {
    console.error('ERRO:', erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
