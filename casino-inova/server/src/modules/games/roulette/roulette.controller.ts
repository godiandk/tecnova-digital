import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { RouletteService } from './roulette.service';
import { RouletteBet } from './roulette.config';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';

class SpinDto {
  bet!: RouletteBet;
  amount!: number;
}

@Controller('games/roleta')
export class RouletteController {
  constructor(private readonly rouletteService: RouletteService) {}

  @Publico()
  @Get('historico')
  getHistory() {
    return this.rouletteService.getHistory();
  }

  @Publico()
  @Get('config')
  getConfig() {
    return this.rouletteService.getConfig();
  }

  @Post('girar')
  spin(@UsuarioAtual() usuarioLogado: string, @Body() body: SpinDto) {
    if (!body?.bet?.type || typeof body.amount !== 'number') {
      throw new BadRequestException('Informe bet e amount.');
    }
    return this.rouletteService.playSpin(usuarioLogado, body.bet, body.amount);
  }
}
