/**
 * AS 216 COMBINAÇÕES DE TRÊS DADOS, UMA A UMA.
 *
 * Não é amostragem, não é simulação: são os 6×6×6 resultados possíveis, cada um
 * classificado e contado. É a prova mais forte que existe pra este jogo, porque o
 * espaço inteiro cabe numa varredura — qualquer número aqui é exato, não estimado.
 *
 * O que tem que sair, e é o que a mesa portuguesa diz:
 *
 *     Ases (soma 3) ................   1 de 216
 *     Pequeno (5, 6, 7) ............  31 de 216
 *     Grande (14, 15, 16) ..........  31 de 216
 *     Nulo (4, 8..13, 17, 18) ...... 153 de 216
 *                                    ───────────
 *                                    216
 *
 * E daí sai o resto: 63 combinações decidem, e é sobre essas 63 que o RTP é calculado —
 * não sobre as 216. Um lançamento nulo não cobra e não paga, então ele não entra na
 * conta do retorno. Ases paga 62× e acerta 1 em 63: 62/63 = 98,413%. Grande e Pequeno
 * pagam 2× e acertam 31 em 63: 62/63 = 98,413% também. As três casas têm exatamente o
 * mesmo RTP, e isso não é coincidência — é o desenho do jogo.
 */
import {
  BET_TYPES,
  PISO_EM_MINIMOS,
  TETO_EM_MINIMOS,
  WINNING_SUMS,
  ehApostaDeLinha,
  limitesDaCasa,
  problemaComApostaDaBanca,
  riscoDaAposta,
} from './banca-francesa.config';
import { classificar, resolveBets, theoreticalRtp } from './banca-francesa.engine';

let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

/* --- 1. a varredura --- */
console.log('--- 1. as 216 combinações, classificadas ---');
const contagem = { ases: 0, pequeno: 0, grande: 0, nulo: 0 };
const combinacoesPorSoma = new Map<number, number>();
for (let a = 1; a <= 6; a += 1) {
  for (let b = 1; b <= 6; b += 1) {
    for (let c = 1; c <= 6; c += 1) {
      const soma = a + b + c;
      combinacoesPorSoma.set(soma, (combinacoesPorSoma.get(soma) ?? 0) + 1);
      const resultado = classificar(soma);
      contagem[resultado ?? 'nulo'] += 1;
    }
  }
}

const total = contagem.ases + contagem.pequeno + contagem.grande + contagem.nulo;
confere('são exatamente 216 combinações', total === 216, String(total));
confere(`Ases: 1 combinação (a de três uns)`, contagem.ases === 1, String(contagem.ases));
confere(`Pequeno: 31 combinações`, contagem.pequeno === 31, String(contagem.pequeno));
confere(`Grande: 31 combinações`, contagem.grande === 31, String(contagem.grande));
confere(`Nulo: 153 combinações`, contagem.nulo === 153, String(contagem.nulo));

console.log('\n--- 2. a simetria: Grande é o espelho de Pequeno ---');
/*
 * Somar 21 menos a soma troca cada face por 7 menos ela — que é a face oposta do dado.
 * Então Pequeno e Grande TÊM que ter o mesmo número de combinações; se um dia não
 * tiverem, alguém mexeu numa das listas de somas e não na outra.
 */
const espelho = WINNING_SUMS.pequeno.map((s) => 21 - s).sort((x, y) => x - y);
confere('as somas do Grande são 21 menos as do Pequeno',
  espelho.join(',') === [...WINNING_SUMS.grande].sort((x, y) => x - y).join(','),
  `espelho ${espelho.join(',')} contra ${WINNING_SUMS.grande.join(',')}`);

console.log('\n--- 3. as somas nulas são exatamente as que sobram ---');
const decisivas = new Set([...WINNING_SUMS.ases, ...WINNING_SUMS.pequeno, ...WINNING_SUMS.grande]);
const nulasEsperadas = [4, 8, 9, 10, 11, 12, 13, 17, 18];
const nulasReais = [...combinacoesPorSoma.keys()].filter((s) => !decisivas.has(s)).sort((x, y) => x - y);
confere(`as somas nulas são ${nulasEsperadas.join(', ')}`,
  nulasReais.join(',') === nulasEsperadas.join(','), nulasReais.join(','));
confere('nenhuma soma é decisiva e nula ao mesmo tempo',
  nulasReais.every((s) => !decisivas.has(s)));

console.log('\n--- 4. o RTP, contado sobre os 63 lançamentos que decidem ---');
const DECISIVAS = 63;
for (const tipo of BET_TYPES) {
  const rtp = theoreticalRtp(tipo);
  const esperado = ehApostaDeLinha(tipo) ? (62 / DECISIVAS + 1) / 2 : 62 / DECISIVAS;
  confere(`${tipo}: RTP ${(rtp * 100).toFixed(3)}%`, Math.abs(rtp - esperado) < 1e-12,
    `esperado ${(esperado * 100).toFixed(3)}%`);
}
confere('centro: as três casas têm o MESMO RTP',
  new Set(['ases', 'pequeno', 'grande'].map((t) => theoreticalRtp(t as never).toFixed(12))).size === 1);
