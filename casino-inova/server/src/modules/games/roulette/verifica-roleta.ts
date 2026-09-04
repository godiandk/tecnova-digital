/**
 * A ROLETA PAGA O QUE ELA DIZ QUE PAGA.
 *
 * Este arquivo confere a mesa inteira, casa por casa, contra a definição de cada aposta
 * — e não contra outra cópia da mesma tabela, que só provaria que copiei certo.
 *
 * O que importa aqui, e o motivo de existir:
 *
 * 1. AS COLUNAS SÃO NOVAS. A mesa impressa sempre teve as três casas "2:1", e o jogo não
 *    aceitava aposta nelas. Casa nova é onde erro entra: um `% 3` trocado põe o 3 na
 *    primeira coluna e ninguém percebe olhando a tela.
 *
 * 2. AGORA SÃO MUITAS APOSTAS NUMA BOLA SÓ. Uma aposta errada some no meio de dez
 *    certas — a soma "parece razoável" e continua errada.
 *
 * 3. O RTP TEM QUE SER O MESMO EM TODA APOSTA. É a propriedade que faz a roleta europeia
 *    honesta: a vantagem da casa vem inteira da casa do zero, e não de pagamento
 *    torto. Se alguma aposta tivesse RTP diferente das outras, ela seria uma armadilha
 *    escondida no meio de uma mesa que parece uniforme. Isto é conferido por CONTAGEM
 *    EXAUSTIVA das 37 casas, não por amostragem.
 */
import { colorOf, RED_NUMBERS, RouletteBetType, TOTAL_MULTIPLIER } from './roulette.config';
import { isWinningBet, resolverApostas } from './roulette.engine';

