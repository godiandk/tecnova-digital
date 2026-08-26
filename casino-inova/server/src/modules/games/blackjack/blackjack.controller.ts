import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BlackjackService } from './blackjack.service';

class UserIdDto {
  userId!: string;
}

class BetDto extends UserIdDto {
  bet!: number;
}

@Controller('games/blackjack')
export class BlackjackController {
  constructor(private readonly blackjackService: BlackjackService) {}

  @Get('config')
  getConfig() {
    return this.blackjackService.getConfig();
  }

  @Post('apostar')
  startHand(@Body() body: BetDto) {
    if (!body?.userId || typeof body.bet !== 'number') {
      throw new BadRequestException('Informe userId e bet.');
    }
    return this.blackjackService.startHand(body.userId, body.bet);
  }

  @Post('pedir-carta')
  hit(@Body() body: UserIdDto) {
    if (!body?.userId) {
      throw new BadRequestException('Informe userId.');
    }
    return this.blackjackService.hit(body.userId);
  }

  @Post('parar')
  stand(@Body() body: UserIdDto) {
    if (!body?.userId) {
      throw new BadRequestException('Informe userId.');
    }
    return this.blackjackService.stand(body.userId);
  }
}
