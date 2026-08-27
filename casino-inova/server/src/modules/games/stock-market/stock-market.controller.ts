import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { StockMarketService } from './stock-market.service';
import { StockDirection } from './stock-market.config';

class PlayDto {
  userId!: string;
  direction!: StockDirection;
  amount!: number;
}

@Controller('games/stock-market')
export class StockMarketController {
  constructor(private readonly stockMarketService: StockMarketService) {}

  @Get('config')
  getConfig() {
    return this.stockMarketService.getConfig();
  }

  @Get('historico')
  getHistory() {
    return this.stockMarketService.getHistory();
  }

  @Post('apostar')
  playRound(@Body() body: PlayDto) {
    if (!body?.userId) {
      throw new BadRequestException('Informe userId.');
    }
    return this.stockMarketService.playRound(body.userId, { direction: body.direction, amount: body.amount });
  }
}
