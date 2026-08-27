import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { PokerService } from './poker.service';
import { PokerAction } from './poker.engine';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';

class NewHandDto {
  buyIn!: number;
}

class ActDto {
  action!: PokerAction;
}

@Controller('games/poker')
export class PokerController {
  constructor(private readonly pokerService: PokerService) {}

  @Publico()
  @Get('config')
  getConfig() {
    return this.pokerService.getConfig();
  }

  @Post('nova-mao')
  newHand(@UsuarioAtual() usuarioLogado: string, @Body() body: NewHandDto) {
    if (typeof body.buyIn !== 'number') {
      throw new BadRequestException('Informe buyIn.');
    }
    return this.pokerService.newHand(usuarioLogado, body.buyIn);
  }

  @Post('agir')
  act(@UsuarioAtual() usuarioLogado: string, @Body() body: ActDto) {
    if (!body?.action) {
      throw new BadRequestException('Informe action.');
    }
    return this.pokerService.act(usuarioLogado, body.action);
  }
}
