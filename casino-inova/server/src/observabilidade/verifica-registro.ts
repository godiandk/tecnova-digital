/**
 * A PROVA DO REGISTRO.
 *
 * Um registro serve pra duas coisas opostas ao mesmo tempo: contar o que aconteceu, e
 * NÃO contar o que não pode ser contado. As duas falham em silêncio — ninguém percebe que
 * faltou uma linha, e ninguém percebe que um token vazou até alguém achar. Por isso as
 * duas são conferidas aqui, e não por leitura de código.
 *
 *   npm run verify:registro
 */
import { strict as assert } from 'node:assert';

import { acrescentarAoContexto, comContexto } from './contexto-do-pedido';
import { desviarOndeEscreve, esconderSegredos, registro } from './registro';

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

/** Roda algo colhendo as linhas que saírem, em vez de deixá-las ir pro terminal. */
function colhendo(oQueFazer: () => void): Array<Record<string, unknown>> {
  const linhas: string[] = [];
  const devolver = desviarOndeEscreve((l) => linhas.push(l));
  try { oQueFazer(); } finally { devolver(); }
  return linhas.map((l) => JSON.parse(l));
}

/** Tudo que existe de texto numa estrutura, em qualquer profundidade. */
function todoOTexto(valor: unknown, achados: string[] = []): string[] {
  if (typeof valor === 'string') achados.push(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => todoOTexto(v, achados));
  else if (valor && typeof valor === 'object') {
    Object.entries(valor).forEach(([k, v]) => { achados.push(k); todoOTexto(v, achados); });
  }
  return achados;
}

console.log('\nO REGISTRO\n');

console.log('Forma da linha');

confere('toda linha é um JSON válido, de uma linha só', () => {
  const linhas: string[] = [];
  const devolver = desviarOndeEscreve((l) => linhas.push(l));
  registro.info('teste', 'oi', { jogo: 'slots' });
  registro.erro('teste', 'ai', { falha: new Error('quebrou') });
  devolver();
  assert.equal(linhas.length, 2);
  for (const l of linhas) {
    assert.ok(!l.includes('\n'), 'uma linha de registro não pode ter quebra de linha');
    JSON.parse(l);
  }
});

confere('as chaves obrigatórias sempre existem', () => {
  const [linha] = colhendo(() => registro.info('slots', 'girou'));
  for (const chave of ['em', 'nivel', 'onde', 'mensagem']) {
    assert.ok(chave in linha, `faltou a chave "${chave}"`);
  }
  assert.equal(linha.nivel, 'info');
  assert.equal(linha.onde, 'slots');
  assert.ok(!Number.isNaN(Date.parse(String(linha.em))), '`em` tem que ser uma data ISO');
});

console.log('\nO que NUNCA pode sair');

confere('chave proibida some, em qualquer profundidade', () => {
  const [linha] = colhendo(() => registro.info('t', 'm', {
    senha: 'batata',
    dentro: { idToken: 'abc', mais: { REFRESH_TOKEN: 'xyz' } },
    lista: [{ authorization: 'Bearer zzz' }],
  }));
  const texto = JSON.stringify(linha);
  for (const proibido of ['batata', 'abc', 'xyz', 'zzz']) {
    assert.ok(!texto.includes(proibido), `vazou "${proibido}": ${texto}`);
  }
});

confere('JWT some MESMO debaixo de uma chave inocente', () => {
  /*
   * Este é o teste que importa. A lista de nomes só protege contra o que alguém lembrou
   * de listar; um token guardado em `{ x: 'eyJ...' }` passaria batido — e é exatamente
   * assim que segredo vaza, pela chave chamada `x` e não pela chamada `token`.
   */
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.assinatura_secreta_aqui';
  const [linha] = colhendo(() => registro.info('t', 'm', { x: jwt, fundo: { y: [jwt] } }));
  const texto = JSON.stringify(linha);
  assert.ok(!texto.includes('assinatura_secreta_aqui'), `vazou o JWT: ${texto}`);
  assert.ok(texto.includes('jwt escondido'), 'devia ter marcado que escondeu');
});

confere('e-mail some mesmo em campo de nome neutro', () => {
  const [linha] = colhendo(() => registro.info('t', 'm', { contato: 'alguem@exemplo.com' }));
  assert.ok(!JSON.stringify(linha).includes('alguem@exemplo.com'));
});

confere('CPF e chave privada somem', () => {
  const [linha] = colhendo(() => registro.info('t', 'm', {
    doc: '123.456.789-00',
    arquivo: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg',
  }));
  const texto = JSON.stringify(linha);
  assert.ok(!texto.includes('123.456.789-00'));
  assert.ok(!texto.includes('MIIEvQIBADANBg'));
});

confere('o erro vai com mensagem e origem, mas sem a pilha inteira', () => {
  const [linha] = colhendo(() => registro.erro('t', 'm', { falha: new Error('deu ruim') }));
  const falha = linha.falha as { erro: string; mensagem: string; onde: string[] };
  assert.equal(falha.erro, 'Error');
  assert.equal(falha.mensagem, 'deu ruim');
  assert.ok(Array.isArray(falha.onde) && falha.onde.length <= 3);
});

console.log('\nO registro não pode estragar o jogo');

confere('esconderSegredos NÃO modifica o objeto original', () => {
  /*
   * O objeto que chega aqui costuma ser o estado da rodada. Um registro que apagasse o
   * token de dentro dele estaria estragando o jogo pra escrever um log.
   */
  const original = { senha: 'batata', saldo: 500, dentro: { idToken: 'abc' } };
  const copia = JSON.parse(JSON.stringify(original));
  esconderSegredos(original);
  assert.deepEqual(original, copia, 'o objeto original foi alterado');
});

