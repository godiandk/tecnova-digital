import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import { LanceRegistrado, MaquinaDeRodada } from '../core/maquina-de-rodada';
import { BoardEnd, canPlay, chooseBotMove, otherEnd, quemAbre, shuffle, tileMatches, tileSum } from './domino.engine';
import { buildTileSet, HAND_SIZE, MATCH_WIN_TOTAL_MULTIPLIER, Tile } from './domino.config';
import { DegrauDoJogador } from '../shared/degrau-do-jogador.service';
import { faixaDeEntrada, problemaComAEntrada } from '../shared/niveis-de-mesa';

interface DominoMatch {
  /**
   * O saldo de quem sentou, ANTES do débito da entrada — é ele que diz o degrau da
   * pessoa quando a partida acabar e o XP for somado. Guardado aqui porque a partida
   * dura minutos, e no fim o saldo já não é mais o de quem sentou.
   */
  saldoAntes: number;

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

  /*
   * A CONFIGURAÇÃO PASSOU A DEPENDER DE QUEM PERGUNTA, porque a faixa de entrada é do
   * degrau da pessoa. Era um endereço público que devolvia 100 a 5.000 pra todo mundo.
   */
  async getConfig(userId: string) {
    const quem = await this.degraus.de(userId);
    const faixa = faixaDeEntrada(quem.saldo, quem.nivel);
    /* As entradas possíveis são as FICHAS DO DEGRAU: cinco valores, um toque cada. */
    const entradas = quem.degrau.fichas.filter((e) => e >= faixa.minimo && e <= faixa.maximo && e <= quem.saldo);
    return { minBuyIn: faixa.minimo, maxBuyIn: faixa.maximo, handSize: HAND_SIZE, degrau: quem.degrau, entradas };
  }

  async newMatch(userId: string, buyIn: number, actionId?: string) {
    const existing = this.matches.get(userId);
    if (existing && !existing.finished) {
      throw new BadRequestException('Você já tem uma partida de dominó em andamento.');
    }
    const quem = await this.degraus.de(userId);
    const problema = problemaComAEntrada(buyIn, quem.saldo, quem.nivel);
    if (problema) throw new BadRequestException(problema);

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
    const deck = shuffle(buildTileSet());
    const match: DominoMatch = {
      buyIn,
      saldoAntes,
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

  /*
   * OS MÉTODOS DE JOGADA VIRARAM `async`, E ISSO NÃO É COSMÉTICO.
   *
   * `awardMatch` credita a carteira, e era chamada SEM `await` de dentro de uma cadeia
   * síncrona. A jogada respondia o resultado da partida e o `newBalance` ANTES de o
   * crédito ter acontecido — duas idas ao banco em conexões diferentes, sem ordem
   * garantida entre elas. E se o processo caísse no meio, o prêmio sumia, porque ninguém
   * estava esperando aquela promessa.
   *
   * É o mesmo defeito que estava no pôquer e no truco, e a mesma correção: a cadeia
   * inteira espera, e ninguém vê "você bateu" antes de a ficha ter se mexido.
   */
  async playTile(userId: string, tile: Tile, end?: BoardEnd) {
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
      await this.awardMatch(userId, match, 'jogador');
      return this.publicView(userId, match);
    }

    await this.runBotTurn(userId, match);
    return this.publicView(userId, match);
  }

  async passTurn(userId: string) {
    const match = this.requireMatch(userId);
    if (canPlay(match.playerHand, match.leftEnd, match.rightEnd)) {
      throw new BadRequestException('Você tem uma peça jogável — não pode passar.');
    }

    match.consecutivePasses += 1;
    match.lastEvent = 'Você passou a vez.';

    if (match.consecutivePasses >= 2) {
      await this.resolveBlockedGame(userId, match);
      return this.publicView(userId, match);
    }

    await this.runBotTurn(userId, match);
    return this.publicView(userId, match);
  }

  private async runBotTurn(userId: string, match: DominoMatch) {
    if (match.finished) return;

    const move = match.leftEnd === null ? null : chooseBotMove(match.botHand, match.leftEnd, match.rightEnd!);
    if (!move) {
      match.consecutivePasses += 1;
      match.lastEvent = (match.lastEvent ? match.lastEvent + ' ' : '') + 'O bot passou a vez.';
      if (match.consecutivePasses >= 2) {
        await this.resolveBlockedGame(userId, match);
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
      await this.awardMatch(userId, match, 'bot');
    }
  }

  private async resolveBlockedGame(userId: string, match: DominoMatch) {
    const playerSum = tileSum(match.playerHand);
    const botSum = tileSum(match.botHand);
    match.lastEvent =
      (match.lastEvent ? match.lastEvent + ' ' : '') +
      `Jogo travou — você ficou com ${playerSum} pontos na mão, o bot com ${botSum}.`;

    if (playerSum < botSum) await this.awardMatch(userId, match, 'jogador');
    else if (botSum < playerSum) await this.awardMatch(userId, match, 'bot');
    else await this.awardMatch(userId, match, 'empate');
  }

  private async awardMatch(userId: string, match: DominoMatch, winner: 'jogador' | 'bot' | 'empate') {
    match.finished = true;
    match.matchOutcome = winner;
    // Empate devolve o buy-in: 0 ponto de torneio, que é exatamente o certo.
    const retorno =
      winner === 'jogador' ? match.buyIn * MATCH_WIN_TOTAL_MULTIPLIER : winner === 'empate' ? match.buyIn : 0;
    if (winner === 'jogador') {
      await this.walletService.credit(
        userId,
        retorno,
        'premio',
        GAME_ID,
        undefined,
        this.rodadaDaPartida.get(userId)?.id,
      );
    } else if (winner === 'empate') {
      await this.walletService.credit(userId, match.buyIn, 'ajuste', GAME_ID);
    }
    await this.tournaments.recordRound(userId, GAME_ID, match.buyIn, retorno, match.saldoAntes);

    const rodada = this.rodadaDaPartida.get(userId);
    if (rodada) {
      await rodada.terminar({
        resultado: { vencedor: winner },
        apostado: match.buyIn,
        retorno,
        comAcoesDoJogador: true,
      });
      this.rodadaDaPartida.delete(userId);
    }
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
