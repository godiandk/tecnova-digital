import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BaccaratService } from './baccarat.service';
import { BaccaratBetType } from './baccarat.config';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';
import { AcaoDto } from '../shared/acao.dto';

class BetDto extends AcaoDto {
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

  /*
   * DEIXOU DE SER PÚBLICO: a faixa de aposta é do degrau de quem pergunta, e degrau
   * depende de saldo e nível — dois dados que só existem com alguém identificado.
   */
  @Get('config')
  getConfig(@UsuarioAtual() usuarioLogado: string) {
    return this.baccaratService.getConfig(usuarioLogado);
  }

  @Post('apostar')
  playRound(@UsuarioAtual() usuarioLogado: string, @Body() body: BetDto) {
    if (!body?.betType || typeof body.amount !== 'number') {
      throw new BadRequestException('Informe betType e amount.');
    }
    return this.baccaratService.playRound(usuarioLogado, body.betType, body.amount, body.actionId);
  }
}
