import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { LanceRegistrado, MaquinaDeRodada } from '../core/maquina-de-rodada';
import { bestHandOf, botDecision, buildDeck, compareHandValues, handLabel, PokerAction, shuffle } from './poker.engine';
import { apostasDaMesa, type ApostasDaMesa, Card, MAX_RAISES_PER_STREET } from './poker.config';
import { DegrauDoJogador } from '../shared/degrau-do-jogador.service';
import { faixaDeEntrada, problemaComAEntrada } from '../shared/niveis-de-mesa';

type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

interface PokerHand {
  /**
   * Blinds e apostas DESTA mão, derivadas do buy-in que foi pago.
   *
   * Ficam na mão e não no módulo porque duas pessoas podem estar jogando em degraus
   * diferentes ao mesmo tempo, e porque o buy-in não muda no meio de uma mão — congelar
   * aqui é o que garante que a aposta da quarta rua é a mesma que foi prometida na
   * primeira.
   */
  apostas: ApostasDaMesa;
  /**
   * O saldo de quem sentou, ANTES do débito da entrada — é ele que diz o degrau da
   * pessoa quando a partida acabar e o XP for somado. Guardado aqui porque a partida
   * dura minutos, e no fim o saldo já não é mais o de quem sentou.
   */
  saldoAntes: number;

  userId: string;
  buyIn: number;
  playerStack: number;
  botStack: number;
  pot: number;
  deck: Card[];
  playerHole: Card[];
  botHole: Card[];
  board: Card[];
  street: Street;
  playerBetThisStreet: number;
  botBetThisStreet: number;
  raisesThisStreet: number;
  streetActionCount: number;
  toAct: 'jogador' | 'bot';
  allInRunout: boolean;
  finished: boolean;
  lastEvent?: string;
  outcome?: {
    winner: 'jogador' | 'bot' | 'empate';
    potWon: number;
    playerHandLabel?: string;
    botHandLabel?: string;
    playerHole: Card[];
    botHole: Card[];
  };
}

/**
 * Heads-up limit hold'em contra bot — mesma ressalva de truco/dominó: multiplayer de
 * verdade precisa de sala + WebSocket, que não existe neste esqueleto. É o jogo mais
 * complexo dos 8 (avaliador de mão + apostas em várias ruas), por isso é o último a
 * ganhar motor no roadmap.
 */
/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'poker';

@Injectable()
export class PokerService {
  private readonly hands = new Map<string, PokerHand>();
  /**
   * A rodada registrada de cada partida em andamento.
   *
   * Fica fora do objeto da partida de propósito: aquele objeto é o ESTADO DO JOGO e vira
   * resposta pro cliente. A rodada guardada é infraestrutura, e não tem por que
   * atravessar a rede.
   */
  private readonly rodadaDaPartida = new Map<string, LanceRegistrado>();

  constructor(
    private readonly walletService: WalletService,
    private readonly degraus: DegrauDoJogador,
    private readonly tournaments: TournamentsService,
    private readonly maquina: MaquinaDeRodada,
  ) {}

  async getConfig(userId: string) {
    const quem = await this.degraus.de(userId);
    const faixa = faixaDeEntrada(quem.saldo, quem.nivel);

    /*
     * AS ENTRADAS VÊM PRONTAS, COM AS CEGAS DE CADA UMA — e é isso que impede a tela de
     * mentir. As cegas saem do buy-in agora; se a tela mostrasse "cegas 1/2" ao lado de um
     * seletor que vai até mil fichas, ela estaria anunciando um jogo e entregando outro.
     * Mandando a lista pronta, o rótulo de cada opção é o que a mão vai cobrar de verdade,
     * e nenhuma fórmula precisa ser copiada pro aplicativo.
     *
     * As opções são as FICHAS DO DEGRAU, as mesmas do trilho de aposta das outras mesas:
     * cinco valores, do mínimo ao teto, um toque cada.
     */
    const entradas = quem.degrau.fichas
      .filter((entrada) => entrada >= faixa.minimo && entrada <= faixa.maximo && entrada <= quem.saldo)
      .map((entrada) => ({ entrada, ...apostasDaMesa(entrada) }));

    return {
      minBuyIn: faixa.minimo,
      maxBuyIn: faixa.maximo,
      degrau: quem.degrau,
      entradas,
      /* As cegas da MENOR entrada, pra a tela ter o que mostrar antes de escolher. */
      ...apostasDaMesa(faixa.minimo),
    };
  }

