/**
 * PROVA QUE A MESA DE SOM DECIDE CERTO.
 *
 * Sem isto, "a música abaixa quando o prêmio toca" seria uma frase num comentário. Como a
 * mesa de som não toca nada — só decide —, dá pra conferir com um relógio de mentira, em
 * qualquer máquina, sem placa de som e sem ouvido.
 *
 * O ts-node mora no servidor:
 *   cd ../server && npx ts-node ../app/verificacao/verifica-mistura.ts
 */
import { strict as assert } from 'node:assert';

import { criarMistura, FORMATO_DO_ABAIXAMENTO, TETO_DE_VOZES } from '../src/som/mistura';

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

console.log('\nA MESA DE SOM\n');

console.log('Volume por camada');

confere('cada camada tem o volume dela', () => {
  const m = criarMistura();
  m.definirVolume('musica', 0.5);
  m.definirVolume('efeitos', 1);
  assert.equal(m.volumeDe('efeitos', 1, 0), 1);
  assert.equal(m.volumeDe('musica', 1, 0), 0.5);
});

confere('o mudo desliga tudo, sem negociar', () => {
  const m = criarMistura();
  m.definirMudo(true);
  assert.equal(m.volumeDe('efeitos', 1, 0), 0);
  assert.equal(m.volumeDe('musica', 1, 0), 0);
  assert.equal(m.pedirVoz('destaque', 0).pode, false, 'no mudo nem o destaque toca');
});

confere('volume fora da faixa é apertado, não aceito', () => {
  const m = criarMistura();
  m.definirVolume('musica', 5);
  assert.equal(m.volumeDaCamada('musica'), 1);
  m.definirVolume('musica', -2);
  assert.equal(m.volumeDaCamada('musica'), 0);
  assert.equal(m.volumeDe('efeitos', 99, 0), 1, 'um pedido acima de 1 tem que saturar em 1');
});

console.log('\nOrçamento de vozes');

confere(`até ${TETO_DE_VOZES} vozes entram sem briga`, () => {
  const m = criarMistura();
  for (let i = 0; i < TETO_DE_VOZES; i += 1) {
    const { pode, roubarId } = m.pedirVoz('normal', 0);
    assert.equal(pode, true, `a voz ${i + 1} devia caber`);
    assert.equal(roubarId, null);
    m.comecou(i, 'normal', 0);
  }
  assert.equal(m.vozesAtivas(0), TETO_DE_VOZES);
});

confere('cheio, um som MAIS importante rouba o lugar do menos importante', () => {
  const m = criarMistura();
  for (let i = 0; i < TETO_DE_VOZES; i += 1) m.comecou(i, 'fundo', 0);
  const { pode, roubarId } = m.pedirVoz('destaque', 0);
  assert.equal(pode, true, 'o pagamento não pode ser engolido por textura');
  assert.notEqual(roubarId, null);
});

confere('cheio, um som MENOS importante NÃO derruba o mais importante', () => {
  const m = criarMistura();
  for (let i = 0; i < TETO_DE_VOZES; i += 1) m.comecou(i, 'destaque', 0);
  const { pode } = m.pedirVoz('fundo', 0);
  assert.equal(pode, false, 'senão o teto viraria "o último que chegou ganha"');
});

confere('entre iguais, cede a mais velha', () => {
  /* A mais velha já foi ouvida; a nova ainda não. */
  const m = criarMistura();
  for (let i = 0; i < TETO_DE_VOZES; i += 1) m.comecou(i, 'normal', i * 10);
  const { roubarId } = m.pedirVoz('destaque', 0);
  assert.equal(roubarId, 0, `roubou a voz ${roubarId}, esperava a mais velha (0)`);
});

confere('voz que terminou libera lugar sozinha, sem ninguém avisar', () => {
  const m = criarMistura();
  for (let i = 0; i < TETO_DE_VOZES; i += 1) m.comecou(i, 'normal', 0, 100);
  assert.equal(m.vozesAtivas(50), TETO_DE_VOZES);
  assert.equal(m.vozesAtivas(200), 0, 'as vozes não expiraram sozinhas');
  assert.equal(m.pedirVoz('fundo', 200).pode, true);
});

confere('avisar que acabou libera na hora', () => {
  const m = criarMistura();
  for (let i = 0; i < TETO_DE_VOZES; i += 1) m.comecou(i, 'normal', 0, 10000);
  assert.equal(m.pedirVoz('fundo', 0).pode, false);
  m.acabou(3);
  assert.equal(m.pedirVoz('fundo', 0).pode, true);
});

console.log('\nAbaixar pra deixar ouvir');

confere('a música desce quando um destaque pede', () => {
  const m = criarMistura();
  const cheio = m.volumeDe('musica', 1, 0);
  m.abaixarOFundo(1000);
  const embaixo = m.volumeDe('musica', 1, 1000 + FORMATO_DO_ABAIXAMENTO.descida + 10);
  assert.ok(embaixo < cheio * 0.5, `a música mal desceu: ${embaixo} contra ${cheio}`);
});

confere('e volta sozinha, sem ninguém mandar', () => {
  const m = criarMistura();
  const cheio = m.volumeDe('musica', 1, 0);
  m.abaixarOFundo(1000);
  const { descida, embaixo, subida } = FORMATO_DO_ABAIXAMENTO;
  const depois = m.volumeDe('musica', 1, 1000 + descida + embaixo + subida + 1);
  assert.equal(depois, cheio, `não voltou ao volume cheio: ${depois} contra ${cheio}`);
});

confere('o EFEITO nunca é abaixado por outro efeito', () => {
  /*
   * Se o efeito se abaixasse por causa de outro efeito, o som inteiro passaria a
   * respirar junto — o defeito clássico de compressor mal ligado.
   */
  const m = criarMistura();
  m.abaixarOFundo(1000);
  assert.equal(m.volumeDe('efeitos', 1, 1000 + FORMATO_DO_ABAIXAMENTO.descida + 10), 1);
});

confere('desce rápido e sobe devagar', () => {
  /* Descer devagar abafaria justamente o começo do destaque, que é o que se quer ouvir. */
  const { descida, subida } = FORMATO_DO_ABAIXAMENTO;
  assert.ok(subida > descida * 3, `descida ${descida} ms e subida ${subida} ms — perto demais`);
});

confere('um segundo destaque REINICIA o abaixamento, não soma', () => {
  const m = criarMistura();
  const { descida, embaixo, subida } = FORMATO_DO_ABAIXAMENTO;
  m.abaixarOFundo(0);
  m.abaixarOFundo(500);
  /* No instante em que o PRIMEIRO teria voltado, o segundo ainda segura. */
  const quandoOPrimeiroVoltaria = descida + embaixo + subida + 1;
  assert.ok(
    m.volumeDe('musica', 1, quandoOPrimeiroVoltaria) < m.volumeDaCamada('musica'),
    'o segundo destaque não reiniciou a contagem',
  );
  /* E volta inteiro contando a partir do SEGUNDO. */
  assert.equal(m.volumeDe('musica', 1, 500 + quandoOPrimeiroVoltaria), m.volumeDaCamada('musica'));
});

confere('sem destaque nenhum, nada é abaixado', () => {
  const m = criarMistura();
  assert.equal(m.volumeDe('musica', 1, 99999), m.volumeDaCamada('musica'));
});

console.log(`\n${passaram} passaram, ${falharam} falharam\n`);
if (falharam > 0) process.exit(1);
