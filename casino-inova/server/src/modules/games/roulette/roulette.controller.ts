import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { RouletteService } from './roulette.service';
import { RouletteBet } from './roulette.config';

class SpinDto {
  userId!: string;
  bet!: RouletteBet;
  amount!: number;
}

@Controller('games/roleta')
export class RouletteController {
  constructor(private readonly rouletteService: RouletteService) {}

  @Get('config')
  getConfig() {
    return this.rouletteService.getConfig();
  }

  @Post('girar')
  spin(@Body() body: SpinDto) {
    if (!body?.userId || !body?.bet?.type || typeof body.amount !== 'number') {
      throw new BadRequestException('Informe userId, bet e amount.');
    }
    return this.rouletteService.playSpin(body.userId, body.bet, body.amount);
  }
}