confere('linha: RTP maior que o do centro, porque metade não joga',
  theoreticalRtp('linha-grande') > theoreticalRtp('grande'));

console.log('\n--- 5. o pagamento de cada casa, contra o resultado ---');
{
  const aposta = (tipo: (typeof BET_TYPES)[number], valor: number) => ({ type: tipo, amount: valor });

  const ases = resolveBets('ases', [aposta('ases', 100)])[0];
  confere('Ases acertando devolve 6.200 sobre 100 (lucro de 61x)',
    ases.totalReturn === 6200 && ases.won, String(ases.totalReturn));
  confere('Ases errando devolve zero',
    resolveBets('grande', [aposta('ases', 100)])[0].totalReturn === 0);

  const grande = resolveBets('grande', [aposta('grande', 100)])[0];
  confere('Grande acertando devolve 200 sobre 100 (lucro de 1x)',
    grande.totalReturn === 200 && grande.won, String(grande.totalReturn));
  confere('Grande errando devolve zero',
    resolveBets('pequeno', [aposta('grande', 100)])[0].totalReturn === 0);

  const linhaGanha = resolveBets('grande', [aposta('linha-grande', 100)])[0];
  confere('Linha acertando devolve 150 sobre 100 (a aposta mais metade)',
    linhaGanha.totalReturn === 150 && linhaGanha.won, String(linhaGanha.totalReturn));
  const linhaPerde = resolveBets('pequeno', [aposta('linha-grande', 100)])[0];
  confere('Linha errando devolve 50 — a metade que nunca esteve em risco',
    linhaPerde.totalReturn === 50 && !linhaPerde.won, String(linhaPerde.totalReturn));

  confere('e o risco da linha é metade do valor da ficha',
    riscoDaAposta('linha-grande', 100) === 50 && riscoDaAposta('grande', 100) === 100);
}

console.log('\n--- 6. os limites por casa, numa mesa de mínimo 50 ---');
{
  const MIN = 50;
  const ases = limitesDaCasa('ases', MIN);
  confere(`Ases vai de ${ases.minimo} a ${ases.maximo} (6 mínimos)`,
    ases.minimo === 50 && ases.maximo === 300, `${ases.minimo}..${ases.maximo}`);
  const grande = limitesDaCasa('grande', MIN);
  confere(`Grande vai de ${grande.minimo} a ${grande.maximo} (200 mínimos)`,
    grande.minimo === 50 && grande.maximo === 10_000, `${grande.minimo}..${grande.maximo}`);
  const linha = limitesDaCasa('linha-grande', MIN);
  confere(`a Linha começa em ${linha.minimo} — o DOBRO do mínimo, porque vale metade`,
    linha.minimo === 100, String(linha.minimo));

  confere('uma ficha de 50 na linha é recusada (arriscaria 25 numa mesa de mínimo 50)',
    problemaComApostaDaBanca('linha-grande', 50, MIN) !== null);
  confere('uma ficha de 100 na linha é aceita (arrisca os 50 exigidos)',
    problemaComApostaDaBanca('linha-grande', 100, MIN) === null);
  confere('301 em Ases é recusado', problemaComApostaDaBanca('ases', 301, MIN) !== null);
  confere('300 em Ases é aceito', problemaComApostaDaBanca('ases', 300, MIN) === null);
  confere('10.001 em Grande é recusado', problemaComApostaDaBanca('grande', 10_001, MIN) !== null);
  confere('10.000 em Grande é aceito', problemaComApostaDaBanca('grande', 10_000, MIN) === null);
  confere('valor ímpar na linha é recusado', problemaComApostaDaBanca('linha-grande', 101, MIN) !== null);
  confere('valor com fração é recusado', problemaComApostaDaBanca('grande', 100.5, MIN) !== null);
  confere('zero é recusado', problemaComApostaDaBanca('grande', 0, MIN) !== null);

  console.log('\n     os limites acompanham o degrau da mesa:');
  for (const minimo of [50, 500, 5_000_000, 500_000_000]) {
    const a = limitesDaCasa('ases', minimo);
    const g = limitesDaCasa('grande', minimo);
    console.log(`     mínimo ${minimo.toLocaleString('pt-BR')}: Ases até ${a.maximo.toLocaleString('pt-BR')}, Grande até ${g.maximo.toLocaleString('pt-BR')}`);
    confere(`  o teto de Ases é ${TETO_EM_MINIMOS.ases}× o mínimo`, a.maximo === minimo * TETO_EM_MINIMOS.ases);
    confere(`  o piso da linha é ${PISO_EM_MINIMOS['linha-grande']}× o mínimo`,
      limitesDaCasa('linha-grande', minimo).minimo === minimo * PISO_EM_MINIMOS['linha-grande']);
  }
}

console.log(
  falhas === 0
    ? '\nOK: as 216 combinações batem, os pagamentos batem e os limites batem.'
    : `\n${falhas} FALHA(S)`,
);
process.exit(falhas === 0 ? 0 : 1);
