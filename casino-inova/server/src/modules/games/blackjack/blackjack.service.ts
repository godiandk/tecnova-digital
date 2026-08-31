import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';
import { TournamentsService } from '../../tournaments/tournaments.service';
import {
  canDouble,
  canSplit,
  dealerShouldDraw,
  handValue,
  isBust,
  isNatural,
  isSoft,
  Outcome,
  resolveHand,
} from './blackjack.engine';
import {
  BLACKJACK_PAYOUT_MULTIPLIER,
  DEALER_STANDS_ON,
  INSURANCE_MAX_FRACTION,
  INSURANCE_PAYOUT_MULTIPLIER,
  MAX_BET,
  MAX_HANDS,
  MIN_BET,
  Rank,
  RANKS,
} from './blackjack.config';
import { CartaComNaipe, nomeDaCarta } from '../shared/naipes';
import { Sapata } from '../shared/sapata';

type Carta = CartaComNaipe<Rank>;

const valores = (cartas: Carta[]): Rank[] => cartas.map((c) => c.rank);

interface Mao {
  cartas: Carta[];
  /** A aposta DESTA mão. Dobrar dobra ela; dividir cria outra com o valor original. */
  aposta: number;
  dobrada: boolean;
  /** Veio de um split — 21 aqui vale 21, não blackjack. */
  deSplit: boolean;
  /** Veio de dividir Ases: recebe uma carta só e não pode mais nada. */
  deSplitDeAses: boolean;
  encerrada: boolean;
  outcome?: Outcome;
  totalReturn?: number;
}

interface EstadoDaMesa {
  apostaInicial: number;
  maos: Mao[];
  /** Qual mão está sendo jogada agora. */
  maoAtual: number;
  cartasDoDealer: Carta[];
  /** Quanto foi apostado no seguro. 0 = não fez (ou nem foi oferecido). */
  seguro: number;
  seguroPago: number;
  /** O dealer mostra Ás e o jogador ainda não respondeu ao seguro. Trava o resto. */
  esperandoSeguro: boolean;
  finished: boolean;
  embaralhouAgora: boolean;
}

/** Id deste jogo no catálogo — usado no extrato e na pontuação de torneio. */
const GAME_ID = 'blackjack';

/**
 * Blackjack de mesa: dobrar, dividir e seguro, com sapata de 8 baralhos.
 *
 * Antes o jogo só tinha pedir carta e parar. Isso não é blackjack — é uma versão em que
 * o jogador perde muito mais do que devia, porque a estratégia básica depende justamente
 * de dobrar e dividir nas horas certas. Sem elas a vantagem da casa passa de ~0,5% pra
 * mais de 2%, e o jogador nem sabe por quê: as jogadas que faltam não aparecem na tela.
 *
 * O estado da mão vive em memória nesta versão e some se o servidor reiniciar, igual
 * antes. Uma tabela no Postgres resolve isso quando a Fase 0 for pra valer.
 */
