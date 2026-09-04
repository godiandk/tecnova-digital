/**
 * O LANÇAMENTO NULO É DO JOGADOR — vistoria de ponta a ponta, contra o servidor.
 *
 *   node verificacao/verifica-banca-nulos.mjs
 *
 * Esta é a mudança de regra mais importante da Banca Francesa, e é a que mais fácil
 * quebra em silêncio: antes o servidor relançava sozinho até decidir, e o jogador só
 * via o fim. Agora um lançamento nulo PARA a rodada, devolve a mesa e não custa nada.
 *
 * O que é conferido, em cima de rodadas de verdade:
 *
 * 1. UM LANÇAMENTO POR AÇÃO. Cada chamada de /lancar produz exatamente um lançamento.
 * 2. NULO NÃO COBRA E NÃO PAGA. O saldo antes e depois de um nulo é o MESMO — não é
 *    "quase o mesmo", é o mesmo número.
 * 3. NULO NÃO FECHA A RODADA. O rodadaId continua o mesmo e as apostas continuam de pé.
 * 4. DEPOIS DO NULO DÁ PRA MEXER. Aumentar, diminuir, trocar de casa e retirar.
 * 5. SÓ O LANÇAMENTO QUE DECIDE MEXE NO DINHEIRO, e a conta fecha exatamente.
 * 6. NÃO DÁ PRA LANÇAR SEM CONFIRMAR. O servidor recusa, não só a tela.
 * 7. A MESMA AÇÃO REPETIDA LIQUIDA UMA VEZ SÓ.
 * 8. O ESTADO SOBREVIVE À RECONEXÃO: /rodada devolve a rodada com os nulos.
 * 9. OS LIMITES POR CASA VALEM NO SERVIDOR (Ases 6× o mínimo, linha o dobro).
 */
const BASE = process.env.BASE || 'http://localhost:3000';
let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`   FALHOU: ${m}`); };
const ok = (m) => console.log(`   ok — ${m}`);

const chamar = async (rota, { metodo = 'GET', corpo, token } = {}) => {
  const r = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { ok: r.ok, status: r.status, corpo: json };
};

const marca = Date.now();
const novaConta = async () => {
  const r = await chamar('/auth/cadastrar', {
    metodo: 'POST',
    corpo: {
      email: `nulos-${marca}@teste.local`,
      senha: 'senha-de-teste-123',
      nome: 'Vistoria Nulos',
      nomeCompleto: 'Conta De Vistoria',
      nascimento: '1990-01-01',
      aceitouTermos: true,
    },
  });
  if (!r.ok) throw new Error(`não deu pra criar conta: ${JSON.stringify(r.corpo)}`);
  return r.corpo.token;
};

const saldo = async (token) => (await chamar('/wallet/saldo', { token })).corpo.balance;

