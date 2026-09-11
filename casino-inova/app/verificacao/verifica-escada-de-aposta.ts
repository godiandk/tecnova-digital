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
import {
  degrauEconomicoPara,
  degrauPara,
  degrauQueCabeNaConta,
  faixaPara,
} from '../src/aposta/degrau';
/* O servidor, de verdade: é contra ELE que a conta do cliente é comparada. */
import {
  NIVEIS_DE_MESA,
  NIVEL_PARA_ABRIR_O_DEGRAU,
  degrauEconomico,
  degrauQueCabeNaConta as degrauQueCabeNoServidor,
  problemaComAAposta,
} from '../../server/src/modules/games/shared/niveis-de-mesa';
/* Os multiplicadores de verdade dos jogos: é contra ELES que o trilho é conferido. */
import { MAIOR_MULTIPLICADOR as SLOTS } from '../../server/src/modules/games/slots/slots.config';
import { MAIOR_MULTIPLICADOR as ROLETA } from '../../server/src/modules/games/roulette/roulette.config';
import { MAIOR_MULTIPLICADOR as BACARA } from '../../server/src/modules/games/baccarat/baccarat.config';
import { MAIOR_MULTIPLICADOR as BACBO } from '../../server/src/modules/games/bac-bo/bac-bo.config';
import { MAIOR_MULTIPLICADOR as BLACKJACK } from '../../server/src/modules/games/blackjack/blackjack.config';
import { MAIOR_MULTIPLICADOR as BOLSA } from '../../server/src/modules/games/stock-market/stock-market.config';
import { MAIOR_MULTIPLICADOR as BANCA } from '../../server/src/modules/games/banca-francesa/banca-francesa.config';

const JOGOS: Array<[string, number]> = [
  ['caça-níqueis', SLOTS],
  ['roleta', ROLETA],
  ['bacará', BACARA],
  ['bac bo', BACBO],
  ['blackjack', BLACKJACK],
  ['stock market', BOLSA],
  ['banca francesa', BANCA],
];

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


console.log('\nO trilho respeita o teto da conta exata');

confere('o trilho que o aplicativo desenha é o MESMO que o servidor valida, jogo a jogo', () => {
  /*
   * A METADE NOVA DO MESMO CICLO. O aplicativo desenha o trilho entre uma rodada e outra
   * sem perguntar (o saldo muda a cada giro); o servidor valida a aposta. Desde que o
   * trilho passou a parar onde a conta de fichas para de ser exata, as duas contas
   * precisam parar no MESMO degrau — senão a tela volta a oferecer ficha recusada, que é
   * o defeito inteiro que esta engine existe pra matar.
   */
  for (const [nome, multiplicador] of JOGOS) {
    for (const degrau of NIVEIS_DE_MESA) {
      const doServidor = degrauQueCabeNoServidor(degrau, multiplicador);
      const doAplicativo = degrauQueCabeNaConta(escadaComNivel, escadaComNivel[NIVEIS_DE_MESA.indexOf(degrau)], multiplicador);
      assert.equal(
        doAplicativo?.id,
        doServidor.id,
        `${nome}, degrau ${degrau.id}: aplicativo diz ${doAplicativo?.id}, servidor diz ${doServidor.id}`,
      );
    }
  }
});

confere('no caça-níqueis o trilho PARA — e nos outros seis não para', () => {
  /*
   * Esta conferência é sobre o número, e não sobre o mecanismo. O caça-níqueis paga até
   * 80.000x (cinco linhas de jackpot), e é o único do catálogo que faz o trilho descer no
   * topo da escada. Se um dia outro jogo passar a descer também, é porque alguém mexeu
   * numa tabela de pagamento — e isso tem que aparecer aqui, e não numa reclamação.
   */
  const topo = NIVEIS_DE_MESA[NIVEIS_DE_MESA.length - 1];
  assert.notEqual(
    degrauQueCabeNoServidor(topo, SLOTS).id,
    topo.id,
    'o caça-níqueis deveria fazer o trilho descer no topo da escada',
  );
  for (const [nome, multiplicador] of JOGOS) {
    if (multiplicador === SLOTS) continue;
    assert.equal(
      degrauQueCabeNoServidor(topo, multiplicador).id,
      topo.id,
      `${nome} passou a fazer o trilho descer — alguém mexeu no pagamento dele`,
    );
  }
});

