import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { BoardEnd, canPlay, chooseBotMove, otherEnd, quemAbre, shuffle, tileMatches, tileSum } from './domino.engine';
import { buildTileSet, HAND_SIZE, MATCH_WIN_TOTAL_MULTIPLIER, MAX_BUY_IN, MIN_BUY_IN, Tile } from './domino.config';

interface DominoMatch {
  buyIn: number;
  playerHand: Tile[];
  botHand: Tile[];
  boardTiles: Tile[];
  leftEnd: number | null;
  rightEnd: number | null;
  consecutivePasses: number;
  /** A peça com que a partida tem que abrir, quando é o jogador quem abre. */
  aberturaObrigatoria?: Tile;
  finished: boolean;
  matchOutcome?: 'jogador' | 'bot' | 'empate';
  lastEvent?: string;
}

/**
 * Contra bot, mesma ressalva do truco: dominó multiplayer de verdade precisa de sala
 * + WebSocket, que não existe neste esqueleto ainda. O jogador sempre abre a partida
 * (simplificação — dominó de verdade decide quem abre pela maior pedra dupla).
 */
/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'domino';

@Injectable()
export class DominoService {
  private readonly matches = new Map<string, DominoMatch>();

  constructor(
    private readonly walletService: WalletService,
    private readonly tournaments: TournamentsService,
  ) {}

  getConfig() {
    return { minBuyIn: MIN_BUY_IN, maxBuyIn: MAX_BUY_IN, handSize: HAND_SIZE };
  }

  async newMatch(userId: string, buyIn: number, actionId?: string) {
    const existing = this.matches.get(userId);
    if (existing && !existing.finished) {
      throw new BadRequestException('Você já tem uma partida de dominó em andamento.');
    }
    if (!Number.isFinite(buyIn) || buyIn < MIN_BUY_IN || buyIn > MAX_BUY_IN) {
      throw new BadRequestException(`O buy-in precisa estar entre ${MIN_BUY_IN} e ${MAX_BUY_IN} fichas.`);
    }

    await this.walletService.debit(userId, buyIn, 'aposta', GAME_ID, actionId);
    const deck = shuffle(buildTileSet());
    const match: DominoMatch = {
      buyIn,
      playerHand: deck.splice(0, HAND_SIZE),
      botHand: deck.splice(0, HAND_SIZE),
      boardTiles: [],
      leftEnd: null,
      rightEnd: null,
      consecutivePasses: 0,
      finished: false,
    };
    this.matches.set(userId, match);

    /*
     * Abre quem tem a maior dupla — e é obrigado a abrir com ela. Se calhar do bot, ele
     * já joga a peça aqui e a vez volta pro jogador; se for do jogador, a peça fica
     * anotada em `aberturaObrigatoria` e a tela só deixa jogar aquela.
     */
    const abertura = quemAbre([match.playerHand, match.botHand]);
    if (abertura.indice === 1) {
      match.botHand = match.botHand.filter((t) => !(t.a === abertura.peca.a && t.b === abertura.peca.b));
      match.boardTiles.push(abertura.peca);
      match.leftEnd = abertura.peca.a;
      match.rightEnd = abertura.peca.b;
      match.lastEvent = `O bot tinha a maior peça (${abertura.peca.a}-${abertura.peca.b}) e abriu com ela.`;
    } else {
      match.aberturaObrigatoria = abertura.peca;
      match.lastEvent = `Você tem a maior peça (${abertura.peca.a}-${abertura.peca.b}) — a partida abre com ela.`;
    }

    return this.publicView(userId, match);
  }

  playTile(userId: string, tile: Tile, end?: BoardEnd) {
    const match = this.requireMatch(userId);
    const handIndex = match.playerHand.findIndex((item) => item.a === tile.a && item.b === tile.b);
    if (handIndex === -1) {
      throw new BadRequestException('Essa peça não está na sua mão.');
    }

    if (match.leftEnd === null) {
      const obrigatoria = match.aberturaObrigatoria;
      if (obrigatoria && !(tile.a === obrigatoria.a && tile.b === obrigatoria.b)) {
        throw new BadRequestException(
          `A partida abre com a maior peça: ${obrigatoria.a}-${obrigatoria.b}.`,
        );
      }
      match.aberturaObrigatoria = undefined;
      match.leftEnd = tile.a;
      match.rightEnd = tile.b;
    } else {
      if (end !== 'esquerda' && end !== 'direita') {
        throw new BadRequestException('Informe em qual ponta jogar: "esquerda" ou "direita".');
      }
      const targetValue = end === 'esquerda' ? match.leftEnd : match.rightEnd!;
      if (!tileMatches(tile, targetValue)) {
        throw new BadRequestException('Essa peça não encaixa nessa ponta.');
      }
      const newValue = otherEnd(tile, targetValue);
      if (end === 'esquerda') match.leftEnd = newValue;
      else match.rightEnd = newValue;
    }

    match.playerHand.splice(handIndex, 1);
    match.boardTiles.push(tile);
    match.consecutivePasses = 0;

    if (match.playerHand.length === 0) {
      match.lastEvent = 'Você bateu — ficou sem peças!';
      this.awardMatch(userId, match, 'jogador');
      return this.publicView(userId, match);
    }

    this.runBotTurn(userId, match);
    return this.publicView(userId, match);
  }

