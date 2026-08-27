import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { TrucoResponse, TrucoService } from './truco.service';
import { Card } from './truco.config';

const VALID_RESPONSES: TrucoResponse[] = ['aceitar', 'correr', 'aumentar'];

class NewMatchDto {
  userId!: string;
  buyIn!: number;
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
    return this.trucoService.newMatch(body.userId, body.buyIn);
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

  @Post('responder-truco')
  respondTruco(@Body() body: RespondTrucoDto) {
    if (!body?.userId || !VALID_RESPONSES.includes(body.response)) {
      throw new BadRequestException('Informe userId e response (aceitar, correr ou aumentar).');
    }
    return this.trucoService.respondTruco(body.userId, body.response);
  }
}
