import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BaccaratService } from './baccarat.service';
import { BaccaratBetType } from './baccarat.config';

class BetDto {
  userId!: string;
  betType!: BaccaratBetType;
  amount!: number;
}

@Controller('games/bacara')
export class BaccaratController {
  constructor(private readonly baccaratService: BaccaratService) {}

  @Get('placar')
  getRoadmap() {
    return this.baccaratService.getRoadmap();
  }

  @Get('config')
  getConfig() {
    return this.baccaratService.getConfig();
  }

  @Post('apostar')
  playRound(@Body() body: BetDto) {
    if (!body?.userId || !body?.betType || typeof body.amount !== 'number') {
      throw new BadRequestException('Informe userId, betType e amount.');
    }
    return this.baccaratService.playRound(body.userId, body.betType, body.amount);
  }
}
