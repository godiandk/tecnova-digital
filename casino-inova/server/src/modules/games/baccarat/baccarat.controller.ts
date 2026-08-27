import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BaccaratService } from './baccarat.service';
import { BaccaratBetType } from './baccarat.config';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';

class BetDto {
  betType!: BaccaratBetType;
  amount!: number;
}

@Controller('games/bacara')
export class BaccaratController {
  constructor(private readonly baccaratService: BaccaratService) {}

  @Publico()
  @Get('placar')
  getRoadmap() {
    return this.baccaratService.getRoadmap();
  }

  @Publico()
  @Get('config')
  getConfig() {
    return this.baccaratService.getConfig();
  }

  @Post('apostar')
  playRound(@UsuarioAtual() usuarioLogado: string, @Body() body: BetDto) {
    if (!body?.betType || typeof body.amount !== 'number') {
      throw new BadRequestException('Informe betType e amount.');
    }
    return this.baccaratService.playRound(usuarioLogado, body.betType, body.amount);
  }
}