  async newHand(userId: string, buyIn: number, actionId?: string) {
    const existing = this.hands.get(userId);
    if (existing && !existing.finished) {
      throw new BadRequestException('Você já tem uma mão de poker em andamento.');
    }
    const quem = await this.degraus.de(userId);
    const problema = problemaComAEntrada(buyIn, quem.saldo, quem.nivel);
    if (problema) throw new BadRequestException(problema);

    /* As apostas desta mão saem do buy-in DELA, e ficam guardadas: o buy-in não muda no meio. */
    const apostas = apostasDaMesa(buyIn);

    /*
     * O SALDO DE ANTES DA ENTRADA, guardado na partida.
     *
     * Ele é lido aqui e não no fim porque a partida dura minutos: no fim, o saldo já
     * passou pelo débito da entrada e por tudo que a pessoa fez em outra tela. O degrau
     * que vale pro XP é o de quem sentou — e é ele que faz a entrada de truco valer o
     * mesmo XP pra quem joga no Bronze e pra quem joga no Eclipse.
     */
    const saldoAntes = quem.saldo;

    /* A RODADA É REGISTRADA ANTES DE O DINHEIRO SE MEXER. Ver MaquinaDeRodada. */
    const rodada = await this.maquina.comecar({ jogo: GAME_ID, usuarioId: userId, apostas: { entrada: buyIn } });
    this.rodadaDaPartida.set(userId, rodada);
    await this.walletService.debit(userId, buyIn, 'aposta', GAME_ID, actionId, rodada.id);
    const deck = shuffle(buildDeck());
    const match: PokerHand = {
      userId,
      saldoAntes,
      buyIn,
      apostas,
      playerStack: buyIn - apostas.smallBlind,
      botStack: buyIn - apostas.bigBlind,
      pot: apostas.smallBlind + apostas.bigBlind,
      deck,
      playerHole: deck.splice(0, 2),
      botHole: deck.splice(0, 2),
      board: [],
      street: 'preflop',
      playerBetThisStreet: apostas.smallBlind,
      botBetThisStreet: apostas.bigBlind,
      raisesThisStreet: 0,
      streetActionCount: 0,
      toAct: 'jogador', // no heads-up, o botão (você) age primeiro no pré-flop
      allInRunout: false,
      finished: false,
      lastEvent: 'Cegas postadas — sua vez.',
    };
    this.hands.set(userId, match);
    return this.publicView(match);
  }

  act(userId: string, action: PokerAction) {
    const match = this.requireHand(userId);
    if (match.toAct !== 'jogador') {
      throw new BadRequestException('Não é sua vez.');
    }
    const legal = this.legalActions(match, 'jogador');
    if (!legal.includes(action)) {
      throw new BadRequestException(`Ação inválida agora — pode: ${legal.join(', ')}.`);
    }

    this.applyAction(match, 'jogador', action);
    this.runBotIfNeeded(match);
    return this.publicView(match);
  }

  private legalActions(match: PokerHand, actor: 'jogador' | 'bot'): PokerAction[] {
    const myBet = actor === 'jogador' ? match.playerBetThisStreet : match.botBetThisStreet;
    const otherBet = actor === 'jogador' ? match.botBetThisStreet : match.playerBetThisStreet;
    const myStack = actor === 'jogador' ? match.playerStack : match.botStack;
    const toCall = otherBet - myBet;

    const actions: PokerAction[] = ['desistir'];
    if (toCall <= 0) actions.push('passar');
    else if (myStack > 0) actions.push('pagar');
    if (myStack > 0 && !match.allInRunout && match.raisesThisStreet < MAX_RAISES_PER_STREET) actions.push('aumentar');
    return actions;
  }

  private applyAction(match: PokerHand, actor: 'jogador' | 'bot', action: PokerAction) {
    if (action === 'desistir') {
      match.lastEvent = actor === 'jogador' ? 'Você desistiu da mão.' : 'O bot desistiu da mão.';
      this.settleHand(match, actor === 'jogador' ? 'bot' : 'jogador');
      return;
    }

    const isPlayer = actor === 'jogador';
    const myBet = isPlayer ? match.playerBetThisStreet : match.botBetThisStreet;
    const otherBet = isPlayer ? match.botBetThisStreet : match.playerBetThisStreet;
    const myStack = isPlayer ? match.playerStack : match.botStack;

    let amount = 0;
    if (action === 'pagar') {
      amount = Math.min(otherBet - myBet, myStack);
    } else if (action === 'aumentar') {
      const betSize = match.street === 'preflop' || match.street === 'flop' ? match.apostas.smallBet : match.apostas.bigBet;
      const target = otherBet + betSize;
      amount = Math.min(target - myBet, myStack);
      match.raisesThisStreet += 1;
    }

    if (isPlayer) {
      match.playerStack -= amount;
      match.playerBetThisStreet += amount;
    } else {
      match.botStack -= amount;
      match.botBetThisStreet += amount;
    }
    match.pot += amount;
    match.streetActionCount += 1;
    match.lastEvent = `${isPlayer ? 'Você' : 'O bot'} ${action === 'pagar' ? 'pagou' : 'aumentou'}.`;

    if (match.playerStack === 0 || match.botStack === 0) {
      match.allInRunout = true;
    }

    if (this.isStreetComplete(match)) {
      this.advanceStreet(match);
    } else {
      match.toAct = isPlayer ? 'bot' : 'jogador';
    }
  }