@Injectable()
export class BlackjackService {
  private readonly mesas = new Map<string, EstadoDaMesa>();
  /** Uma sapata por jogador: cada um tem a sua mesa, como em cassino online. */
  private readonly sapatas = new Map<string, Sapata<Rank>>();

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
      maxHands: MAX_HANDS,
      insurancePayoutMultiplier: INSURANCE_PAYOUT_MULTIPLIER,
      insuranceMaxFraction: INSURANCE_MAX_FRACTION,
      baralhos: 8,
    };
  }

  private sapataDe(userId: string): Sapata<Rank> {
    let sapata = this.sapatas.get(userId);
    if (!sapata) {
      sapata = new Sapata<Rank>(RANKS);
      this.sapatas.set(userId, sapata);
    }
    return sapata;
  }

  async startHand(userId: string, bet: number) {
    const existente = this.mesas.get(userId);
    if (existente && !existente.finished) {
      throw new BadRequestException('Você já tem uma mão em andamento — termine ela antes de apostar de novo.');
    }
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException(`A aposta precisa estar entre ${MIN_BET} e ${MAX_BET} fichas.`);
    }

    await this.walletService.debit(userId, bet, 'aposta', GAME_ID);

    // Embaralhar acontece ENTRE mãos, nunca no meio de uma.
    const sapata = this.sapataDe(userId);
    const embaralhou = sapata.embaralharSePassouDoCorte();

    // Na mesa as cartas saem alternadas: jogador, dealer, jogador, dealer.
    const p1 = sapata.comprar();
    const d1 = sapata.comprar();
    const p2 = sapata.comprar();
    const d2 = sapata.comprar();

    const mesa: EstadoDaMesa = {
      apostaInicial: bet,
      maos: [{ cartas: [p1, p2], aposta: bet, dobrada: false, deSplit: false, deSplitDeAses: false, encerrada: false }],
      maoAtual: 0,
      cartasDoDealer: [d1, d2],
      seguro: 0,
      seguroPago: 0,
      esperandoSeguro: d1.rank === 'A',
      finished: false,
      embaralhouAgora: embaralhou,
    };
    this.mesas.set(userId, mesa);

    // Com Ás à mostra, o seguro é oferecido ANTES de qualquer outra coisa — inclusive
    // antes de o dealer espiar a carta escondida. É a ordem da mesa de verdade.
    if (mesa.esperandoSeguro) {
      return this.publicView(userId, mesa);
    }
    return this.aposDistribuir(userId, mesa);
  }

  /**
   * O dealer espia a carta escondida quando mostra Ás ou carta de 10. Se tiver
   * blackjack, a mão acaba na hora; ninguém joga contra uma mão já vencida.
   */
  private async aposDistribuir(userId: string, mesa: EstadoDaMesa) {
    const dealerAbre = mesa.cartasDoDealer[0].rank;
    const podeEspiar = dealerAbre === 'A' || handValue([dealerAbre]) === 10;

    if ((podeEspiar && isNatural(valores(mesa.cartasDoDealer))) || isNatural(valores(mesa.maos[0].cartas))) {
      return this.encerrarTudo(userId, mesa);
    }
    return this.publicView(userId, mesa);
  }

  /** Aceita ou recusa o seguro. Recusar é só seguir o jogo — e costuma ser o certo. */
  async responderSeguro(userId: string, aceitar: boolean, valor?: number) {
    const mesa = this.mesaEmJogo(userId);
    if (!mesa.esperandoSeguro) {
      throw new BadRequestException('O seguro não está sendo oferecido agora.');
    }

    if (aceitar) {
      const maximo = Math.floor(mesa.apostaInicial * INSURANCE_MAX_FRACTION);
      const pedido = valor ?? maximo;
      if (!Number.isFinite(pedido) || pedido <= 0 || pedido > maximo) {
        throw new BadRequestException(`O seguro pode ser de 1 a ${maximo} fichas (metade da aposta).`);
      }
      await this.walletService.debit(userId, pedido, 'aposta', GAME_ID);
      mesa.seguro = pedido;
    }

    mesa.esperandoSeguro = false;

    // O seguro paga 2:1 quando a carta escondida vale 10 — e é aí que a mão acaba.
    if (isNatural(valores(mesa.cartasDoDealer))) {
      if (mesa.seguro > 0) {
        mesa.seguroPago = mesa.seguro * INSURANCE_PAYOUT_MULTIPLIER;
        await this.walletService.credit(userId, mesa.seguroPago, 'premio', GAME_ID);
      }
      return this.encerrarTudo(userId, mesa);
    }
    return this.aposDistribuir(userId, mesa);
  }

  hit(userId: string) {
    const mesa = this.requireMesa(userId);
    const mao = this.maoEmJogo(mesa);
    mao.cartas.push(this.sapataDe(userId).comprar());

    if (isBust(valores(mao.cartas)) || handValue(valores(mao.cartas)) === 21) {
      // Estourou ou chegou em 21: não tem mais o que pedir nesta mão.
      mao.encerrada = true;
      return this.avancar(userId, mesa);
    }
    return this.publicView(userId, mesa);
  }

  stand(userId: string) {
    const mesa = this.requireMesa(userId);
    this.maoEmJogo(mesa).encerrada = true;
    return this.avancar(userId, mesa);
  }

  /** Dobra a aposta desta mão e compra UMA carta só. Depois disso a mão está fechada. */
  async double(userId: string) {
    const mesa = this.requireMesa(userId);
    const mao = this.maoEmJogo(mesa);
    if (!canDouble(valores(mao.cartas), mao.deSplitDeAses)) {
      throw new BadRequestException('Só dá pra dobrar nas duas primeiras cartas da mão.');
    }

    await this.walletService.debit(userId, mao.aposta, 'aposta', GAME_ID);
    mao.aposta *= 2;
    mao.dobrada = true;
    mao.cartas.push(this.sapataDe(userId).comprar());
    mao.encerrada = true;
    return this.avancar(userId, mesa);
  }

  /**
   * Separa o par em duas mãos, cada uma com uma aposta igual à original.
   *
   * Ás dividido recebe uma carta só e não joga mais — regra de cassino, e é o que
   * impede o split de Ases de virar a jogada mais forte da mesa.
   */
  async split(userId: string) {
    const mesa = this.requireMesa(userId);
    const mao = this.maoEmJogo(mesa);
    if (!canSplit(valores(mao.cartas), mesa.maos.length, mao.deSplitDeAses)) {
      throw new BadRequestException(
        mesa.maos.length >= MAX_HANDS
          ? `Não dá pra dividir de novo — o limite é ${MAX_HANDS} mãos.`
          : 'Só dá pra dividir um par nas duas primeiras cartas.',
      );
    }

    await this.walletService.debit(userId, mesa.apostaInicial, 'aposta', GAME_ID);
    const sapata = this.sapataDe(userId);
    const eramAses = mao.cartas[0].rank === 'A';
    const segundaCarta = mao.cartas.pop()!;

    mao.deSplit = true;
    mao.deSplitDeAses = eramAses;
    mao.cartas.push(sapata.comprar());

    const novaMao: Mao = {
      cartas: [segundaCarta, sapata.comprar()],
      aposta: mesa.apostaInicial,
      dobrada: false,
      deSplit: true,
      deSplitDeAses: eramAses,
      encerrada: eramAses,
    };
    // A mão nova entra logo depois da atual, pra ordem na tela ser a da mesa.
    mesa.maos.splice(mesa.maoAtual + 1, 0, novaMao);

    if (eramAses) {
      // Ases divididos já receberam a carta única: as duas mãos estão fechadas.
      mao.encerrada = true;
      return this.avancar(userId, mesa);
    }
    return this.publicView(userId, mesa);
  }

  /** Passa pra próxima mão aberta; se não tem mais nenhuma, é a vez do dealer. */
  private avancar(userId: string, mesa: EstadoDaMesa) {
    const proxima = mesa.maos.findIndex((mao, indice) => indice > mesa.maoAtual && !mao.encerrada);
    if (proxima !== -1) {
      mesa.maoAtual = proxima;
      return this.publicView(userId, mesa);
    }
    return this.encerrarTudo(userId, mesa);
  }

  /** A mesa em jogo, sem olhar o seguro — é o que `responderSeguro` precisa. */
  private mesaEmJogo(userId: string): EstadoDaMesa {
    const mesa = this.mesas.get(userId);
    if (!mesa || mesa.finished) {
      throw new BadRequestException('Nenhuma mão em andamento — aposte primeiro.');
    }
    return mesa;
  }

  /**
   * A mesa pronta pra uma jogada de carta. Enquanto o seguro está pendente nada mais
   * anda — mas responder o seguro passa por `mesaEmJogo`, senão o único caminho pra
   * destravar seria justamente o que este guarda bloqueia.
   */
  private requireMesa(userId: string): EstadoDaMesa {
    const mesa = this.mesaEmJogo(userId);
    if (mesa.esperandoSeguro) {
      throw new BadRequestException('Responda o seguro antes de continuar.');
    }
    return mesa;
  }

  private maoEmJogo(mesa: EstadoDaMesa): Mao {
    const mao = mesa.maos[mesa.maoAtual];
    if (!mao || mao.encerrada) {
      throw new BadRequestException('Esta mão já está fechada.');
    }
    return mao;
  }

  private async encerrarTudo(userId: string, mesa: EstadoDaMesa) {
    mesa.finished = true;

    /*
     * O dealer só compra se ainda tem contra quem jogar. Se todas as mãos estouraram, a
     * casa já ganhou e não tem por que virar mais carta — é assim na mesa, e evita
     * mostrar um "dealer estourou" que não muda nada e confunde.
     */
    const alguemVivo = mesa.maos.some((mao) => !isBust(valores(mao.cartas)));
    const jogadorTemNatural = mesa.maos.length === 1 && isNatural(valores(mesa.maos[0].cartas));
    if (alguemVivo && !jogadorTemNatural && !isNatural(valores(mesa.cartasDoDealer))) {
      const sapata = this.sapataDe(userId);
      while (dealerShouldDraw(valores(mesa.cartasDoDealer))) {
        mesa.cartasDoDealer.push(sapata.comprar());
      }
    }

    let apostaTotal = mesa.seguro;
    let retornoTotal = mesa.seguroPago;
    for (const mao of mesa.maos) {
      const resultado = resolveHand(valores(mao.cartas), valores(mesa.cartasDoDealer), mao.aposta, mao.deSplit);
      mao.outcome = resultado.outcome;
      mao.totalReturn = resultado.totalReturn;
      apostaTotal += mao.aposta;
      retornoTotal += resultado.totalReturn;
      if (resultado.totalReturn > 0) {
        await this.walletService.credit(userId, resultado.totalReturn, 'premio', GAME_ID);
      }
    }

    // A rodada de torneio é a mesa inteira: tudo que foi apostado contra tudo que voltou.
    await this.tournaments.recordRound(userId, GAME_ID, apostaTotal, retornoTotal);
    return this.publicView(userId, mesa);
  }

  private async publicView(userId: string, mesa: EstadoDaMesa) {
    // Enquanto a mão corre, a segunda carta do dealer fica escondida — como na mesa.
    const cartasDoDealer: (string | null)[] = mesa.finished
      ? mesa.cartasDoDealer.map(nomeDaCarta)
      : [nomeDaCarta(mesa.cartasDoDealer[0]), null];

    const maoAtual = mesa.maos[mesa.maoAtual];
    const podeAgir = !mesa.finished && !mesa.esperandoSeguro && maoAtual && !maoAtual.encerrada;

    return {
      maos: mesa.maos.map((mao, indice) => ({
        cartas: mao.cartas.map(nomeDaCarta),
        total: handValue(valores(mao.cartas)),
        mole: isSoft(valores(mao.cartas)),
        aposta: mao.aposta,
        dobrada: mao.dobrada,
        deSplit: mao.deSplit,
        blackjack: isNatural(valores(mao.cartas), mao.deSplit),
        estourou: isBust(valores(mao.cartas)),
        emJogo: !mesa.finished && indice === mesa.maoAtual && !mao.encerrada,
        outcome: mao.outcome,
        totalReturn: mao.totalReturn,
      })),
      maoAtual: mesa.maoAtual,
      cartasDoDealer,
      totalDoDealer: mesa.finished ? handValue(valores(mesa.cartasDoDealer)) : undefined,
      /** O que dá pra fazer AGORA — a tela liga e desliga os botões a partir daqui. */
      podeComprar: Boolean(podeAgir),
      podeParar: Boolean(podeAgir),
      podeDobrar: Boolean(podeAgir) && canDouble(valores(maoAtual.cartas), maoAtual.deSplitDeAses),
      podeDividir: Boolean(podeAgir) && canSplit(valores(maoAtual.cartas), mesa.maos.length, maoAtual.deSplitDeAses),
      esperandoSeguro: mesa.esperandoSeguro,
      seguroMaximo: Math.floor(mesa.apostaInicial * INSURANCE_MAX_FRACTION),
      seguro: mesa.seguro,
      seguroPago: mesa.seguroPago,
      apostaInicial: mesa.apostaInicial,
      finished: mesa.finished,
      embaralhouAgora: mesa.embaralhouAgora,
      cartasAteOCorte: this.sapataDe(userId).cartasAteOCorte,
      newBalance: await this.walletService.balanceOf(userId),
    };
  }
}