  passTurn(userId: string) {
    const match = this.requireMatch(userId);
    if (canPlay(match.playerHand, match.leftEnd, match.rightEnd)) {
      throw new BadRequestException('Você tem uma peça jogável — não pode passar.');
    }

    match.consecutivePasses += 1;
    match.lastEvent = 'Você passou a vez.';

    if (match.consecutivePasses >= 2) {
      this.resolveBlockedGame(userId, match);
      return this.publicView(userId, match);
    }

    this.runBotTurn(userId, match);
    return this.publicView(userId, match);
  }

  private runBotTurn(userId: string, match: DominoMatch) {
    if (match.finished) return;

    const move = match.leftEnd === null ? null : chooseBotMove(match.botHand, match.leftEnd, match.rightEnd!);
    if (!move) {
      match.consecutivePasses += 1;
      match.lastEvent = (match.lastEvent ? match.lastEvent + ' ' : '') + 'O bot passou a vez.';
      if (match.consecutivePasses >= 2) {
        this.resolveBlockedGame(userId, match);
      }
      return;
    }

    const targetValue = move.end === 'esquerda' ? match.leftEnd! : match.rightEnd!;
    const newValue = otherEnd(move.tile, targetValue);
    if (move.end === 'esquerda') match.leftEnd = newValue;
    else match.rightEnd = newValue;

    match.botHand = match.botHand.filter((item) => item !== move.tile);
    match.boardTiles.push(move.tile);
    match.consecutivePasses = 0;

    if (match.botHand.length === 0) {
      match.lastEvent = (match.lastEvent ? match.lastEvent + ' ' : '') + 'O bot bateu — ficou sem peças.';
      this.awardMatch(userId, match, 'bot');
    }
  }

  private resolveBlockedGame(userId: string, match: DominoMatch) {
    const playerSum = tileSum(match.playerHand);
    const botSum = tileSum(match.botHand);
    match.lastEvent =
      (match.lastEvent ? match.lastEvent + ' ' : '') +
      `Jogo travou — você ficou com ${playerSum} pontos na mão, o bot com ${botSum}.`;

    if (playerSum < botSum) this.awardMatch(userId, match, 'jogador');
    else if (botSum < playerSum) this.awardMatch(userId, match, 'bot');
    else this.awardMatch(userId, match, 'empate');
  }

  private async awardMatch(userId: string, match: DominoMatch, winner: 'jogador' | 'bot' | 'empate') {
    match.finished = true;
    match.matchOutcome = winner;
    // Empate devolve o buy-in: 0 ponto de torneio, que é exatamente o certo.
    const retorno =
      winner === 'jogador' ? match.buyIn * MATCH_WIN_TOTAL_MULTIPLIER : winner === 'empate' ? match.buyIn : 0;
    if (winner === 'jogador') {
      await this.walletService.credit(userId, retorno, 'premio', GAME_ID);
    } else if (winner === 'empate') {
      await this.walletService.credit(userId, match.buyIn, 'ajuste', GAME_ID);
    }
    await this.tournaments.recordRound(userId, GAME_ID, match.buyIn, retorno);
  }

  private requireMatch(userId: string): DominoMatch {
    const match = this.matches.get(userId);
    if (!match || match.finished) {
      throw new BadRequestException('Nenhuma partida de dominó em andamento — comece uma nova.');
    }
    return match;
  }

  private async publicView(userId: string, match: DominoMatch) {
    return {
      buyIn: match.buyIn,
      playerHand: match.playerHand,
      boardTiles: match.boardTiles,
      leftEnd: match.leftEnd,
      rightEnd: match.rightEnd,
      botTileCount: match.botHand.length,
      canPlay: canPlay(match.playerHand, match.leftEnd, match.rightEnd),
      /** Quando é o jogador quem abre, é com esta peça — a tela destaca só ela. */
      aberturaObrigatoria: match.aberturaObrigatoria,
      finished: match.finished,
      matchOutcome: match.matchOutcome,
      lastEvent: match.lastEvent,
      newBalance: await this.walletService.balanceOf(userId),
    };
  }
}
