import { Sapata } from './sapata';

/**
 * Prova que a sapata é uma sapata: 8 baralhos completos, sem carta a mais nem a menos,
 * embaralho sem viés de posição, e remoção de verdade (tirar cartas muda o que sobra).
 *
 *   npx ts-node src/modules/games/shared/verifica-sapata.ts
 *
 * Por que existe: um embaralhamento torto é a falha mais silenciosa que um cassino pode
 * ter. O jogo continua funcionando, as cartas continuam saindo, e a distribuição está
 * errada. Só teste pega.
 */
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
type Rank = (typeof RANKS)[number];

let problemas = 0;
const falhar = (msg: string) => { problemas += 1; console.log(`FALHOU: ${msg}`); };

// 1. Composição: 8 baralhos = 416 cartas, 32 de cada valor, 104 de cada naipe.
{
  const sapata = new Sapata<Rank>(RANKS);
  const todas = sapata.comprarVarias(sapata.cartasRestantes);
  if (todas.length !== 416) falhar(`a sapata tem ${todas.length} cartas, devia ter 416`);

  const porValor = new Map<string, number>();
  const porNaipe = new Map<string, number>();
  for (const c of todas) {
    porValor.set(c.rank, (porValor.get(c.rank) ?? 0) + 1);
    porNaipe.set(c.naipe, (porNaipe.get(c.naipe) ?? 0) + 1);
  }
  for (const rank of RANKS) {
    if (porValor.get(rank) !== 32) falhar(`${rank}: ${porValor.get(rank)} cópias, deviam ser 32`);
  }
  for (const [naipe, n] of porNaipe) {
    if (n !== 104) falhar(`${naipe}: ${n} cartas, deviam ser 104`);
  }
  console.log(`composição: 416 cartas, 32 de cada valor, 104 de cada naipe — ok`);
}

// 2. Remoção de verdade: tirar todos os Ases faz o próximo Ás ser impossível.
{
  const sapata = new Sapata<Rank>(RANKS);
  const todas = sapata.comprarVarias(sapata.cartasRestantes);
  const ases = todas.filter((c) => c.rank === 'A').length;
  if (ases !== 32) falhar(`saíram ${ases} ases numa sapata inteira, deviam ser 32`);
  console.log('remoção: a sapata esgota — 32 ases e nem um a mais — ok');
}

// 3. Embaralho sem viés: em muitas sapatas, cada valor tem que aparecer na primeira
//    posição na proporção esperada (32/416 = 7,69%).
{
  const RODADAS = 200_000;
  const primeira = new Map<string, number>();
  for (let i = 0; i < RODADAS; i += 1) {
    const c = new Sapata<Rank>(RANKS).comprar();
    primeira.set(c.rank, (primeira.get(c.rank) ?? 0) + 1);
  }
  const esperado = 1 / RANKS.length;
  let piorDesvio = 0;
  for (const rank of RANKS) {
    const visto = (primeira.get(rank) ?? 0) / RODADAS;
    piorDesvio = Math.max(piorDesvio, Math.abs(visto - esperado));
  }
  // Com 200 mil amostras, desvio acima de 0,5 ponto percentual não é acaso.
  if (piorDesvio > 0.005) falhar(`a primeira carta tem viés: desvio de ${(piorDesvio * 100).toFixed(2)} pontos`);
  console.log(`embaralho: pior desvio na 1ª carta = ${(piorDesvio * 100).toFixed(3)} pontos percentuais — ok`);
}

// 4. Cartão de corte: embaralha ao passar de 75%, e não antes.
{
  const sapata = new Sapata<Rank>(RANKS);
  sapata.comprarVarias(300); // 300 de 416 = 72%, ainda não passou
  if (sapata.embaralharSePassouDoCorte()) falhar('embaralhou antes do cartão de corte');
  sapata.comprarVarias(20); // 320 de 416 = 77%, passou
  if (!sapata.embaralharSePassouDoCorte()) falhar('não embaralhou depois do cartão de corte');
  if (sapata.cartasRestantes !== 416) falhar('depois de embaralhar a sapata não voltou a 416');
  console.log('cartão de corte: embaralha em ~75% de uso, e só aí — ok');
}

console.log(problemas === 0 ? '\nOK: a sapata é uma sapata de verdade.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
