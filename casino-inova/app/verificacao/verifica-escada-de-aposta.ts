/**
 * PROVA QUE DÁ PRA CHEGAR NA APOSTA EM DOIS OU TRÊS TOQUES.
 *
 * O produto pediu isso com número: *"o usuário precisa conseguir chegar à aposta desejada
 * em aproximadamente 2–3 interações"*. Promessa com número é promessa que se mede — e a
 * medida aqui é uma busca em largura sobre os movimentos que a tela REALMENTE oferece, e
 * não sobre um caminho teórico.
 *
 * Também prova as duas coisas que, se falharem, transformam o seletor num gerador de erro:
 * nunca abaixo do mínimo da mesa, nunca acima do saldo, e sempre inteiro.
 *
 * O ts-node mora no servidor:
 *   cd ../server && npx ts-node ../app/verificacao/verifica-escada-de-aposta.ts
 */
import { strict as assert } from 'node:assert';

import {
  ajustar, apostaInicial, atalhos, dobrar, metade, movimentosDe, podeApostar,
  toquesPara, tudo, type FaixaDeAposta,
} from '../src/aposta/escada';
import { degrauEconomicoPara, degrauPara, faixaPara } from '../src/aposta/degrau';
/* O servidor, de verdade: é contra ELE que a conta do cliente é comparada. */
import {
  NIVEIS_DE_MESA,
  NIVEL_PARA_ABRIR_O_DEGRAU,
  degrauEconomico,
  problemaComAAposta,
} from '../../server/src/modules/games/shared/niveis-de-mesa';

let passaram = 0;
let falharam = 0;

function confere(oQue: string, teste: () => void): void {
  try {
    teste();
    passaram += 1;
    console.log(`  ok   ${oQue}`);
  } catch (erro) {
    falharam += 1;
    console.log(`  FALHOU  ${oQue}`);
    console.log(`         ${(erro as Error).message.split('\n')[0]}`);
  }
}

/**
 * A escada como o servidor a PUBLICA em `/niveis/escada`: cada degrau com o nível que o
 * abre. É contra ela que a conta do aplicativo é comparada — e é ela que o aplicativo
 * recebe de verdade, então a conferência mede o mesmo dado que a tela usa.
 */
const escadaComNivel = NIVEIS_DE_MESA.map((n, i) => ({
  ...n,
  abreNoLevel: NIVEL_PARA_ABRIR_O_DEGRAU[i] ?? null,
}));

/** Um degrau como o servidor entrega: fichas = mínimo × [1, 2, 5, 10, 20]. */
function degrau(minimo: number, saldo: number): FaixaDeAposta {
  return { minimo, saldo, fichas: [1, 2, 5, 10, 20].map((m) => minimo * m) };
}

/*
 * Os doze degraus de verdade: Bronze (50) e depois entrada 5×10^(i+3) com mínimo = entrada/100.
 * São eles que fazem o problema existir — o mínimo vai de 50 até 5 quatrilhões.
 */
const DEGRAUS = [50, ...Array.from({ length: 11 }, (_, i) => (5 * 10 ** (i + 4)) / 100)];

console.log('\nA ESCADA DA APOSTA\n');

console.log('Onde ela abre');

confere('abre no MÍNIMO da mesa, não num número inventado', () => {
  /* O defeito original: `useState(100)` numa mesa cujo mínimo é 500 milhões. */
  const alta = degrau(500_000_000, 10_000_000_000);
  assert.equal(apostaInicial(alta), 500_000_000);
});

confere('abre no mínimo em TODOS os doze degraus', () => {
  for (const minimo of DEGRAUS) {
    const faixa = degrau(minimo, minimo * 100);
    assert.equal(apostaInicial(faixa), minimo, `degrau de mínimo ${minimo}`);
  }
});

confere('sem saldo pro mínimo, não existe aposta — e isso é dito, não escondido', () => {
  const faixa = degrau(500_000_000, 1_000);
  assert.equal(podeApostar(faixa), false);
  assert.equal(apostaInicial(faixa), 0);
  assert.deepEqual(atalhos(faixa), [], 'não pode oferecer ficha que a pessoa não paga');
  assert.deepEqual(movimentosDe(faixa), []);
});

console.log('\nDois ou três toques — a promessa medida');

confere('toda ficha do degrau está a UM toque', () => {
  for (const minimo of DEGRAUS) {
    const faixa = degrau(minimo, minimo * 1000);
    for (const ficha of atalhos(faixa)) {
      const toques = toquesPara(faixa, ficha);
      assert.ok(toques <= 1, `ficha ${ficha} do degrau ${minimo} exigiu ${toques} toques`);
    }
  }
});

confere('"tudo" está a UM toque, em todos os degraus', () => {
  for (const minimo of DEGRAUS) {
    const faixa = degrau(minimo, minimo * 137 + 9);
    assert.ok(toquesPara(faixa, tudo(faixa)) <= 1, `degrau ${minimo}`);
  }
});

