import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { drawCard, handValue, isBust, isNatural, playDealer, resolve, Resolution } from './blackjack.engine';
import { BLACKJACK_PAYOUT_MULTIPLIER, DEALER_STANDS_ON, MAX_BET, MIN_BET, Naipe, NAIPES, Rank } from './blackjack.config';

/** Uma carta na mesa: o valor, que decide tudo, e o naipe, que só decide o desenho. */
interface Carta {
  rank: Rank;
  naipe: Naipe;
}

/** O nome da imagem no app — 'copas-A', 'espadas-10'. */
function nomeDaCarta(carta: Carta): string {
  return `${carta.naipe}-${carta.rank}`;
}

/**
 * Compra uma carta: o valor sai do motor, o naipe é sorteado aqui.
 *
 * `naMesa` existe só pra evitar que a mesma carta apareça duas vezes na mesma mão. O
 * baralho é infinito de propósito (cada valor sorteado com reposição, sem contagem
 * possível), então repetir valor é normal e continua acontecendo — mas ver dois K de
 * ouros idênticos lado a lado parece defeito, e não regra. Quando o valor repete, o
 * naipe escolhido é um dos que ainda não saíram naquele valor.
 *
 * Isso NÃO mexe em probabilidade nenhuma: o valor já foi sorteado antes desta linha, e
 * naipe não vale nada no blackjack. É escolha de desenho, não de jogo.
 */
function comprarCarta(naMesa: Carta[] = []): Carta {
  const rank = drawCard();
  return { rank, naipe: naipeLivre(rank, naMesa) };
}

/** Um naipe que ainda não saiu com esse valor na mesa; qualquer um se todos já saíram. */
function naipeLivre(rank: Rank, naMesa: Carta[]): Naipe {
  const usados = new Set(naMesa.filter((c) => c.rank === rank).map((c) => c.naipe));
  const livres = NAIPES.filter((naipe) => !usados.has(naipe));
  const opcoes = livres.length > 0 ? livres : NAIPES;
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}

/** O motor só entende valor; o naipe fica de fora das contas de propósito. */
function valores(cartas: Carta[]): Rank[] {
  return cartas.map((carta) => carta.rank);
}

interface HandState {
  bet: number;
  playerCards: Carta[];
  dealerCards: Carta[];
  finished: boolean;
}

/**
 * Uma mão passa por várias chamadas (apostar → pedir carta* → parar), então precisa
 * de estado entre requisições — igual ao saldo, fica em memória nesta v1 e some se o
 * servidor reiniciar. Uma tabela `blackjack_hands` no Postgres resolve isso na Fase 0 real.
 */
/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'blackjack';

@Injectable()
export class BlackjackService {
  private readonly hands = new Map<string, HandState>();

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
  ) {}

  getConfig() {
    return {
      minBet: MIN_BET,
      maxBet: MAX_BET,
      blackjackPayoutMultiplier: BLACKJACK_PAYOUT_MULTIPLIER,
      dealerStandsOn: DEALER_STANDS_ON,
    };
  }

  async startHand(userId: string, bet: number) {
    const existing = this.hands.get(userId);
    if (existing && !existing.finished) {
      throw new BadRequestException('Você já tem uma mão em andamento — pare ou espere ela terminar antes de apostar de novo.');
    }
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }

    await this.walletService.debit(userId, bet, 'aposta', GAME_ID);
    /*
     * As quatro primeiras cartas são compradas em sequência, cada uma enxergando as
     * anteriores — é isso que impede a mesa de abrir com duas cartas idênticas.
     */
    const naMesa: Carta[] = [];
    const comprar = () => {
      const carta = comprarCarta(naMesa);
      naMesa.push(carta);
      return carta;
    };
    const hand: HandState = {
      bet,
      playerCards: [comprar(), comprar()],
      dealerCards: [comprar(), comprar()],
      finished: false,
    };
    this.hands.set(userId, hand);

    if (isNatural(valores(hand.playerCards)) || isNatural(valores(hand.dealerCards))) {
      return this.finish(userId, hand);
    }
    return this.publicView(userId, hand);
  }

  hit(userId: string) {
    const hand = this.requireHand(userId);
    hand.playerCards.push(comprarCarta([...hand.playerCards, ...hand.dealerCards]));
    if (isBust(valores(hand.playerCards))) {
      return this.finish(userId, hand);
    }
    return this.publicView(userId, hand);
  }

  stand(userId: string) {
    const hand = this.requireHand(userId);
    /*
     * O motor devolve a mão do dealer já completa, em valores. As cartas que ele
     * comprou a mais precisam ganhar naipe aqui — as que já estavam mantêm o delas.
     */
    const valoresFinais = playDealer(valores(hand.dealerCards));
    const jaNaMesa: Carta[] = [...hand.playerCards];
    hand.dealerCards = valoresFinais.map((rank, indice) => {
      const antiga = hand.dealerCards[indice];
      const carta = antiga?.rank === rank ? antiga : { rank, naipe: naipeLivre(rank, jaNaMesa) };
      jaNaMesa.push(carta);
      return carta;
    });
    return this.finish(userId, hand);
  }

  private requireHand(userId: string): HandState {
    const hand = this.hands.get(userId);
    if (!hand || hand.finished) {
      throw new BadRequestException('Nenhuma mão em andamento — aposte primeiro.');
    }
    return hand;
  }

  private async finish(userId: string, hand: HandState) {
    hand.finished = true;
    const resolution = resolve(valores(hand.playerCards), valores(hand.dealerCards), hand.bet);
    if (resolution.totalReturn > 0) {
      await this.walletService.credit(userId, resolution.totalReturn, 'premio', GAME_ID);
    }
    // A rodada de torneio é a mão inteira, contada só quando ela fecha.
    await this.tournaments.recordRound(userId, GAME_ID, hand.bet, resolution.totalReturn);
    return this.publicView(userId, hand, resolution);
  }

  private async publicView(userId: string, hand: HandState, resolution?: Resolution) {
    const dealerCards: (string | null)[] = hand.finished
      ? hand.dealerCards.map(nomeDaCarta)
      : [nomeDaCarta(hand.dealerCards[0]), null];
    return {
      playerCards: hand.playerCards.map(nomeDaCarta),
      playerTotal: handValue(valores(hand.playerCards)),
      dealerCards,
      dealerTotal: hand.finished ? handValue(valores(hand.dealerCards)) : undefined,
      bet: hand.bet,
      finished: hand.finished,
      outcome: resolution?.outcome,
      totalReturn: resolution?.totalReturn,
      newBalance: await this.walletService.balanceOf(userId),
    };
  }
}
