import { quemAbre } from './domino.engine';
import { buildTileSet, HAND_SIZE, Tile } from './domino.config';
import { shuffle } from './domino.engine';

/**
 * Confere a regra de abertura do dominó: abre quem tem a MAIOR DUPLA, e se ninguém tem
 * dupla, quem tem a peça de maior soma.
 *
 * Por que existe: antes o jogador abria sempre, e abrir é vantagem. Um erro aqui não
 * quebra nada visível — a partida roda igual — e simplesmente entrega vantagem pro
 * mesmo lado toda vez.
 *
 *   npx ts-node src/modules/games/domino/verify-abertura.ts
 */
let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };
const nome = (t: Tile) => `${t.a}-${t.b}`;

// --- 1. Casos montados à mão, onde a resposta certa é óbvia ---
{
  // Uma dupla de cada lado: ganha a maior.
  const a: Tile[] = [{ a: 3, b: 3 }, { a: 6, b: 5 }];
  const b: Tile[] = [{ a: 5, b: 5 }, { a: 6, b: 4 }];
  const r = quemAbre([a, b]);
  if (r.indice !== 1 || nome(r.peca) !== '5-5') falhar(`5-5 devia ganhar de 3-3, veio ${nome(r.peca)} do jogador ${r.indice}`);
}
{
  // Dupla pequena contra peça grande: a dupla ganha, mesmo somando menos.
  const a: Tile[] = [{ a: 0, b: 0 }];        // dupla, soma 0
  const b: Tile[] = [{ a: 6, b: 5 }];        // soma 11, mas não é dupla
  const r = quemAbre([a, b]);
  if (r.indice !== 0 || nome(r.peca) !== '0-0') falhar(`0-0 é dupla e devia abrir, veio ${nome(r.peca)}`);
}
{
  // Ninguém tem dupla: ganha a de maior soma.
  const a: Tile[] = [{ a: 6, b: 4 }, { a: 3, b: 1 }];   // 10
  const b: Tile[] = [{ a: 6, b: 5 }, { a: 2, b: 0 }];   // 11
  const r = quemAbre([a, b]);
  if (r.indice !== 1 || nome(r.peca) !== '6-5') falhar(`sem duplas devia abrir 6-5, veio ${nome(r.peca)}`);
}
console.log('casos montados: maior dupla ganha, dupla ganha de peça comum, sem dupla vale a maior soma — ok');

// --- 2. Em muitas distribuições reais, a peça escolhida tem que ser a melhor de todas ---
const RODADAS = 50_000;
let comDupla = 0;
for (let i = 0; i < RODADAS; i += 1) {
  const deck = shuffle(buildTileSet());
  const maos = [deck.splice(0, HAND_SIZE), deck.splice(0, HAND_SIZE)];
  const escolhida = quemAbre(maos);

  const todas = maos.flat();
  const duplas = todas.filter((t) => t.a === t.b);
  if (duplas.length > 0) {
    comDupla += 1;
    const maiorDupla = Math.max(...duplas.map((t) => t.a));
    if (escolhida.peca.a !== escolhida.peca.b || escolhida.peca.a !== maiorDupla) {
      falhar(`tinha dupla ${maiorDupla}-${maiorDupla} nas mãos e abriu ${nome(escolhida.peca)}`);
      break;
    }
  } else {
    const maiorSoma = Math.max(...todas.map((t) => t.a + t.b));
    if (escolhida.peca.a + escolhida.peca.b !== maiorSoma) {
      falhar(`sem duplas, a maior soma era ${maiorSoma} e abriu ${nome(escolhida.peca)}`);
      break;
    }
  }

  // A peça escolhida tem que estar mesmo na mão de quem foi apontado.
  if (!maos[escolhida.indice].some((t) => t.a === escolhida.peca.a && t.b === escolhida.peca.b)) {
    falhar('a peça de abertura não está na mão de quem foi apontado pra abrir');
    break;
  }
}
console.log(`${RODADAS.toLocaleString('pt-BR')} distribuições reais conferidas (${comDupla} com dupla nas mãos) — ok`);

console.log(problemas === 0 ? '\nOK: abre quem tem a maior peça, dos dois lados.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
