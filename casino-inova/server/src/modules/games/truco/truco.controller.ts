import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { TrucoResponse, TrucoService } from './truco.service';
import { Card, TrucoSignalId, TrucoStyle, TrucoVariant } from './truco.config';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { AcaoDto } from '../shared/acao.dto';

const VALID_RESPONSES: TrucoResponse[] = ['aceitar', 'correr', 'aumentar'];

class NewMatchDto extends AcaoDto {
  buyIn!: number;
  /** "paulista" (padrão) ou "mineiro". */
  variant?: TrucoVariant;
  /** "sujo" (padrão, permite sinal pro parceiro) ou "limpo". */
  style?: TrucoStyle;
}

class SignalDto {
  signalId!: TrucoSignalId;
}

class PlayCardDto {
  card!: Card;
}

class UserIdDto {
}

class RespondTrucoDto extends UserIdDto {
  response!: TrucoResponse;
}

@Controller('games/truco')
export class TrucoController {
  constructor(private readonly trucoService: TrucoService) {}

  /*
   * DEIXOU DE SER PÚBLICO: a faixa de entrada agora é do degrau de quem pergunta, e degrau
   * depende de saldo e nível — dois dados que só existem com alguém identificado.
   */
  /**
   * A partida aberta deste jogador, ou `null`.
   *
   * É o que a tela pede AO ABRIR. Sem esta rota, quem recarregava a página perdia o
   * caminho de volta pra uma partida que continuava viva e com a entrada já debitada.
   */
  @Get('partida')
  partidaAberta(@UsuarioAtual() usuarioLogado: string) {
    return this.trucoService.partidaAberta(usuarioLogado);
  }

  @Get('config')
  getConfig(@UsuarioAtual() usuarioLogado: string) {
    return this.trucoService.getConfig(usuarioLogado);
  }

  @Post('nova-partida')
  newMatch(@UsuarioAtual() usuarioLogado: string, @Body() body: NewMatchDto) {
    if (typeof body.buyIn !== 'number') {
      throw new BadRequestException('Informe buyIn.');
    }
    return this.trucoService.newMatch(usuarioLogado, body.buyIn, body.variant, body.style, body.actionId);
  }

  @Post('jogar-carta')
  playCard(@UsuarioAtual() usuarioLogado: string, @Body() body: PlayCardDto) {
    if (!body?.card) {
      throw new BadRequestException('Informe card.');
    }
    return this.trucoService.playCard(usuarioLogado, body.card);
  }

  @Post('pedir-truco')
  callTruco(@UsuarioAtual() usuarioLogado: string, @Body() body: UserIdDto) {
    return this.trucoService.callTruco(usuarioLogado);
  }

  @Post('sinal')
  makeSignal(@UsuarioAtual() usuarioLogado: string, @Body() body: SignalDto) {
    if (!body?.signalId) {
      throw new BadRequestException('Informe signalId.');
    }
    return this.trucoService.makeSignal(usuarioLogado, body.signalId);
  }

  @Post('responder-truco')
  respondTruco(@UsuarioAtual() usuarioLogado: string, @Body() body: RespondTrucoDto) {
    if (!VALID_RESPONSES.includes(body.response)) {
      throw new BadRequestException('Informe response (aceitar, correr ou aumentar).');
    }
    return this.trucoService.respondTruco(usuarioLogado, body.response);
  }
}