confere('os valores entre as fichas chegam em até TRÊS toques', () => {
  /*
   * As fichas dão 1, 2, 5, 10 e 20 vezes o mínimo. O que interessa é o que fica ENTRE
   * elas — 4, 40, 80 —, que é onde um seletor de passo fixo obrigaria a dezenas de
   * toques. Com dobrar e metade, cada um destes sai em dois ou três.
   */
  const minimo = 500_000_000;
  const faixa = degrau(minimo, minimo * 10_000);
  for (const vezes of [4, 8, 40, 80, 2.5]) {
    const alvo = Math.floor(minimo * vezes);
    const toques = toquesPara(faixa, alvo);
    assert.ok(toques <= 3, `${vezes}× o mínimo exigiu ${toques} toques`);
  }
});

confere('o limite conhecido: 16× o mínimo exige QUATRO toques', () => {
  /*
   * ISTO É UM LIMITE REGISTRADO, NÃO UM TESTE QUE PASSOU DE RASPÃO.
   *
   * 16 é 2⁴ a partir da base, e não existe ficha em 4× nem em 8× — então o caminho mais
   * curto é ficha 2× e três dobros. Quatro toques.
   *
   * Ficou assim de propósito: a alternativa seria encher a tela de fichas até nenhum
   * número ficar longe, e aí o seletor vira uma calculadora. A promessa que o produto
   * pediu — chegar rápido na APOSTA DESEJADA — vale para as fichas do degrau e para o
   * tudo, que são o que as pessoas de fato escolhem, e essas estão a um toque.
   *
   * Se um dia 16× virar um valor procurado, a resposta é acrescentar uma ficha, não
   * afrouxar este número. O teste está aqui para que a mudança seja deliberada.
   */
  const minimo = 500_000_000;
  const faixa = degrau(minimo, minimo * 10_000);
  assert.equal(toquesPara(faixa, minimo * 16), 4);
});

confere('o pior caso do jogo real: 100 até 500 milhões', () => {
  /*
   * O número que motivou tudo. Com o `+` de 50 em 50 partindo de 100 seriam DEZ MILHÕES
   * de toques. Aqui a aposta já ABRE em 500 milhões — zero toques.
   */
  const faixa = degrau(500_000_000, 2_000_000_000);
  assert.equal(toquesPara(faixa, 500_000_000), 0);
  const passoFixo = Math.ceil((500_000_000 - 100) / 50);
  assert.ok(passoFixo > 9_000_000, `o cálculo do defeito antigo deu ${passoFixo}`);
});

console.log('\nAs duas pontas, que não podem furar');

confere('nunca abaixo do mínimo, por nenhum caminho', () => {
  const faixa = degrau(1_000, 10_000);
  assert.equal(ajustar(faixa, 1), 1_000);
  assert.equal(ajustar(faixa, -50), 1_000);
  assert.equal(metade(faixa, 1_000), 1_000, 'metade do mínimo continua sendo o mínimo');
  let valor = tudo(faixa);
  for (let i = 0; i < 30; i += 1) valor = metade(faixa, valor);
  assert.equal(valor, 1_000, 'trinta metades seguidas furaram o piso');
});

confere('nunca acima do saldo, por nenhum caminho', () => {
  const faixa = degrau(1_000, 7_777);
  assert.equal(ajustar(faixa, 999_999), 7_777);
  let valor = apostaInicial(faixa);
  for (let i = 0; i < 30; i += 1) valor = dobrar(faixa, valor);
  assert.equal(valor, 7_777, 'trinta dobros seguidos passaram do saldo');
});

confere('todo valor é inteiro — ficha não se parte', () => {
  const faixa = { minimo: 3, saldo: 1_000, fichas: [3, 7, 11] };
  for (const bruto of [3.9, 10.5, 999.99, 7.0001]) {
    const v = ajustar(faixa, bruto);
    assert.ok(Number.isInteger(v), `${bruto} virou ${v}`);
  }
  assert.equal(metade(faixa, 7), 3, 'a metade de 7 arredonda PRA BAIXO, não pra cima');
});

confere('o arredondamento pra baixo nunca cria aposta que o saldo não paga', () => {
  /* Com saldo ímpar, dobrar a partir do meio não pode estourar por arredondamento. */
  const faixa = degrau(1, 101);
  let valor = 50;
  for (let i = 0; i < 10; i += 1) {
    valor = dobrar(faixa, valor);
    assert.ok(valor <= 101, `passou do saldo: ${valor}`);
  }
});

console.log('\nFichas que o saldo não cobre não aparecem');

confere('quem acabou de chegar no degrau vê só as fichas que pode pagar', () => {
  const minimo = 1_000;
  /* Saldo de 3 mínimos: as fichas de 5, 10 e 20 não cabem. */
  const faixa = degrau(minimo, 3_000);
  assert.deepEqual(atalhos(faixa), [1_000, 2_000]);
});

