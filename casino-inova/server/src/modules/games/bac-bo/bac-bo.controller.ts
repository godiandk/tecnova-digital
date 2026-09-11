import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BacBoService } from './bac-bo.service';
import { BacBoBet } from './bac-bo.engine';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';
import { AcaoDto } from '../shared/acao.dto';

class PlayDto extends AcaoDto {
  bets!: BacBoBet[];
}

@Controller('games/bac-bo')
export class BacBoController {
  constructor(private readonly bacBoService: BacBoService) {}

  /*
   * DEIXOU DE SER PÚBLICO: a faixa de aposta é do degrau de quem pergunta, e degrau
   * depende de saldo e nível — dois dados que só existem com alguém identificado.
   */
  @Get('config')
  getConfig(@UsuarioAtual() usuarioLogado: string) {
    return this.bacBoService.getConfig(usuarioLogado);
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
    return this.bacBoService.playRound(usuarioLogado, body.bets, body.actionId);
  }
}