  private isStreetComplete(match: PokerHand): boolean {
    return match.streetActionCount >= 2 && match.playerBetThisStreet === match.botBetThisStreet;
  }

  private advanceStreet(match: PokerHand) {
    match.streetActionCount = 0;
    match.raisesThisStreet = 0;
    match.playerBetThisStreet = 0;
    match.botBetThisStreet = 0;

    if (match.street === 'preflop') {
      match.board.push(...match.deck.splice(0, 3));
      match.street = 'flop';
    } else if (match.street === 'flop') {
      match.board.push(...match.deck.splice(0, 1));
      match.street = 'turn';
    } else if (match.street === 'turn') {
      match.board.push(...match.deck.splice(0, 1));
      match.street = 'river';
    } else {
      this.goToShowdown(match);
      return;
    }

    match.toAct = 'bot'; // pós-flop, quem não é o botão (o bot) age primeiro
  }

  private goToShowdown(match: PokerHand) {
    match.street = 'showdown';
    const playerValue = bestHandOf([...match.playerHole, ...match.board]);
    const botValue = bestHandOf([...match.botHole, ...match.board]);
    const comparison = compareHandValues(playerValue, botValue);
    const winner = comparison > 0 ? 'jogador' : comparison < 0 ? 'bot' : 'empate';
    this.settleHand(match, winner, handLabel(playerValue), handLabel(botValue));
  }

  private async settleHand(match: PokerHand, winner: 'jogador' | 'bot' | 'empate', playerHandLabel?: string, botHandLabel?: string) {
    match.finished = true;
    let potWon = 0;

    if (winner === 'jogador') {
      potWon = match.pot;
      match.playerStack += match.pot;
    } else if (winner === 'bot') {
      potWon = match.pot;
      match.botStack += match.pot;
    } else {
      const half = Math.floor(match.pot / 2);
      match.playerStack += half;
      match.botStack += match.pot - half;
      potWon = half;
    }
    match.pot = 0;

    match.outcome = {
      winner,
      potWon,
      playerHandLabel,
      botHandLabel,
      playerHole: match.playerHole,
      botHole: match.botHole,
    };

    if (match.playerStack > 0) {
      await this.walletService.credit(
        match.userId,
        match.playerStack,
        'premio',
        GAME_ID,
        undefined,
        this.rodadaDaPartida.get(match.userId)?.id,
      );
    }
    // O buy-in virou o stack da mão; o que sobrou dele é o retorno.
    await this.tournaments.recordRound(match.userId, GAME_ID, match.buyIn, match.playerStack, match.saldoAntes);

    const rodada = this.rodadaDaPartida.get(match.userId);
    if (rodada) {
      await rodada.terminar({
        resultado: { vencedor: winner, potWon, maoDoJogador: playerHandLabel, maoDoBot: botHandLabel },
        apostado: match.buyIn,
        retorno: match.playerStack,
        comAcoesDoJogador: true,
      });
      this.rodadaDaPartida.delete(match.userId);
    }
  }

  private runBotIfNeeded(match: PokerHand, depth = 0) {
    if (match.finished || match.toAct !== 'bot' || depth > 10) return;

    const legal = this.legalActions(match, 'bot');
    const betToCall = Math.max(0, match.playerBetThisStreet - match.botBetThisStreet);
    let suggestion = botDecision(match.botHole, match.board, betToCall);

    if (!legal.includes(suggestion)) {
      suggestion = legal.includes('pagar') ? 'pagar' : legal.includes('passar') ? 'passar' : 'desistir';
    }

    this.applyAction(match, 'bot', suggestion);
    this.runBotIfNeeded(match, depth + 1);
  }

  private requireHand(userId: string): PokerHand {
    const match = this.hands.get(userId);
    if (!match || match.finished) {
      throw new BadRequestException('Nenhuma mão de poker em andamento — comece uma nova.');
    }
    return match;
  }

  private async publicView(match: PokerHand) {
    return {
      buyIn: match.buyIn,
      playerStack: match.playerStack,
      botStack: match.botStack,
      pot: match.pot,
      playerHole: match.playerHole,
      board: match.board,
      street: match.street,
      playerBetThisStreet: match.playerBetThisStreet,
      botBetThisStreet: match.botBetThisStreet,
      toAct: match.toAct,
      legalActions: match.finished ? [] : this.legalActions(match, 'jogador'),
      finished: match.finished,
      outcome: match.outcome,
      lastEvent: match.lastEvent,
      newBalance: await this.walletService.balanceOf(match.userId),
    };
  }
}
