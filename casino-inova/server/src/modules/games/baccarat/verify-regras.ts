import { playRound } from './baccarat.engine';
import { Rank } from './baccarat.config';

/**
 * Confere a tabela de compra da 3ª carta do bacará EXAUSTIVAMENTE, caso a caso, contra
 * a tabela publicada (Wizard of Odds, conferida em agosto/2026).
 *
 * Isto é melhor do que medir RTP por simulação: simulação diz que a média está perto do
 * esperado, e uma regra errada num canto raro da tabela se esconde dentro do ruído. Aqui
 * cada uma das 80 combinações (banca 0-7 x 3ª carta do jogador 0-9) é testada de forma
 * determinística, mais as regras de parada e de natural.
 *
 * Só dá pra fazer isso porque o motor recebe de ONDE tirar as cartas — dá pra montar a
 * situação exata em vez de esperar ela aparecer sozinha.
 *
 *   npx ts-node src/modules/games/baccarat/verify-regras.ts
 */

/** Uma carta com o valor de contagem pedido. 0 vira 10 (que vale zero no bacará). */
function cartaDeValor(valor: number): Rank {
  if (valor === 0) return '10';
  if (valor === 1) return 'A';
  return String(valor) as Rank;
}

/** Joga uma rodada com as cartas saindo exatamente nesta ordem. */
function rodadaComCartas(cartas: Rank[]) {
  let i = 0;
  return playRound(() => {
    if (i >= cartas.length) throw new Error('a rodada pediu mais cartas do que o teste preparou');
    return cartas[i++];
  });
}

/** O que a tabela publicada manda a banca fazer. */
function bancaDeveComprar(totalDaBanca: number, terceiraDoJogador: number): boolean {
  if (totalDaBanca <= 2) return true;
  if (totalDaBanca === 3) return terceiraDoJogador !== 8;
  if (totalDaBanca === 4) return terceiraDoJogador >= 2 && terceiraDoJogador <= 7;
  if (totalDaBanca === 5) return terceiraDoJogador >= 4 && terceiraDoJogador <= 7;
  if (totalDaBanca === 6) return terceiraDoJogador === 6 || terceiraDoJogador === 7;
  return false; // 7 nunca compra
}

let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

// --- 1. A tabela inteira: 8 totais da banca x 10 valores da 3ª carta do jogador ---
let conferidas = 0;
for (let totalDaBanca = 0; totalDaBanca <= 7; totalDaBanca += 1) {
  for (let terceira = 0; terceira <= 9; terceira += 1) {
    // Jogador com 2 (compra); banca com o total pedido. Ordem: J, B, J, B, 3ªJ, 3ªB.
    const cartas: Rank[] = [
      '10', '10',                                     // p1 = 0, b1 = 0
      '2', cartaDeValor(totalDaBanca),                // p2 = 2 (jogador soma 2), b2 = total da banca
      cartaDeValor(terceira),                         // 3ª do jogador
      '5',                                            // 3ª da banca, se ela comprar
    ];
    const r = rodadaComCartas(cartas);

    if (r.playerCards.length !== 3) {
      falhar(`jogador com 2 pontos não comprou (banca ${totalDaBanca}, 3ª ${terceira})`);
      continue;
    }
    const comprou = r.bankerCards.length === 3;
    const deveria = bancaDeveComprar(totalDaBanca, terceira);
    if (comprou !== deveria) {
      falhar(`banca com ${totalDaBanca} e 3ª do jogador ${terceira}: ${comprou ? 'comprou' : 'parou'}, devia ${deveria ? 'comprar' : 'parar'}`);
    }
    conferidas += 1;
  }
}
console.log(`tabela da 3ª carta: ${conferidas} combinações conferidas uma a uma`);

// --- 2. Jogador para com 6 e 7, compra de 0 a 5 ---
for (let total = 0; total <= 7; total += 1) {
  if (total >= 8) continue;
  // Jogador com o total pedido, banca com 7 (que nunca compra e nunca é natural).
  const cartas: Rank[] = ['10', '10', cartaDeValor(total), '7', '5', '5'];
  const r = rodadaComCartas(cartas);
  const comprou = r.playerCards.length === 3;
  const deveria = total <= 5;
  if (comprou !== deveria) {
    falhar(`jogador com ${total}: ${comprou ? 'comprou' : 'parou'}, devia ${deveria ? 'comprar' : 'parar'}`);
  }
}
console.log('parada do jogador: compra de 0 a 5, para em 6 e 7 — ok');

// --- 3. Natural: 8 ou 9 nas duas primeiras trava os dois lados ---
for (const natural of [8, 9]) {
  const doJogador = rodadaComCartas(['10', '10', cartaDeValor(natural), '2', '5', '5']);
  if (doJogador.playerCards.length !== 2 || doJogador.bankerCards.length !== 2) {
    falhar(`jogador com natural ${natural}: alguém comprou carta e não devia`);
  }
  const daBanca = rodadaComCartas(['10', '10', '2', cartaDeValor(natural), '5', '5']);
  if (daBanca.playerCards.length !== 2 || daBanca.bankerCards.length !== 2) {
    falhar(`banca com natural ${natural}: alguém comprou carta e não devia`);
  }
}
console.log('natural: 8 ou 9 nas duas primeiras para os dois lados — ok');

console.log(problemas === 0 ? '\nOK: a tabela de compra do bacará bate com a publicada, caso a caso.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
