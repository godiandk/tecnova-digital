import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { TrucoResponse, TrucoService } from './truco.service';
import { Card, TrucoSignalId, TrucoStyle, TrucoVariant } from './truco.config';

const VALID_RESPONSES: TrucoResponse[] = ['aceitar', 'correr', 'aumentar'];

class NewMatchDto {
  userId!: string;
  buyIn!: number;
  /** "paulista" (padrão) ou "mineiro". */
  variant?: TrucoVariant;
  /** "sujo" (padrão, permite sinal pro parceiro) ou "limpo". */
  style?: TrucoStyle;
}

class SignalDto {
  userId!: string;
  signalId!: TrucoSignalId;
}

class PlayCardDto {
  userId!: string;
  card!: Card;
}

class UserIdDto {
  userId!: string;
}

class RespondTrucoDto extends UserIdDto {
  response!: TrucoResponse;
}

@Controller('games/truco')
export class TrucoController {
  constructor(private readonly trucoService: TrucoService) {}

  @Get('config')
  getConfig() {
    return this.trucoService.getConfig();
  }

  @Post('nova-partida')
  newMatch(@Body() body: NewMatchDto) {
    if (!body?.userId || typeof body.buyIn !== 'number') {
      throw new BadRequestException('Informe userId e buyIn.');
    }
    return this.trucoService.newMatch(body.userId, body.buyIn, body.variant, body.style);
  }

  @Post('jogar-carta')
  playCard(@Body() body: PlayCardDto) {
    if (!body?.userId || !body?.card) {
      throw new BadRequestException('Informe userId e card.');
    }
    return this.trucoService.playCard(body.userId, body.card);
  }

  @Post('pedir-truco')
  callTruco(@Body() body: UserIdDto) {
    if (!body?.userId) {
      throw new BadRequestException('Informe userId.');
    }
    return this.trucoService.callTruco(body.userId);
  }

  @Post('sinal')
  makeSignal(@Body() body: SignalDto) {
    if (!body?.userId || !body?.signalId) {
      throw new BadRequestException('Informe userId e signalId.');
    }
    return this.trucoService.makeSignal(body.userId, body.signalId);
  }

  @Post('responder-truco')
  respondTruco(@Body() body: RespondTrucoDto) {
    if (!body?.userId || !VALID_RESPONSES.includes(body.response)) {
      throw new BadRequestException('Informe userId e response (aceitar, correr ou aumentar).');
    }
    return this.trucoService.respondTruco(body.userId, body.response);
  }
}
