import { dealerShouldDraw, handValue, isBust, isNatural, isPair, isSoft } from './blackjack.engine';
import { BLACKJACK_PAYOUT_MULTIPLIER, MAX_HANDS, RANKS, Rank } from './blackjack.config';
import { Sapata } from '../shared/sapata';

/**
 * Blackjack não tem RTP fixo: depende de como o jogador joga. Então a prova de que o
 * jogo está certo é outra — jogando ESTRATÉGIA BÁSICA correta, a vantagem da casa tem
 * que cair onde a literatura diz que cai.
 *
 * Com estas regras (8 baralhos, dealer para em todo 17, dobrar depois de dividir
 * permitido, blackjack paga 3:2, sem desistência), a referência publicada é uma
 * vantagem da casa de ~0,43% a ~0,50% — ou seja, RTP entre 99,5% e 99,57%.
 *
 * É por isso que este teste vale: dobrar e dividir são metade da estratégia básica. Se
 * estiverem implementados errado — ou faltando, como estavam —, o número não chega
 * nem perto, e é assim que dá pra saber sem depender de olhar a tela.
 *
 * Para comparação, o teste também roda a estratégia ingênua de antes (pedir até 17,
 * sem nunca dobrar nem dividir), pra deixar medido o quanto o jogador estava perdendo
 * por não ter essas jogadas.
 *
 *   npx ts-node src/modules/games/blackjack/verify-strategy.ts
 */
const MAOS = 2_000_000;
const APOSTA = 100;