let falhas = 0;
function confere(titulo: string, condicao: boolean, detalhe = '') {
  if (condicao) {
    console.log(`ok   ${titulo}`);
  } else {
    falhas += 1;
    console.log(`FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

const CASAS = Array.from({ length: 37 }, (_, i) => i);

/** Quem DEVERIA ganhar em cada casa, escrito da definição da aposta e não do motor. */
const DEFINICAO: Record<Exclude<RouletteBetType, 'numero'>, (n: number) => boolean> = {
  vermelho: (n) => RED_NUMBERS.has(n),
  preto: (n) => n !== 0 && !RED_NUMBERS.has(n),
  par: (n) => n !== 0 && n % 2 === 0,
  impar: (n) => n % 2 === 1,
  baixo: (n) => n >= 1 && n <= 18,
  alto: (n) => n >= 19 && n <= 36,
  duzia1: (n) => n >= 1 && n <= 12,
  duzia2: (n) => n >= 13 && n <= 24,
  duzia3: (n) => n >= 25 && n <= 36,
  // A coluna é a FILEIRA em que o número está impresso na mesa, contada da primeira.
  coluna1: (n) => n !== 0 && [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].includes(n),
  coluna2: (n) => n !== 0 && [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].includes(n),
  coluna3: (n) => n !== 0 && [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].includes(n),
};

console.log('--- 1. cada aposta ganha exatamente nas casas que a definição diz ---');
for (const [tipo, deveGanhar] of Object.entries(DEFINICAO)) {
  const divergentes = CASAS.filter(
    (n) => isWinningBet({ type: tipo as RouletteBetType }, n) !== deveGanhar(n),
  );
  confere(`${tipo}`, divergentes.length === 0, `casas divergentes: ${divergentes.join(', ')}`);
}

console.log('\n--- 2. o zero não é par, ímpar, vermelho, preto, alto, baixo, dúzia nem coluna ---');
const forasQueOZeroNaoPodeGanhar = Object.keys(DEFINICAO) as RouletteBetType[];
confere(
  'o zero só paga quem apostou no zero',
  forasQueOZeroNaoPodeGanhar.every((t) => !isWinningBet({ type: t }, 0)) &&
    isWinningBet({ type: 'numero', number: 0 }, 0),
);

console.log('\n--- 3. as três colunas e as três dúzias cobrem os 36 sem sobrar nem repetir ---');
for (const grupo of [['coluna1', 'coluna2', 'coluna3'], ['duzia1', 'duzia2', 'duzia3']] as const) {
  const contagem = new Map<number, number>();
  for (const t of grupo) {
    for (const n of CASAS) if (isWinningBet({ type: t }, n)) contagem.set(n, (contagem.get(n) ?? 0) + 1);
  }
  const cobertos = [...contagem.keys()].sort((a, b) => a - b);
  const repetidos = [...contagem.entries()].filter(([, c]) => c > 1).map(([n]) => n);
  confere(
    `${grupo[0].replace(/\d$/, '')}s cobrem 1..36, cada número uma vez`,
    cobertos.length === 36 && cobertos[0] === 1 && cobertos[35] === 36 && repetidos.length === 0,
    `cobertos ${cobertos.length}, repetidos ${repetidos.join(', ')}`,
  );
}

console.log('\n--- 4. vermelho e preto: 18 cada, e nenhum número nos dois ---');
const vermelhos = CASAS.filter((n) => isWinningBet({ type: 'vermelho' }, n));
const pretos = CASAS.filter((n) => isWinningBet({ type: 'preto' }, n));
confere('18 vermelhos', vermelhos.length === 18, `são ${vermelhos.length}`);
confere('18 pretos', pretos.length === 18, `são ${pretos.length}`);
confere('nenhum número é das duas cores', vermelhos.every((n) => !pretos.includes(n)));
confere('a cor publicada bate com a aposta', CASAS.every((n) => (colorOf(n) === 'vermelho') === vermelhos.includes(n)));

console.log('\n--- 5. o RTP é o MESMO em toda aposta: 36/37 ---');
/*
 * Sem amostragem: as 37 casas são igualmente prováveis, então o retorno esperado de uma
 * aposta é (quantas casas ela ganha) × (o que ela paga) ÷ 37. Contar é exato.
 */
const esperado = 36 / 37;
for (const tipo of Object.keys(TOTAL_MULTIPLIER) as RouletteBetType[]) {
  const ganha =
    tipo === 'numero' ? 1 : CASAS.filter((n) => isWinningBet({ type: tipo }, n)).length;
  const rtp = (ganha * TOTAL_MULTIPLIER[tipo]) / 37;
  confere(
    `${tipo}: ganha em ${ganha} de 37 e paga ${TOTAL_MULTIPLIER[tipo]}x → RTP ${(rtp * 100).toFixed(4)}%`,
    Math.abs(rtp - esperado) < 1e-12,
    `esperado ${(esperado * 100).toFixed(4)}%`,
  );
}

console.log('\n--- 6. muitas apostas numa bola só: cada uma é paga sozinha ---');
{
  // Uma jogada de mesa: ficha no 17, no preto, na 2ª dúzia e na coluna 2. O 17 é preto,
  // está na 2ª dúzia (13-24) e na 2ª coluna — então quando sai 17, as QUATRO ganham.
  const apostas = [
    { type: 'numero' as const, number: 17, amount: 100 },
    { type: 'preto' as const, amount: 100 },
    { type: 'duzia2' as const, amount: 100 },
    { type: 'coluna2' as const, amount: 100 },
  ];
  const saiu17 = resolverApostas(17, apostas);
  confere('sai 17: as quatro apostas ganham', saiu17.every((r) => r.won));
  confere(
    'e o retorno é a soma das quatro, sem desconto por acumular',
    saiu17.reduce((s, r) => s + r.totalReturn, 0) === 100 * 36 + 100 * 2 + 100 * 3 + 100 * 3,
  );

  const saiu5 = resolverApostas(5, apostas);
  confere(
    'sai 5 (vermelho, 1ª dúzia, 2ª coluna): só a coluna ganha',
    saiu5.filter((r) => r.won).map((r) => r.type).join(',') === 'coluna2',
  );

  const saiuZero = resolverApostas(0, apostas);
  confere('sai zero: nenhuma dessas ganha', saiuZero.every((r) => !r.won));
  confere('e o retorno é zero', saiuZero.reduce((s, r) => s + r.totalReturn, 0) === 0);
}

console.log('\n--- 7. a soma paga em cada casa, sobre a mesa inteira coberta ---');
{
  /*
   * A prova do RTP na prática: uma ficha em CADA UMA das 37 casas de número custa 37 e
   * devolve 36, em qualquer casa que a bola pare. É a vantagem da casa, à vista, sem
   * simulação nenhuma.
   */
  const mesaCoberta = CASAS.map((n) => ({ type: 'numero' as const, number: n, amount: 1 }));
  const errados = CASAS.filter(
    (bola) => resolverApostas(bola, mesaCoberta).reduce((s, r) => s + r.totalReturn, 0) !== 36,
  );
  confere('cobrindo os 37 números: custa 37, devolve 36 em qualquer casa', errados.length === 0, `casas erradas: ${errados.join(', ')}`);
}

console.log(falhas === 0 ? '\nOK: a roleta paga o que ela diz que paga.' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
