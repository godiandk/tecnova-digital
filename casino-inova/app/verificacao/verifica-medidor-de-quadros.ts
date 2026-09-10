/**
 * PROVA QUE O MEDIDOR DE QUADROS CONTA CERTO.
 *
 * Um medidor errado é pior que nenhum: ele produz um número, o número entra num
 * relatório, e a decisão sai torta com ar de coisa medida. A própria POC de renderização
 * tropeçou nisso — a primeira versão contava "quadro perdido" como "passou de 16,67 ms" e
 * relatou 57,7% de perda junto com um p95 de 16,8 ms, três números que não podem ser
 * todos verdade ao mesmo tempo.
 *
 * Por isso aqui as sequências de quadros são INVENTADAS À MÃO, com a resposta certa
 * conhecida de antemão. Não é "rodou sem estourar": é "a conta bate".
 *
 * O ts-node mora no servidor:
 *   cd ../server && npx ts-node ../app/verificacao/verifica-medidor-de-quadros.ts
 */
import { strict as assert } from 'node:assert';

import {
  comoEstaIndo, criarMedidorDeQuadros, ORCAMENTO_MS,
} from '../src/desempenho/medidorDeQuadros';

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

/** Alimenta o medidor com uma lista de intervalos, em ms, e devolve a medida. */
function medindo(intervalos: number[]) {
  const m = criarMedidorDeQuadros();
  let t = 1000;
  m.quadro(t);
  for (const passo of intervalos) {
    t += passo;
    m.quadro(t);
  }
  return m.resultado();
}

console.log('\nO MEDIDOR DE QUADROS\n');

console.log('A conta básica');

confere('sem quadro nenhum, não inventa medida', () => {
  assert.equal(criarMedidorDeQuadros().resultado(), null);
});

confere('o PRIMEIRO intervalo é descartado', () => {
  /*
   * Ele carrega a compilação do shader e o primeiro layout. Três marcações de quadro dão
   * dois intervalos, e só o segundo entra.
   */
  const m = criarMedidorDeQuadros();
  m.quadro(0);
  m.quadro(500);   // intervalo de 500 ms — descartado
  m.quadro(516.7); // intervalo de 16,7 ms — vale
  const r = m.resultado()!;
  assert.equal(r.quadros, 1);
  assert.equal(r.pior, 16.7, 'o intervalo de subida vazou pra dentro da conta');
});

confere('60 Hz redondo: nenhuma virada perdida', () => {
  const r = medindo(Array(300).fill(ORCAMENTO_MS))!;
  /* 300 intervalos, menos o primeiro, que é sempre descartado. */
  assert.equal(r.quadros, 299);
  assert.equal(r.p50, 16.7);
  assert.equal(r.perdidos, 0);
  assert.equal(r.perdidosPorCento, 0);
  assert.equal(r.fps, 60);
});

console.log('\nO limiar em cima da linha — o erro que a POC cometeu');

confere('16,68 ms NÃO é quadro perdido', () => {
  /*
   * Este é o teste que importa. Um renderizador preso ao sincronismo entrega intervalos
   * empilhados em cima de 16,67: metade cai em 16,68 e metade em 16,66, por ruído de
   * relógio. Contando "> 16,67", metade dos quadros vira "perdida" — e o relatório diz
   * que um jogo perfeitamente fluido está travando.
   */
  const r = medindo(Array(200).fill(16.68))!;
  assert.equal(r.perdidos, 0, `contou ${r.perdidos} perdidos num jogo que não perdeu nenhum`);
  assert.equal(r.perdidosPorCento, 0);
});

confere('33,4 ms é UMA virada perdida', () => {
  const r = medindo([...Array(99).fill(ORCAMENTO_MS), 33.4])!;
  assert.equal(r.perdidos, 1);
  assert.equal(r.perdidosPorCento, 1);
});

confere('50 ms são DUAS viradas perdidas', () => {
  const r = medindo([...Array(99).fill(ORCAMENTO_MS), 50])!;
  assert.equal(r.perdidos, 2, 'um engasgo de 50 ms come duas viradas, não uma');
  assert.equal(r.perdidosPorCento, 1, 'mas é UM quadro engasgado, não dois');
});

console.log('\nA cauda, que é o que a pessoa sente');

confere('a média esconde o que os percentis mostram', () => {
  /*
   * 59 quadros de 10 ms e um de 400: a média dá 16,5 ms, que "cabe no orçamento". E é
   * uma travada que qualquer pessoa vê. É por isso que este medidor não reporta média
   * como se fosse veredito.
   */
  const r = medindo([...Array(59).fill(10), 400])!;
  assert.ok(r.media < ORCAMENTO_MS, `a média deu ${r.media}, esperava caber no orçamento`);
  assert.equal(r.pior, 400);
  assert.equal(r.perdidos, 23, `400 ms a 60 Hz come 23 viradas, contou ${r.perdidos}`);
});

confere('p50, p95 e p99 saem em ordem e no lugar certo', () => {
  /* 100 quadros: 95 de 10 ms e 5 de 100 ms. O p95 tem que pegar a virada. */
  const r = medindo([...Array(95).fill(10), ...Array(5).fill(100)])!;
  assert.equal(r.p50, 10);
  assert.equal(r.p99, 100);
  assert.ok(r.p50 <= r.p95 && r.p95 <= r.p99 && r.p99 <= r.pior, 'os percentis saíram fora de ordem');
});

console.log('\nNão pode vazar memória nem parar de medir');

confere('medir muito tempo não faz o vetor crescer sem fim', () => {
  const m = criarMedidorDeQuadros();
  let t = 0;
  for (let i = 0; i < 40000; i += 1) { t += ORCAMENTO_MS; m.quadro(t); }
  const r = m.resultado()!;
  assert.ok(r.quadros <= 7200, `guardou ${r.quadros} amostras — o teto não segurou`);
  assert.ok(r.quadros > 1000, 'jogou fora amostra demais e a medida ficou curta');
  assert.equal(r.p50, 16.7, 'depois de podar, a medida continua certa');
});

confere('zerar apaga tudo e volta a descartar o primeiro intervalo', () => {
  const m = criarMedidorDeQuadros();
  m.quadro(0); m.quadro(16.7); m.quadro(33.4);
  m.zerar();
  assert.equal(m.resultado(), null);
  m.quadro(0); m.quadro(999); m.quadro(1015.7);
  assert.equal(m.resultado()!.quadros, 1, 'depois de zerar, o primeiro intervalo tem que ser descartado de novo');
});

console.log('\nO veredito em uma frase');

confere('60 Hz constante é "bom"', () => {
  assert.equal(comoEstaIndo(medindo(Array(200).fill(ORCAMENTO_MS))!).nivel, 'bom');
});

confere('típico bom com cauda ruim NÃO é "bom"', () => {
  /*
   * A régua do relatório: vale caber na CAUDA, não na média. Um jogo com p50 de 16 ms e
   * p99 de 90 ms está pior, pra quem joga, do que um com p50 de 20 e p99 de 22.
   */
  const r = medindo([...Array(190).fill(16), ...Array(10).fill(90)])!;
  assert.notEqual(comoEstaIndo(r).nivel, 'bom', 'chamou de fluido um jogo que engasga 5% das vezes');
});

confere('travando de verdade é "ruim"', () => {
  assert.equal(comoEstaIndo(medindo(Array(200).fill(70))!).nivel, 'ruim');
});

console.log(`\n${passaram} passaram, ${falharam} falharam\n`);
if (falharam > 0) process.exit(1);