/** O valor de contagem da carta aberta do dealer. Ás vira 11. */
function valorDaCarta(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

type Jogada = 'comprar' | 'parar' | 'dobrar' | 'dividir';

/**
 * Estratégia básica para 8 baralhos, dealer parando no soft 17, com dobrar-depois-de-
 * dividir. Escrita como tabela mesmo, porque é uma tabela — qualquer "esperteza" aqui
 * inventaria uma estratégia que não é a de referência e invalidaria a medição.
 */
function estrategiaBasica(mao: Rank[], aberta: Rank, podeDobrar: boolean, podeDividir: boolean): Jogada {
  const d = valorDaCarta(aberta);
  const total = handValue(mao);

  if (podeDividir && isPair(mao)) {
    const par = valorDaCarta(mao[0]);
    if (par === 11) return 'dividir';                                  // A,A sempre
    if (par === 10) return 'parar';                                    // 10,10 nunca
    if (par === 9) return d === 7 || d === 10 || d === 11 ? 'parar' : 'dividir';
    if (par === 8) return 'dividir';                                   // 8,8 sempre
    if (par === 7) return d <= 7 ? 'dividir' : 'comprar';
    if (par === 6) return d <= 6 ? 'dividir' : 'comprar';
    if (par === 4) return d === 5 || d === 6 ? 'dividir' : 'comprar';
    if (par === 3 || par === 2) return d <= 7 ? 'dividir' : 'comprar';
    // 5,5 nunca divide: joga como 10 e cai nas regras de total duro abaixo.
  }

  if (isSoft(mao) && mao.length >= 2) {
    // Total mole: o Ás ainda vale 11, então comprar não estoura.
    if (total >= 19) return 'parar';
    if (total === 18) {
      if (podeDobrar && d >= 3 && d <= 6) return 'dobrar';
      return d === 2 || d === 7 || d === 8 ? 'parar' : 'comprar';
    }
    if (total === 17) return podeDobrar && d >= 3 && d <= 6 ? 'dobrar' : 'comprar';
    if (total === 16 || total === 15) return podeDobrar && d >= 4 && d <= 6 ? 'dobrar' : 'comprar';
    if (total === 14 || total === 13) return podeDobrar && d >= 5 && d <= 6 ? 'dobrar' : 'comprar';
    return 'comprar';
  }

  // Total duro.
  if (total >= 17) return 'parar';
  if (total >= 13) return d <= 6 ? 'parar' : 'comprar';
  if (total === 12) return d >= 4 && d <= 6 ? 'parar' : 'comprar';
  if (total === 11) return podeDobrar && d !== 11 ? 'dobrar' : 'comprar';
  if (total === 10) return podeDobrar && d <= 9 ? 'dobrar' : 'comprar';
  if (total === 9) return podeDobrar && d >= 3 && d <= 6 ? 'dobrar' : 'comprar';
  return 'comprar';
}

interface Mao {
  cartas: Rank[];
  aposta: number;
  deSplit: boolean;
  deSplitDeAses: boolean;
  encerrada: boolean;
}

/** Uma mão completa, do jeito que o serviço joga. Devolve [apostado, devolvido]. */
function jogarUmaMao(sapata: Sapata<Rank>, usarEstrategia: boolean): [number, number] {
  sapata.embaralharSePassouDoCorte();
  const p1 = sapata.comprar().rank;
  const d1 = sapata.comprar().rank;
  const p2 = sapata.comprar().rank;
  const d2 = sapata.comprar().rank;

  const dealer: Rank[] = [d1, d2];
  const maos: Mao[] = [{ cartas: [p1, p2], aposta: APOSTA, deSplit: false, deSplitDeAses: false, encerrada: false }];
  let apostado = APOSTA;

  // Blackjack de qualquer lado encerra na hora (o dealer espia com Ás ou 10).
  if (isNatural(maos[0].cartas) || isNatural(dealer)) {
    return [apostado, resolverUma(maos[0], dealer)];
  }

  for (let i = 0; i < maos.length; i += 1) {
    const mao = maos[i];
    while (!mao.encerrada) {
      const podeDobrar = mao.cartas.length === 2 && !mao.deSplitDeAses;
      const podeDividir = isPair(mao.cartas) && maos.length < MAX_HANDS && !mao.deSplitDeAses;

      const jogada: Jogada = usarEstrategia
        ? estrategiaBasica(mao.cartas, d1, podeDobrar, podeDividir)
        : handValue(mao.cartas) < 17 ? 'comprar' : 'parar';

      if (jogada === 'parar') { mao.encerrada = true; break; }

      if (jogada === 'dobrar' && podeDobrar) {
        apostado += mao.aposta;
        mao.aposta *= 2;
        mao.cartas.push(sapata.comprar().rank);
        mao.encerrada = true;
        break;
      }

      if (jogada === 'dividir' && podeDividir) {
        apostado += APOSTA;
        const eramAses = mao.cartas[0] === 'A';
        const segunda = mao.cartas.pop()!;
        mao.deSplit = true;
        mao.deSplitDeAses = eramAses;
        mao.cartas.push(sapata.comprar().rank);
        const nova: Mao = {
          cartas: [segunda, sapata.comprar().rank],
          aposta: APOSTA,
          deSplit: true,
          deSplitDeAses: eramAses,
          encerrada: eramAses,
        };
        maos.splice(i + 1, 0, nova);
        if (eramAses) { mao.encerrada = true; break; }
        continue;
      }

      mao.cartas.push(sapata.comprar().rank);
      if (isBust(mao.cartas) || handValue(mao.cartas) === 21) mao.encerrada = true;
    }
  }

  if (maos.some((m) => !isBust(m.cartas))) {
    while (dealerShouldDraw(dealer)) dealer.push(sapata.comprar().rank);
  }

  return [apostado, maos.reduce((soma, m) => soma + resolverUma(m, dealer), 0)];
}

function resolverUma(mao: Mao, dealer: Rank[]): number {
  if (isBust(mao.cartas)) return 0;
  const meuBJ = isNatural(mao.cartas, mao.deSplit);
  const dealerBJ = isNatural(dealer);
  if (meuBJ && dealerBJ) return mao.aposta;
  if (meuBJ) return mao.aposta * BLACKJACK_PAYOUT_MULTIPLIER;
  if (dealerBJ) return 0;
  if (isBust(dealer)) return mao.aposta * 2;
  const meu = handValue(mao.cartas);
  const dele = handValue(dealer);
  if (meu > dele) return mao.aposta * 2;
  if (meu < dele) return 0;
  return mao.aposta;
}

for (const [nome, usarEstrategia] of [['estratégia básica', true], ['ingênua (pedir até 17, sem dobrar nem dividir)', false]] as const) {
  const sapata = new Sapata<Rank>(RANKS);
  let apostado = 0;
  let devolvido = 0;
  for (let i = 0; i < MAOS; i += 1) {
    const [a, d] = jogarUmaMao(sapata, usarEstrategia);
    apostado += a;
    devolvido += d;
  }
  const rtp = devolvido / apostado;
  console.log(`${nome}: RTP ${(rtp * 100).toFixed(2)}%  (vantagem da casa ${((1 - rtp) * 100).toFixed(2)}%)`);
}
console.log(`\n${MAOS.toLocaleString('pt-BR')} mãos cada, sapata de 8 baralhos.`);
console.log('Referência publicada pra estas regras: vantagem da casa entre 0,43% e 0,50%.');