confere('o mínimo aparece mesmo se o degrau vier sem fichas declaradas', () => {
  const faixa: FaixaDeAposta = { minimo: 250, saldo: 900, fichas: [] };
  assert.deepEqual(atalhos(faixa), [250]);
});

console.log('\nA conta do cliente bate com a do servidor');

confere('o degrau escolhido é o MESMO do servidor, em toda a faixa de saldo', () => {
  /*
   * Esta é a conferência que impede a duplicação de virar divergência. O cliente calcula
   * o degrau pra não precisar consultar o servidor a cada giro; se as duas contas
   * discordarem em um ponto, a pessoa monta uma aposta que o servidor recusa.
   *
   * Varre as fronteiras (a entrada de cada degrau, e um a menos e um a mais) e uma
   * amostra larga no meio.
   */
  const saldos: number[] = [0, 1, 49, 50];
  for (const n of NIVEIS_DE_MESA) {
    saldos.push(n.saldoDeEntrada - 1, n.saldoDeEntrada, n.saldoDeEntrada + 1);
  }
  for (let e = 0; e <= 16; e += 1) saldos.push(3 * 10 ** e, 7 * 10 ** e);

  for (const saldo of saldos) {
    if (saldo < 0) continue;
    /* Nível no topo: aqui a pergunta é só sobre o SALDO, com o nível fora do caminho. */
    const doServidor = degrauEconomico(saldo, 10_000);
    const doCliente = degrauPara(escadaComNivel, saldo);
    assert.equal(doCliente?.id, doServidor.id, `saldo ${saldo}: cliente ${doCliente?.id}, servidor ${doServidor.id}`);
    assert.equal(doCliente?.minimo, doServidor.minimo, `saldo ${saldo}: mínimo diferente`);
  }
});

confere('toda aposta que o seletor deixa montar, o servidor ACEITA', () => {
  /*
   * A prova que fecha o ciclo: percorre os movimentos possíveis em vários saldos e
   * confirma que nenhum valor alcançável pelo seletor é recusado por `problemaComAAposta`.
   * Um seletor que deixa montar uma aposta que o servidor nega é pior do que um seletor
   * limitado — a pessoa escolhe, confirma e toma erro.
   */
  for (const saldo of [50, 137, 5_000, 50_000, 999_999, 5_000_000, 12_345_678_901]) {
   for (const level of [1, 19, 20, 49, 50, 99, 100, 199, 200, 700, 2_000, 10_000]) {
    const faixa = faixaPara(escadaComNivel, saldo, level);
    if (!podeApostar(faixa)) continue;
    let valor = apostaInicial(faixa);
    const vistos = new Set([valor]);
    for (const movimento of movimentosDe(faixa)) {
      const alvo = movimento.tipo === 'ficha' ? ajustar(faixa, movimento.valor)
        : movimento.tipo === 'dobrar' ? dobrar(faixa, valor)
        : movimento.tipo === 'metade' ? metade(faixa, valor)
        : tudo(faixa);
      vistos.add(alvo);
      vistos.add(dobrar(faixa, alvo));
      vistos.add(metade(faixa, alvo));
    }
    for (const v of vistos) {
      const problema = problemaComAAposta(v, saldo, level);
      assert.equal(problema, null, `saldo ${saldo}, nível ${level}, aposta ${v}: ${problema}`);
    }
   }
  }
});

/*
 * E A OUTRA METADE DO CICLO: o degrau que o aplicativo calcula é o MESMO que o servidor
 * calcula, em toda combinação de saldo e nível. Sem isto, o seletor pode oferecer as
 * fichas certas de uma mesa errada — e o erro só apareceria quando a pessoa apostasse.
 */
confere('o degrau do aplicativo é o mesmo do servidor, em saldo e nível', () => {
  let comparados = 0;
  for (const saldo of [0, 1, 49, 50, 137, 49_999, 50_000, 499_999, 5_000_000, 5e8, 5e11, 5e14, 5e15]) {
    for (const level of [0, 1, 19, 20, 49, 50, 99, 100, 199, 200, 399, 400, 699, 700, 1_199, 1_200,
                         1_999, 2_000, 3_499, 3_500, 5_999, 6_000, 9_999, 10_000, 99_999]) {
      const doServidor = degrauEconomico(saldo, level);
      const doAplicativo = degrauEconomicoPara(escadaComNivel, saldo, level);
      assert.equal(
        doAplicativo?.id,
        doServidor.id,
        `saldo ${saldo}, nível ${level}: aplicativo diz ${doAplicativo?.id}, servidor diz ${doServidor.id}`,
      );
      comparados += 1;
    }
  }
  assert.ok(comparados >= 300, `só ${comparados} combinações comparadas`);
});

console.log(`\n${passaram} passaram, ${falharam} falharam\n`);
if (falharam > 0) process.exit(1);
