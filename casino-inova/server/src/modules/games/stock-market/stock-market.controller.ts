import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { StockMarketService } from './stock-market.service';
import { StockDirection } from './stock-market.config';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';
import { AcaoDto } from '../shared/acao.dto';

class PlayDto extends AcaoDto {
  direction!: StockDirection;
  amount!: number;
}

@Controller('games/stock-market')
export class StockMarketController {
  constructor(private readonly stockMarketService: StockMarketService) {}

  @Publico()
  @Get('config')
  getConfig() {
    return this.stockMarketService.getConfig();
  }

  @Publico()
  @Get('historico')
  getHistory() {
    return this.stockMarketService.getHistory();
  }

  @Post('apostar')
  playRound(@UsuarioAtual() usuarioLogado: string, @Body() body: PlayDto) {
    return this.stockMarketService.playRound(usuarioLogado, { direction: body.direction, amount: body.amount }, body.actionId);
  }
}