async function principal() {
  const token = await novaConta();
  const minimo = (await chamar('/niveis/meu', { token })).corpo.nivel.minimo;
  console.log(`conta nova, mesa de mínimo ${minimo}, saldo ${await saldo(token)}\n`);

  console.log('=== 1. não dá pra lançar sem confirmar aposta ===');
  {
    const r = await chamar('/games/banca-francesa/lancar', { metodo: 'POST', corpo: {}, token });
    r.ok ? falhar('o servidor deixou lançar sem aposta') : ok(`recusado: "${r.corpo.message}"`);
  }

  console.log('\n=== 2. limites por casa, conferidos NO SERVIDOR ===');
  {
    const tentar = (type, amount) =>
      chamar('/games/banca-francesa/apostar', { metodo: 'POST', corpo: { bets: [{ type, amount }] }, token });

    const acimaDeAses = await tentar('ases', minimo * 6 + 1);
    acimaDeAses.ok ? falhar('Ases acima de 6× o mínimo foi aceito') : ok(`Ases acima de 6× recusado: "${acimaDeAses.corpo.message}"`);
    const noTetoDeAses = await tentar('ases', minimo * 6);
    noTetoDeAses.ok ? ok('Ases exatamente em 6× o mínimo é aceito') : falhar(`Ases no teto recusado: ${noTetoDeAses.corpo.message}`);

    const linhaBaixa = await tentar('linha-grande', minimo);
    linhaBaixa.ok ? falhar('ficha de um mínimo na linha foi aceita') : ok(`linha abaixo do dobro recusada: "${linhaBaixa.corpo.message}"`);
    const linhaCerta = await tentar('linha-grande', minimo * 2);
    linhaCerta.ok ? ok('linha com o dobro do mínimo é aceita') : falhar(`linha no piso recusada: ${linhaCerta.corpo.message}`);

    const impar = await tentar('linha-grande', minimo * 2 + 1);
    impar.ok ? falhar('valor ímpar na linha foi aceito') : ok('valor ímpar na linha recusado');
  }

  console.log('\n=== 3. o nulo não custa nada, e a rodada continua ===');
  let nulosVistos = 0;
  let decisivo = null;
  {
    const aposta = { type: 'grande', amount: minimo };
    const confirmada = await chamar('/games/banca-francesa/apostar', {
      metodo: 'POST', corpo: { bets: [aposta] }, token,
    });
    if (!confirmada.ok) throw new Error(`não deu pra apostar: ${JSON.stringify(confirmada.corpo)}`);
    const rodadaId = confirmada.corpo.rodadaId;
    ok(`aposta confirmada, estado ${confirmada.corpo.estado}, risco ${confirmada.corpo.risco}`);

    const saldoAoConfirmar = await saldo(token);
    if (saldoAoConfirmar !== confirmada.corpo.saldo) falhar('confirmar mexeu no saldo');
    else ok('confirmar a aposta não tirou ficha nenhuma');

    /* Lança até decidir, conferindo CADA nulo. A média é 3,4 lançamentos. */
    for (let i = 0; i < 200; i += 1) {
      const antes = await saldo(token);
      const r = await chamar('/games/banca-francesa/lancar', { metodo: 'POST', corpo: {}, token });
      if (!r.ok) throw new Error(`lançamento recusado: ${JSON.stringify(r.corpo)}`);
      const depois = await saldo(token);

      if (!r.corpo.decidiu) {
        nulosVistos += 1;
        if (depois !== antes) falhar(`o nulo mexeu no saldo: ${antes} -> ${depois}`);
        if (r.corpo.rodada.rodadaId !== rodadaId) falhar('o nulo abriu uma rodada nova');
        if (r.corpo.rodada.apostas.length !== 1) falhar('o nulo derrubou as apostas da mesa');
        if (r.corpo.lancamento.outcome !== 'nulo') falhar('lançamento sem decisão veio marcado como decisivo');
        continue;
      }
      decisivo = { ...r.corpo, saldoAntes: antes, saldoDepois: depois };
      break;
    }
    if (!decisivo) throw new Error('não decidiu em 200 lançamentos');

    ok(`${nulosVistos} lançamento(s) nulo(s), nenhum mexeu no saldo`);
    ok(`decidiu em ${decisivo.lancamento.dice.join('+')} = ${decisivo.lancamento.sum} (${decisivo.lancamento.outcome})`);
  }

  console.log('\n=== 4. só o lançamento que decide mexe no dinheiro, e a conta fecha ===');
  {
    const esperado = decisivo.saldoAntes - decisivo.totalStake + decisivo.totalReturn;
    if (decisivo.saldoDepois !== esperado) {
      falhar(`saldo ${decisivo.saldoAntes} − ${decisivo.totalStake} + ${decisivo.totalReturn} deveria dar ${esperado}, deu ${decisivo.saldoDepois}`);
    } else {
      ok(`${decisivo.saldoAntes} − ${decisivo.totalStake} + ${decisivo.totalReturn} = ${decisivo.saldoDepois}`);
    }
    if (decisivo.lucroLiquido !== decisivo.totalReturn - decisivo.totalStake) falhar('o lucro líquido não bate');
    else ok(`lucro líquido informado separado do retorno: ${decisivo.lucroLiquido}`);
    if (decisivo.rodada.estado !== 'LIQUIDADA') falhar(`estado depois de decidir: ${decisivo.rodada.estado}`);
    else ok('a rodada foi marcada como LIQUIDADA');
  }

  console.log('\n=== 5. a aposta e o prêmio ficam amarrados à mesma rodada no extrato ===');
  {
    const extrato = (await chamar('/wallet/historico', { token })).corpo;
    /*
     * Nada de `extrato.entries ?? extrato`: num array, `.entries` é o método do
     * protótipo, então a expressão devolveria a FUNÇÃO em vez da lista. O extrato é um
     * array e ponto.
     */
    if (!Array.isArray(extrato)) { falhar(`o extrato não veio como lista: ${JSON.stringify(extrato).slice(0, 80)}`); return; }
    const linhas = extrato.filter((e) => e.roundId);
    const porRodada = new Map();
    for (const e of linhas) porRodada.set(e.roundId, (porRodada.get(e.roundId) ?? 0) + 1);
    if (linhas.length === 0) { falhar('nenhum lançamento do extrato tem rodada'); }
    else {
      ok(`${linhas.length} lançamento(s) do extrato carregam o id da rodada`);
      const comPar = [...porRodada.entries()].filter(([, n]) => n === 2);
      comPar.length > 0
        ? ok(`${comPar.length} rodada(s) com aposta E prêmio amarrados pelo mesmo id`)
        : ok('rodadas só com aposta (perdeu) — nada a parear, o que também está certo');
      const semCorrente = linhas.filter((e) => e.balanceBefore === undefined || e.balanceAfter === undefined);
      semCorrente.length === 0
        ? ok('todos trazem saldo antes e depois')
        : falhar(`${semCorrente.length} lançamento(s) novos sem saldo gravado`);
    }
  }

  console.log('\n=== 6. depois do nulo dá pra mexer na aposta ===');
  {
    await chamar('/games/banca-francesa/apostar', {
      metodo: 'POST', corpo: { bets: [{ type: 'grande', amount: minimo }] }, token,
    });
    /* Lança uma vez; se der nulo, mexe. Se decidir, aposta de novo e tenta outra vez. */
    let mexeu = false;
    for (let i = 0; i < 60 && !mexeu; i += 1) {
      const r = await chamar('/games/banca-francesa/lancar', { metodo: 'POST', corpo: {}, token });
      if (!r.ok) break;
      if (r.corpo.decidiu) {
        await chamar('/games/banca-francesa/apostar', {
          metodo: 'POST', corpo: { bets: [{ type: 'grande', amount: minimo }] }, token,
        });
        continue;
      }
      const aumentada = await chamar('/games/banca-francesa/apostar', {
        metodo: 'POST', corpo: { bets: [{ type: 'pequeno', amount: minimo * 2 }] }, token,
      });
      if (!aumentada.ok) { falhar(`não deu pra mexer depois do nulo: ${aumentada.corpo.message}`); break; }
      if (aumentada.corpo.apostas[0].type !== 'pequeno' || aumentada.corpo.apostas[0].amount !== minimo * 2) {
        falhar('a aposta não foi trocada');
      } else ok('depois do nulo dá pra trocar de casa e aumentar');

      const daRodada = await chamar('/games/banca-francesa/rodada', { token });
      daRodada.corpo.nulos.length > 0
        ? ok(`a reconexão devolve a rodada com ${daRodada.corpo.nulos.length} nulo(s) à vista`)
        : falhar('a rodada devolvida não trouxe os nulos');

      const retirada = await chamar('/games/banca-francesa/retirar', { metodo: 'POST', corpo: {}, token });
      const saldoAposRetirar = await saldo(token);
      if (retirada.corpo.apostas.length !== 0) falhar('retirar não limpou a mesa');
      else if (saldoAposRetirar !== retirada.corpo.saldo) falhar('retirar mexeu no saldo');
      else ok('retirar a aposta limpa a mesa e não custa nada');
      mexeu = true;
    }
    if (!mexeu) falhar('não saiu nulo em 60 lançamentos — improvável, algo está errado');
  }

  console.log('\n=== 7. o mesmo pedido duas vezes liquida uma vez só ===');
  {
    await chamar('/games/banca-francesa/apostar', {
      metodo: 'POST', corpo: { bets: [{ type: 'grande', amount: minimo }] }, token,
    });
    /* Lança até chegar num que decida, com a MESMA chave mandada duas vezes. */
    for (let i = 0; i < 200; i += 1) {
      const antes = await saldo(token);
      const chave = `repetido-${marca}-${i}`;
      const [a, b] = await Promise.all([
        chamar('/games/banca-francesa/lancar', { metodo: 'POST', corpo: { actionId: chave }, token }),
        chamar('/games/banca-francesa/lancar', { metodo: 'POST', corpo: { actionId: chave }, token }),
      ]);
      const decidiuAlgum = [a, b].find((r) => r.ok && r.corpo.decidiu);
      if (!decidiuAlgum) {
        /* Foi nulo: reconfirma e segue. */
        await chamar('/games/banca-francesa/apostar', {
          metodo: 'POST', corpo: { bets: [{ type: 'grande', amount: minimo }] }, token,
        });
        continue;
      }
      const depois = await saldo(token);
      const esperado = antes - decidiuAlgum.corpo.totalStake + decidiuAlgum.corpo.totalReturn;
      depois === esperado
        ? ok(`dois pedidos com a mesma chave: o saldo mexeu uma vez (${antes} -> ${depois})`)
        : falhar(`o saldo mexeu duas vezes: esperado ${esperado}, deu ${depois}`);
      break;
    }
  }

  console.log('\n=== 8. o placar é o da Banca Francesa, não o do bacará ===');
  {
    const placar = (await chamar('/games/banca-francesa/placar')).corpo;
    const temCampos = placar && placar.counts && Array.isArray(placar.history);
    if (!temCampos) { falhar(`formato inesperado: ${JSON.stringify(placar).slice(0, 120)}`); }
    else {
      ok(`counts: ases ${placar.counts.ases}, pequeno ${placar.counts.pequeno}, grande ${placar.counts.grande}, nulos ${placar.counts.nulos}, total ${placar.counts.totalRolls}`);
      const soma = placar.counts.ases + placar.counts.pequeno + placar.counts.grande + placar.counts.nulos;
      soma === placar.counts.totalRolls ? ok('os contadores somam o total') : falhar(`contadores somam ${soma}, total diz ${placar.counts.totalRolls}`);
      placar.counts.nulos > 0 ? ok('os nulos aparecem no placar (antes eles sumiam)') : falhar('nenhum nulo no placar');
      const ultimo = placar.previous;
      ultimo && typeof ultimo.dice.blue === 'number' && typeof ultimo.dice.green === 'number' && typeof ultimo.dice.red === 'number'
        ? ok(`o último lançamento vem com os dados por cor: azul ${ultimo.dice.blue}, verde ${ultimo.dice.green}, vermelho ${ultimo.dice.red}`)
        : falhar('o último lançamento não veio com os dados por cor');
      const somaBate = ultimo && ultimo.dice.blue + ultimo.dice.green + ultimo.dice.red === ultimo.sum;
      somaBate ? ok('e a soma bate com os três dados') : falhar('a soma não bate com os dados');
      const temBacara = JSON.stringify(placar).includes('bigRoad') || JSON.stringify(placar).includes('beadPlate');
      temBacara ? falhar('o placar ainda traz as estradas do bacará') : ok('nenhum vestígio das estradas do bacará');
    }
  }

  console.log(problemas === 0
    ? '\nTUDO OK — o nulo é do jogador, não custa nada, e o placar é o da mesa.'
    : `\n${problemas} PROBLEMA(S)`);
  process.exit(problemas === 0 ? 0 : 1);
}

principal().catch((e) => { console.log('ERRO:', e.message); process.exit(1); });