confere('toda aposta do seletor é aceita TAMBÉM com o multiplicador do jogo', () => {
  /*
   * A mesma prova de antes, agora com o teto da conta no caminho. No topo da escada o
   * caça-níqueis é o caso que interessa: sem o trilho descer, o seletor ofereceria fichas
   * de cinco trilhões e TODAS seriam recusadas, porque cinco trilhões vezes oitenta mil
   * não cabe em ficha exata. A mesa mais alta do jogo mais popular ficaria inutilizável.
   */
  for (const [nome, multiplicador] of JOGOS) {
    for (const saldo of [50, 5_000, 5_000_000, 146_000_000_000, 5e14, 9e15]) {
      for (const level of [1, 50, 400, 2_000, 10_000]) {
        const faixa = faixaPara(escadaComNivel, saldo, level, multiplicador);
        if (!podeApostar(faixa)) continue;
        let valor = apostaInicial(faixa);
        const vistos = new Set([valor, tudo(faixa)]);
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
          const problema = problemaComAAposta(v, saldo, level, multiplicador);
          assert.equal(problema, null, `${nome}, saldo ${saldo}, nível ${level}, aposta ${v}: ${problema}`);
        }
      }
    }
  }
});

console.log('\nTrês jogadores, três escalas');

confere('10 mil, 5 milhões e 146 bilhões recebem trilhos DIFERENTES', () => {
  /*
   * O PEDIDO, em uma frase: a aposta tem que ser proporcional a quem aposta. Quem tem
   * dez mil fichas e quem tem cento e quarenta e seis bilhões não podem ver o mesmo
   * seletor — era isso que a tela fazia, e era por isso que a mesa ficava sem sentido pra
   * quem tinha banca grande.
   */
  const perfis: Array<[string, number]> = [
    ['pé de chinelo', 10_000],
    ['jogador médio', 5_000_000],
    ['baleia', 146_000_000_000],
  ];
  const trilhos = perfis.map(([nome, saldo]) => {
    const faixa = faixaPara(escadaComNivel, saldo, 10_000);
    return { nome, saldo, minimo: faixa.minimo, fichas: faixa.fichas };
  });
  for (const t of trilhos) {
    console.log(
      `         ${t.nome.padEnd(14)} ${t.saldo.toLocaleString('pt-BR').padStart(19)} fichas  ` +
        `→ mínimo ${t.minimo.toLocaleString('pt-BR')}, trilho ${t.fichas.map((f) => f.toLocaleString('pt-BR')).join(' · ')}`,
    );
  }
  const minimos = trilhos.map((t) => t.minimo);
  assert.equal(new Set(minimos).size, 3, `os três mínimos deveriam ser diferentes: ${minimos.join(', ')}`);
  for (let i = 1; i < minimos.length; i += 1) {
    assert.ok(minimos[i] > minimos[i - 1], 'o mínimo tem que crescer com o saldo');
  }
  /* E a proporção se mantém: a aposta mínima pesa o mesmo no bolso dos três. */
  const pesos = trilhos.map((t) => t.minimo / t.saldo);
  for (const peso of pesos) {
    assert.ok(peso > 0 && peso <= 0.05, `a aposta mínima pesa ${(peso * 100).toFixed(2)}% do saldo`);
  }
});

confere('metade, dobro e tudo nunca montam aposta ilegal, nos três perfis', () => {
  for (const saldo of [10_000, 5_000_000, 146_000_000_000]) {
    const faixa = faixaPara(escadaComNivel, saldo, 10_000);
    assert.ok(podeApostar(faixa), `saldo ${saldo} deveria poder apostar`);
    let valor = apostaInicial(faixa);
    /* Uma caminhada longa: dobra até o teto, corta pela metade até o piso, e pega tudo. */
    for (let passo = 0; passo < 40; passo += 1) {
      valor = passo % 3 === 0 ? dobrar(faixa, valor) : passo % 3 === 1 ? metade(faixa, valor) : tudo(faixa);
      const problema = problemaComAAposta(valor, saldo, 10_000);
      assert.equal(problema, null, `saldo ${saldo}, passo ${passo}, aposta ${valor}: ${problema}`);
      assert.ok(Number.isSafeInteger(valor), `aposta ${valor} deixou de ser ficha exata`);
    }
  }
});

console.log(`\n${passaram} passaram, ${falharam} falharam\n`);
if (falharam > 0) process.exit(1);
