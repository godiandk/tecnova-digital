import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BacBoService } from './bac-bo.service';
import { BacBoBet } from './bac-bo.engine';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';

class PlayDto {
  bets!: BacBoBet[];
}

@Controller('games/bac-bo')
export class BacBoController {
  constructor(private readonly bacBoService: BacBoService) {}

  @Publico()
  @Get('config')
  getConfig() {
    return this.bacBoService.getConfig();
  }

  @Publico()
  @Get('placar')
  getRoadmap() {
    return this.bacBoService.getRoadmap();
  }

  @Post('apostar')
  playRound(@UsuarioAtual() usuarioLogado: string, @Body() body: PlayDto) {
    if (!Array.isArray(body?.bets)) {
      throw new BadRequestException('Informe bets.');
    }
    return this.bacBoService.playRound(usuarioLogado, body.bets);
  }
}