confere('referência circular não derruba nada', () => {
  const bicho: Record<string, unknown> = { nome: 'ciclo' };
  bicho.eu = bicho;
  const [linha] = colhendo(() => registro.info('t', 'm', { bicho }));
  assert.ok(JSON.stringify(linha).includes('referência circular'));
});

confere('o MESMO objeto em dois lugares não é confundido com ciclo', () => {
  /*
   * Irmãos apontando pro mesmo objeto é coisa comum — a mesma aposta referida em dois
   * campos. Se o registro chamasse isso de "referência circular", estaria mentindo sobre
   * a forma do dado justamente pra quem foi ler o registro pra entender o dado.
   */
  const aposta = { valor: 100, casa: 'grande' };
  const [linha] = colhendo(() => registro.info('t', 'm', { primeira: aposta, segunda: aposta }));
  const texto = JSON.stringify(linha);
  assert.ok(!texto.includes('circular'), `chamou de ciclo o que era só repetição: ${texto}`);
  assert.deepEqual(linha.primeira, linha.segunda);
});

confere('ciclo de verdade continua sendo pego, mesmo fundo', () => {
  const raiz: Record<string, unknown> = { a: {} };
  ((raiz.a as Record<string, unknown>).b = { c: {} });
  (((raiz.a as Record<string, unknown>).b as Record<string, unknown>).c as Record<string, unknown>).volta = raiz;
  const [linha] = colhendo(() => registro.info('t', 'm', { raiz }));
  assert.ok(JSON.stringify(linha).includes('circular'), 'deixou passar um ciclo de verdade');
});

confere('texto e lista gigantes são cortados', () => {
  const [linha] = colhendo(() => registro.info('t', 'm', {
    enorme: 'x'.repeat(5000),
    muitos: Array.from({ length: 500 }, (_, i) => i),
  }));
  const bruto = JSON.stringify(linha);
  assert.ok(bruto.length < 4000, `linha grande demais: ${bruto.length} caracteres`);
  assert.ok(bruto.includes('+4500 caracteres'));
  assert.ok(bruto.includes('+450 itens'));
});

confere('um valor impossível de serializar não lança', () => {
  const bomba = { get exploda() { throw new Error('não me leia'); } };
  const linhas = colhendo(() => registro.info('t', 'm', { bomba }));
  /* O que importa é não ter lançado; o conteúdo pode ser o aviso de falha do registro. */
  assert.ok(linhas.length >= 1);
});

console.log('\nO contexto viaja com o pedido');

confere('o número do pedido aparece numa linha escrita lá no fundo', () => {
  const linhas = colhendo(() => {
    comContexto({ pedido: 'abc12345', usuario: 'u-1' }, () => {
      (function bemFundo() { registro.info('slots', 'girou'); })();
    });
  });
  assert.equal(linhas[0].pedido, 'abc12345');
  assert.equal(linhas[0].usuario, 'u-1');
});

confere('a rodada entra no meio do pedido e vale das próximas linhas em diante', () => {
  const linhas = colhendo(() => {
    comContexto({ pedido: 'p1' }, () => {
      registro.info('t', 'antes');
      acrescentarAoContexto({ jogo: 'slots', rodada: 'r-99' });
      registro.info('t', 'depois');
    });
  });
  assert.equal(linhas[0].rodada, undefined, 'a rodada não existia ainda na primeira linha');
  assert.equal(linhas[1].rodada, 'r-99');
  assert.equal(linhas[1].jogo, 'slots');
});

confere('dois pedidos ao mesmo tempo não misturam contexto', () => {
  /*
   * É o motivo de existir o AsyncLocalStorage em vez de uma variável. Com dezenas de
   * pedidos em voo, uma variável global daria o número do pedido errado pra metade das
   * linhas — e um registro que aponta pro pedido errado é pior que não ter registro.
   */
  const linhas = colhendo(() => {
    comContexto({ pedido: 'A' }, () => {
      comContexto({ pedido: 'B' }, () => registro.info('t', 'de dentro do B'));
      registro.info('t', 'de volta no A');
    });
  });
  assert.equal(linhas[0].pedido, 'B');
  assert.equal(linhas[1].pedido, 'A');
});

confere('fora de qualquer pedido, escreve mesmo assim', () => {
  const [linha] = colhendo(() => registro.info('subida', 'servidor no ar'));
  assert.equal(linha.mensagem, 'servidor no ar');
  assert.equal(linha.pedido, undefined);
});

console.log('\nVarredura larga');

confere('nenhum segredo conhecido sobrevive a uma estrutura embolada', () => {
  const segredos = [
    'senha-secreta', 'eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.zzzzzzzzzz',
    'alguem@exemplo.com', '111.222.333-44',
  ];
  const embolado = {
    nivel1: { senha: segredos[0], lista: [{ q: segredos[1] }, { email: segredos[2] }] },
    outro: [[{ doc: segredos[3] }]],
  };
  const [linha] = colhendo(() => registro.info('t', 'm', embolado));
  const tudo = todoOTexto(linha).join(' | ');
  for (const s of segredos) {
    assert.ok(!tudo.includes(s), `sobreviveu: ${s}`);
  }
});

console.log(`\n${passaram} passaram, ${falharam} falharam\n`);
if (falharam > 0) process.exit(1);
