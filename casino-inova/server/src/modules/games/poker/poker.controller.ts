import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { PokerService } from './poker.service';
import { PokerAction } from './poker.engine';

class NewHandDto {
  userId!: string;
  buyIn!: number;
}

class ActDto {
  userId!: string;
  action!: PokerAction;
}

@Controller('games/poker')
export class PokerController {
  constructor(private readonly pokerService: PokerService) {}

  @Get('config')
  getConfig() {
    return this.pokerService.getConfig();
  }

  @Post('nova-mao')
  newHand(@Body() body: NewHandDto) {
    if (!body?.userId || typeof body.buyIn !== 'number') {
      throw new BadRequestException('Informe userId e buyIn.');
    }
    return this.pokerService.newHand(body.userId, body.buyIn);
  }

  @Post('agir')
  act(@Body() body: ActDto) {
    if (!body?.userId || !body?.action) {
      throw new BadRequestException('Informe userId e action.');
    }
    return this.pokerService.act(body.userId, body.action);
  }
}
